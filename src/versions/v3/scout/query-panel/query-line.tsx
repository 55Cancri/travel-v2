import * as React from "react";
import { Block, Button, Input, MagnifyingGlass, Spinner, Text, X } from "atoms";
import { Checkbox, ErrorNote, IconButton } from "alloys";
import { findPlaces, MIN_QUERY_CHARS, type Finding, type SearchScope } from "../find-places";
import type { ScoutAction, ScoutLine } from "../lines";
import { openLine, openVerdict } from "../open-now";

// One line of the panel: what was typed, what it found, and which of those
// findings are on the map. The line owns its own search lifecycle (one
// debounce, one abort signal) and reports every result upward, so the panel
// above it holds the whole picture and no answer lives in two places.
//
// The search waits for a pause in typing rather than firing per keystroke:
// the map half of it runs against a public Overpass instance whose fair-use
// budget a per-keystroke sweep would burn through in one word.
const DEBOUNCE_MS = 600;

const detailOf = (finding: Finding, now: Temporal.Instant) => {
  const verdict = openVerdict(finding, now);
  return {
    verdict,
    line: [finding.category, finding.address].filter(Boolean).join(" · "),
    hours: openLine(verdict),
  };
};

export function QueryLine(props: {
  line: ScoutLine;
  canRemove: boolean;
  scopeOf: () => SearchScope | null;
  dispatch: (action: ScoutAction) => void;
  onFocusFinding: (finding: Finding) => void;
  now: Temporal.Instant;
  mapReady: boolean;
}) {
  const line = props.line;
  const isSearching = line.status === "searching";

  React.useEffect(() => {
    const text = line.typed.trim();
    if (text.length < MIN_QUERY_CHARS) {
      if (line.status !== "idle") props.dispatch({ name: "emptied", id: line.id });
      return;
    }
    if (text === line.query) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const scope = props.scopeOf();
      // No map yet means no view to search inside. mapReady is a dependency
      // above, so this run repeats itself the moment the map has one,
      // instead of leaving typed words silently unsearched forever.
      if (!scope) return;
      props.dispatch({ name: "searching", id: line.id, query: text });
      try {
        const results = await findPlaces(text, scope, controller.signal);
        if (controller.signal.aborted) return;
        props.dispatch({ name: "answered", id: line.id, query: text, results });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("[scout] line search failed:", error);
        props.dispatch({
          name: "failed",
          id: line.id,
          query: text,
          failure: error instanceof Error ? error.message : String(error),
        });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // The dispatch and scope reader are stable handles; every other value
    // the run needs is read when the timer fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line.typed, line.query, line.runId, props.mapReady]);

  const allShown = line.findings.length > 0 && line.shownIds.length === line.findings.length;

  return (
    <Block py="xs">
      <Block grid cols="1fr auto" alignItems="center" gap="xs">
        <Input
          value={line.typed}
          placeholder="Media Markt, or an address"
          aria-label="What to find on the map"
          onChange={(event) =>
            props.dispatch({ name: "typed", id: line.id, text: event.target.value })
          }
          start={
            <Block
              w="0.6rem"
              h="0.6rem"
              borderRadius="9999px"
              flexShrink={0}
              style={{ background: line.color }}
            />
          }
          end={isSearching ? <Spinner size={16} /> : undefined}
        />
        {props.canRemove ? (
          <IconButton
            type="button"
            aria-label="Remove this line"
            onPress={() => props.dispatch({ name: "removed", id: line.id })}
          >
            <X size={16} />
          </IconButton>
        ) : null}
      </Block>

      {line.failure ? (
        // A failed line keeps the words that failed, so retyping them is not
        // a change and would never search again. The retry lives here
        // because the results block below it does not exist to hold one.
        <Block grid cols="1fr auto" alignItems="center" gap="sm" pt="xs">
          <ErrorNote fontSize="xs">{line.failure}</ErrorNote>
          <IconButton
            type="button"
            aria-label="Try this search again"
            onPress={() => props.dispatch({ name: "refreshed", id: line.id })}
          >
            <MagnifyingGlass size={16} />
          </IconButton>
        </Block>
      ) : null}
      {line.notice ? (
        <Text as="p" fontSize="xs" color="text-muted" pt="xs">
          {line.notice}
        </Text>
      ) : null}

      {line.status === "answered" && line.findings.length === 0 ? (
        <Text as="p" fontSize="xs" color="text-muted" pt="xs">
          Nothing here by that name.
        </Text>
      ) : null}

      {line.findings.length > 0 ? (
        // A chain search returns dozens of branches. Capping the list and
        // scrolling inside it keeps every OTHER line of the panel reachable,
        // instead of burying the next question under this one's answers.
        <Block pt="xs" maxH="15rem" overflowY="auto">
          <Block grid cols="auto 1fr auto" alignItems="center" gap="sm" py="xs">
            <Checkbox
              checked={allShown}
              onToggle={() => props.dispatch({ name: "allToggled", id: line.id })}
              label="Show all on the map"
            />
            <Text fontSize="xs" fontWeight="550" color="text-muted">
              Show all ({line.findings.length})
            </Text>
            <IconButton
              type="button"
              aria-label="Search this view again"
              onPress={() => props.dispatch({ name: "refreshed", id: line.id })}
            >
              <MagnifyingGlass size={16} />
            </IconButton>
          </Block>
          {line.findings.map((finding) => {
            const detail = detailOf(finding, props.now);
            return (
              <Block key={finding.id} grid cols="auto 1fr" alignItems="start" gap="sm" py="xs">
                <Block pt="0.15rem">
                  <Checkbox
                    checked={line.shownIds.includes(finding.id)}
                    onToggle={() =>
                      props.dispatch({ name: "toggled", id: line.id, findingId: finding.id })
                    }
                    label={`Show ${finding.name} on the map`}
                  />
                </Block>
                <Button
                  type="button"
                  onPress={() => props.onFocusFinding(finding)}
                  w="100%"
                  minW={0}
                  px={0}
                  // The button centres its slots by default, which would let
                  // each row's left edge drift with the length of its text.
                  justifyContent="start"
                  borderRadius="xs"
                  title="Centre the map here"
                >
                  {/* The button lays its own slots out in a column, so the
                      row's three lines stack inside one child of it. */}
                  <Block grid justifyItems="start" minW={0} textAlign="start">
                    <Text fontSize="sm" fontWeight="550" color="text-primary">
                      {finding.name}
                    </Text>
                    {detail.hours ? (
                      <Text
                        fontSize="xs"
                        fontWeight="550"
                        color={detail.verdict.phase === "closed" ? "danger" : "text-muted"}
                      >
                        {detail.hours}
                      </Text>
                    ) : null}
                    {detail.line ? (
                      <Text fontSize="xs" color="text-muted">
                        {detail.line}
                      </Text>
                    ) : null}
                  </Block>
                </Button>
              </Block>
            );
          })}
        </Block>
      ) : null}
    </Block>
  );
}
