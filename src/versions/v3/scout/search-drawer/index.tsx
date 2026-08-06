import { Block, Plus, Text } from "atoms";
import { IconButton } from "alloys";
import type { Finding, SearchScope } from "../find-places";
import type { ScoutAction, ScoutLine } from "../lines";
import { QueryLine } from "../query-panel/query-line";
import { RouteStrip } from "../query-panel/route-strip";
import { Sheet } from "../sheet";
import { SuggestionRows } from "./suggestion-rows";

// The phone's search surface: the same query lines the desktop panel
// renders, in a sheet, with saved / often / recent suggestions on top
// until typing narrows them. One shared line state feeds both surfaces,
// so a search started on the phone is already there when the panel
// returns on a wide window.

export function SearchDrawer(props: {
  open: boolean;
  onClose: () => void;
  lines: ScoutLine[];
  scopeOf: () => SearchScope | null;
  dispatch: (action: ScoutAction) => void;
  onFocusFinding: (finding: Finding) => void;
  now: Temporal.Instant;
  mapReady: boolean;
  // The route summary the desktop panel carries; the phone reads it here
  // or nowhere.
  edgeCount: number;
  routeNotice: string | null;
  onClearRoute: () => void;
  onUndoEdge: () => void;
}) {
  const first = props.lines[0];

  return (
    <Sheet open={props.open} onClose={props.onClose} label="Search the map" size="tall">
      {props.edgeCount > 0 ? (
        <RouteStrip
          count={props.edgeCount}
          notice={props.routeNotice}
          onClear={props.onClearRoute}
          onUndo={props.onUndoEdge}
        />
      ) : null}
      {/* A header row of its own, so the plus stands in the same corner
          whether or not suggestions render below it. */}
      <Block grid cols="1fr auto" alignItems="center" pt="xs">
        <Text fontSize="md" fontWeight="550" color="text-muted">
          Search
        </Text>
        <IconButton
          type="button"
          aria-label="Add a query line"
          onPress={() => props.dispatch({ name: "added" })}
        >
          <Plus size={18} />
        </IconButton>
      </Block>
      <SuggestionRows
        typed={first.typed}
        onPick={(query) => props.dispatch({ name: "typed", id: first.id, text: query })}
      />
      {props.lines.map((line, i) => (
        <QueryLine
          key={line.id}
          line={line}
          canRemove={props.lines.length > 1}
          primary={i === 0}
          scopeOf={props.scopeOf}
          dispatch={props.dispatch}
          onFocusFinding={(finding) => {
            // Flying somewhere is the point of the tap; the sheet would
            // only hide the landing.
            props.onFocusFinding(finding);
            props.onClose();
          }}
          now={props.now}
          mapReady={props.mapReady}
        />
      ))}
    </Sheet>
  );
}
