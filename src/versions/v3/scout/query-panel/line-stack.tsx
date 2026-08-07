import * as React from "react";
import { Block } from "atoms";
import type { Finding, SearchScope } from "../find-places";
import type { LineSet, ScoutAction } from "../lines";
import { AddPlaceRow } from "./add-place-row";
import { QueryInput } from "./query-input";
import { QueryResults } from "./query-results";
import { RouteStrip } from "./route-strip";

// The search surfaces' shared body: the route summary, the INPUT GROUP
// (every line's field stacked together, sticky, with the Add place
// affordance as its last row), and below it ONE results region speaking
// for the active line. The map stays the aggregate of every line's
// ticked pins; this list is the active query's workspace, and the input
// color dots carry the mapping.
export function LineStack(props: {
  view: LineSet;
  scopeOf: () => SearchScope | null;
  dispatch: (action: ScoutAction) => void;
  onFocusFinding: (finding: Finding) => void;
  now: Temporal.Instant;
  mapReady: boolean;
  edgeCount: number;
  routeNotice: string | null;
  onClearRoute: () => void;
  onUndoEdge: () => void;
}) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  // Adding is an intent to type: the fresh line appends below and its
  // input (the last one in the group once React commits) takes focus,
  // which also claims the results region for it.
  const addLine = () => {
    props.dispatch({ name: "added" });
    requestAnimationFrame(() => {
      const inputs = rootRef.current?.querySelectorAll<HTMLInputElement>(
        'input[aria-label="What to find on the map"]',
      );
      inputs?.[inputs.length - 1]?.focus();
    });
  };

  const active =
    props.view.lines.find((line) => line.id === props.view.activeId) ?? props.view.lines[0];

  return (
    <Block ref={rootRef}>
      {props.edgeCount > 0 ? (
        <RouteStrip
          count={props.edgeCount}
          notice={props.routeNotice}
          onClear={props.onClearRoute}
          onUndo={props.onUndoEdge}
        />
      ) : null}
      {/* Sticky as a GROUP: however deep the results run, every field and
          the Add place row stay reachable, results sliding under the
          shell-colored strip (which bleeds the same gutter the row
          highlights do). */}
      <Block
        position="sticky"
        insetBlockStart="0"
        zIndex={2}
        bg="surface-shell"
        py="xs"
        px="1lh"
        mx="-1lh"
      >
        {props.view.lines.map((line) => (
          <QueryInput
            key={line.id}
            line={line}
            canRemove={props.view.lines.length > 1}
            scopeOf={props.scopeOf}
            dispatch={props.dispatch}
            onAddLine={addLine}
            mapReady={props.mapReady}
          />
        ))}
        <AddPlaceRow onAdd={addLine} />
      </Block>
      <QueryResults
        line={active}
        dispatch={props.dispatch}
        onFocusFinding={props.onFocusFinding}
        now={props.now}
      />
    </Block>
  );
}
