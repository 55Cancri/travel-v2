import * as React from "react";
import { Block } from "atoms";
import type { Finding, SearchScope } from "../find-places";
import type { ScoutAction, ScoutLine } from "../lines";
import { AddPlaceRow } from "./add-place-row";
import { QueryLine } from "./query-line";
import { RouteStrip } from "./route-strip";

// The route summary, the query lines, and the "+ Add place" growing edge:
// the search surfaces' shared body. The floating panel and the slide-out
// sidebar render exactly this (the phone sheet arranges its own copy
// around its suggestions).
export function LineStack(props: {
  lines: ScoutLine[];
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
  // input (the last one in the stack once React commits) takes focus.
  const addLine = () => {
    props.dispatch({ name: "added" });
    requestAnimationFrame(() => {
      const inputs = rootRef.current?.querySelectorAll<HTMLInputElement>(
        'input[aria-label="What to find on the map"]',
      );
      inputs?.[inputs.length - 1]?.focus();
    });
  };

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
      {props.lines.map((line, i) => (
        <QueryLine
          key={line.id}
          line={line}
          canRemove={props.lines.length > 1}
          primary={i === 0}
          scopeOf={props.scopeOf}
          dispatch={props.dispatch}
          onFocusFinding={props.onFocusFinding}
          onAddLine={addLine}
          now={props.now}
          mapReady={props.mapReady}
        />
      ))}
      <AddPlaceRow onAdd={addLine} />
    </Block>
  );
}
