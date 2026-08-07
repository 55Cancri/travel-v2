import * as React from "react";
import { Block, Input, Spinner, X } from "atoms";
import { IconButton } from "alloys";
import { findPlaces, MIN_QUERY_CHARS, type SearchScope } from "../find-places";
import type { ScoutAction, ScoutLine } from "../lines";

// One query line's INPUT: the field, its color dot, its remove button,
// and the search lifecycle (one debounce, one abort signal). Every
// mounted input keeps searching; which line's RESULTS render is the
// results region's business (`focused` is dispatched from here so
// clicking into a field claims that region).
//
// Short, because what this delay gates is the FAST source: the engine
// answers in about a hundred milliseconds and caches, so this pause was
// the largest cost we control over the whole search. The sweep, when
// asked for, holds itself back separately inside findPlaces.
const DEBOUNCE_MS = 150;

export function QueryInput(props: {
  line: ScoutLine;
  canRemove: boolean;
  scopeOf: () => SearchScope | null;
  dispatch: (action: ScoutAction) => void;
  // Appends a fresh query line below (the "+ Add place" move), reachable
  // from the keyboard as Cmd+Enter without leaving this input.
  onAddLine?: () => void;
  mapReady: boolean;
}) {
  const line = props.line;
  const isSearching = line.status === "searching";

  // What this line has already launched a search for. A REF, not a field on
  // the line: the effect must not be keyed on anything its own results
  // change. It was, and reporting the fast half of a search tore down the
  // slow half that was still running, so the map sweep was aborted before it
  // ever issued a request.
  const launchedRef = React.useRef("");

  React.useEffect(() => {
    const text = line.typed.trim();
    if (text.length < MIN_QUERY_CHARS) {
      launchedRef.current = "";
      if (line.status !== "idle") props.dispatch({ name: "emptied", id: line.id });
      return;
    }
    // The run id makes a refresh press count as a different search for
    // the same words, and a granted sweep ask re-runs them too.
    const attempt = `${line.runId}:${line.sweepAsked ? 1 : 0}:${text}`;
    if (launchedRef.current === attempt) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const scope = props.scopeOf();
      // No map yet means no view to search inside. mapReady is a dependency
      // below, so this run repeats itself the moment the map has one,
      // instead of leaving typed words silently unsearched forever.
      if (!scope) return;
      launchedRef.current = attempt;
      props.dispatch({ name: "searching", id: line.id, query: text });
      try {
        // Reports once per source, so the engine's answer paints while
        // any asked-for sweep is still out.
        await findPlaces(
          text,
          scope,
          controller.signal,
          (results) => {
            if (controller.signal.aborted) return;
            props.dispatch({ name: "answered", id: line.id, query: text, results });
          },
          line.sweepAsked,
        );
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
  }, [line.typed, line.runId, line.sweepAsked, props.mapReady]);

  return (
    <Block grid cols="1fr auto" alignItems="center" gap="xs" pb="xs">
      <Input
        value={line.typed}
        placeholder="Search places"
        aria-label="What to find on the map"
        py="0.35lh"
        // The dot's gaps are symmetric: edge to dot equals dot to text
        // (both the input's own 0.5lh pad). A darker well than the
        // shell it sits on, so the field reads as the surface's one
        // place to type.
        columnGap="sm"
        bg="surface-page"
        onFocus={() => props.dispatch({ name: "focused", id: line.id })}
        onChange={(event) =>
          props.dispatch({ name: "typed", id: line.id, text: event.target.value })
        }
        onKeyDown={(event) => {
          // Arrows and plain Enter belong to the results region's
          // listener; only the add-a-line chord is the input's own.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && props.onAddLine) {
            event.preventDefault();
            props.onAddLine();
          }
        }}
        start={
          <Block
            w="0.6rem"
            h="0.6rem"
            borderRadius="9999px"
            flexShrink={0}
            style={{ background: line.color }}
          />
        }
        end={isSearching || line.sweeping ? <Spinner size={16} /> : undefined}
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
  );
}
