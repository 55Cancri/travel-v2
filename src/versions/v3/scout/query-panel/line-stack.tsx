import type { Finding, SearchScope } from "../find-places";
import type { ScoutAction, ScoutLine } from "../lines";
import { QueryLine } from "./query-line";
import { RouteStrip } from "./route-strip";

// The route summary and the query lines, the search surfaces' shared
// body: the floating panel and the slide-out sidebar render exactly this
// (the phone sheet arranges its own copy around its suggestions).
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
  return (
    <>
      {props.edgeCount > 0 ? (
        <RouteStrip
          count={props.edgeCount}
          notice={props.routeNotice}
          onClear={props.onClearRoute}
          onUndo={props.onUndoEdge}
        />
      ) : null}
      {props.lines.map((line) => (
        <QueryLine
          key={line.id}
          line={line}
          canRemove={props.lines.length > 1}
          scopeOf={props.scopeOf}
          dispatch={props.dispatch}
          onFocusFinding={props.onFocusFinding}
          now={props.now}
          mapReady={props.mapReady}
        />
      ))}
    </>
  );
}
