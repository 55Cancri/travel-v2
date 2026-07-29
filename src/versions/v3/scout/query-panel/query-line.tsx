import * as React from "react";
import { Block, Button, CaretRight, Input, MagnifyingGlass, Spinner, Text, X } from "atoms";
import { Checkbox, ErrorNote, IconButton } from "alloys";
import { findPlaces, MIN_QUERY_CHARS, type Finding, type SearchScope } from "../find-places";
import type { ScoutAction, ScoutLine } from "../lines";
import { ResultRow } from "./result-row";

// One line of the panel: what was typed, what it found, and which of those
// findings are on the map. The line owns its own search lifecycle (one
// debounce, one abort signal) and reports every result upward, so the panel
// above it holds the whole picture and no answer lives in two places.
//
// The search waits for a pause in typing rather than firing per keystroke:
// the map half of it runs against a public Overpass instance whose fair-use
// budget a per-keystroke sweep would burn through in one word.
const DEBOUNCE_MS = 600;

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
      // below, so this run repeats itself the moment the map has one,
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
        <Block pt="xs">
          <Block grid cols="auto 1fr auto" alignItems="center" gap="sm">
            <Checkbox
              checked={allShown}
              onToggle={() => props.dispatch({ name: "allToggled", id: line.id })}
              label="Show all on the map"
            />
            {/* The caret and the count are one target, the way a disclosure
                row usually is: a bare caret is a small thing to hit. */}
            <Button
              type="button"
              aria-expanded={line.expanded}
              onPress={() => props.dispatch({ name: "disclosed", id: line.id })}
              justifyContent="start"
              gap="xs"
              w="100%"
              minH="xl"
              px={0}
              borderRadius="xs"
              color="text-muted"
              _hover={{ "@media (hover: hover)": { color: "text-primary" } }}
            >
              <Block
                display="grid"
                placeItems="center"
                // A rotation, not a second glyph: the same caret turns, so
                // the two positions can never drift apart.
                _motion={{
                  // Starts where it belongs instead of swinging into place
                  // the first time a result list appears.
                  initial: false,
                  animate: { rotate: line.expanded ? 90 : 0 },
                  transition: { duration: 0.2, ease: "easeOut" },
                }}
              >
                <CaretRight size={14} />
              </Block>
              <Text fontSize="xs" fontWeight="550">
                Show all ({line.findings.length})
              </Text>
            </Button>
            <IconButton
              type="button"
              aria-label="Search this view again"
              onPress={() => props.dispatch({ name: "refreshed", id: line.id })}
            >
              <MagnifyingGlass size={16} />
            </IconButton>
          </Block>
          {/* The rows stay mounted and the box closes over them, rather
              than unmounting them on the way out. A disclosure that
              animates its own removal has to keep rendering the old props
              while it goes, so the row a press just changed would visibly
              revert as it folded away. */}
          <Block
            // The height tween needs a clipped box, or the rows spill out of
            // the container while it closes. The inner box is what scrolls,
            // so the clip and the scroll never fight.
            overflow="hidden"
            aria-hidden={!line.expanded}
            _motion={{
              initial: false,
              animate: {
                height: line.expanded ? "auto" : 0,
                opacity: line.expanded ? 1 : 0,
              },
              transition: line.expanded
                ? { duration: 0.3, ease: "easeOut" }
                : { duration: 0.2, ease: "easeIn" },
            }}
          >
            {/* A chain search returns dozens of branches. Capping the list
                and scrolling inside it keeps every OTHER line of the panel
                reachable, instead of burying the next question under this
                one's answers. */}
            <Block maxH="15rem" overflowY="auto">
              {line.findings.map((finding) => (
                <ResultRow
                  key={finding.id}
                  finding={finding}
                  checked={line.shownIds.includes(finding.id)}
                  now={props.now}
                  onToggle={() =>
                    props.dispatch({ name: "toggled", id: line.id, findingId: finding.id })
                  }
                  onFocus={() => props.onFocusFinding(finding)}
                />
              ))}
            </Block>
          </Block>
        </Block>
      ) : null}
    </Block>
  );
}
