import { Block, Plus, Text } from "atoms";
import { IconButton } from "alloys";
import type { Finding, SearchScope } from "../find-places";
import type { LineSet, ScoutAction } from "../lines";
import { QueryInput } from "../query-panel/query-input";
import { QueryResults } from "../query-panel/query-results";
import { RouteStrip } from "../query-panel/route-strip";
import { Sheet } from "../sheet";
import { SuggestionRows } from "./suggestion-rows";

// The phone's search surface: the same input group and active-line
// results the desktop surfaces render, in a sheet, with saved / often /
// recent suggestions between them until typing narrows them. One shared
// line state feeds every surface, so a search started on the phone is
// already there when the panel returns on a wide window.

export function SearchDrawer(props: {
  open: boolean;
  onClose: () => void;
  view: LineSet;
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
  const active =
    props.view.lines.find((line) => line.id === props.view.activeId) ?? props.view.lines[0];

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
          // Glyph flush with the content edge, same vertical line as the
          // row remove glyphs below.
          mr="calc((18px - 1.5rlh) / 2)"
        >
          <Plus size={18} />
        </IconButton>
      </Block>
      {props.view.lines.map((line) => (
        <QueryInput
          key={line.id}
          line={line}
          canRemove={props.view.lines.length > 1}
          scopeOf={props.scopeOf}
          dispatch={props.dispatch}
          onAddLine={() => props.dispatch({ name: "added" })}
          mapReady={props.mapReady}
        />
      ))}
      <SuggestionRows
        typed={active.typed}
        onPick={(query) => props.dispatch({ name: "typed", id: active.id, text: query })}
      />
      <QueryResults
        line={active}
        dispatch={props.dispatch}
        onFocusFinding={(finding) => {
          // Flying somewhere is the point of the tap; the sheet would
          // only hide the landing.
          props.onFocusFinding(finding);
          props.onClose();
        }}
        now={props.now}
      />
    </Sheet>
  );
}
