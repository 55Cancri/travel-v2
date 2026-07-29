import * as React from "react";
import { Block } from "atoms";
import { useDb } from "entities/trips/store";
import { MIN_SEARCH_ZOOM, type Finding, type SearchScope } from "./find-places";
import { openingLines, scoutReducer } from "./lines";
import { MapCanvas, type ScoutMapApi, type ScoutPin } from "./map-canvas";
import { openLine, openTag, openVerdict, useMinuteClock } from "./open-now";
import { QueryPanel } from "./query-panel";
import { planRoute, type RouteLeg, type Waypoint } from "./route";
import { UiVersionPicker } from "../../picker";

// Generation v3: the map IS the screen, and the plan floats over it. A line
// in the panel asks the map a question ("media markt", or one address), and
// whichever answers get ticked become pins. Everything the panel knows about
// where to search it reads from the map at the moment it asks, so panning
// somewhere new and searching again needs no wiring between the two.

// Where the map opens on a device that has never panned it. Trip data is the
// better guess than any hard-coded city, so the first place the plan already
// knows wins.
const FALLBACK_HOME = { lng: 4.89, lat: 52.37 };
// Anything closer than this and a result row is looking at the ground.
const FOCUS_ZOOM = 16;

export function Scout() {
  const db = useDb();
  const [lines, dispatch] = React.useReducer(scoutReducer, undefined, openingLines);
  const now = useMinuteClock();
  const [mapReady, storeMapReady] = React.useState(false);
  const [waypoints, storeWaypoints] = React.useState<Waypoint[]>([]);
  const [route, storeRoute] = React.useState<RouteLeg[]>([]);
  const [routeNotice, storeRouteNotice] = React.useState<string | null>(null);
  const mapApiRef = React.useRef<ScoutMapApi | null>(null);

  // The route follows the points: every Cmd-click re-asks the routers, and
  // a run superseded mid-flight is abandoned rather than allowed to paint
  // a stale path over the newer one.
  React.useEffect(() => {
    if (waypoints.length < 2) {
      storeRoute([]);
      storeRouteNotice(null);
      return;
    }
    const controller = new AbortController();
    planRoute(waypoints, Temporal.Now.plainDateISO().toString(), controller.signal)
      .then((plan) => {
        if (controller.signal.aborted) return;
        storeRoute(plan.legs);
        storeRouteNotice(plan.notice ?? null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("[scout] route planning failed:", error);
        storeRouteNotice("The route could not be planned.");
      });
    return () => controller.abort();
  }, [waypoints]);

  const placed = Object.values(db.items).find((item) => item.place);
  const home = placed?.place ?? FALLBACK_HOME;

  const scopeOf = (): SearchScope | null => {
    const api = mapApiRef.current;
    const view = api?.view();
    const bias = api?.center();
    if (!api || !view || !bias) return null;
    return { view, bias, scanMap: api.zoom() >= MIN_SEARCH_ZOOM };
  };

  const focusFinding = (finding: Finding) => {
    const api = mapApiRef.current;
    api?.flyTo(finding, Math.max(api.zoom(), FOCUS_ZOOM));
  };

  const pins: ScoutPin[] = lines.flatMap((line) =>
    line.findings
      .filter((finding) => line.shownIds.includes(finding.id))
      .map((finding) => {
        const verdict = openVerdict(finding, now);
        return {
          // Two lines can find the same shop; each keeps its own pin in its
          // own color rather than one of them silently winning.
          id: `${line.id}:${finding.id}`,
          lng: finding.lng,
          lat: finding.lat,
          color: line.color,
          phase: verdict.phase,
          name: finding.name,
          tag: openTag(verdict),
          notes: [openLine(verdict), finding.category, finding.address, finding.phone].filter(
            (note): note is string => Boolean(note),
          ),
          website: finding.website,
        };
      }),
  );

  return (
    <Block position="fixed" inset="0" overflow="hidden">
      <MapCanvas
        pins={pins}
        route={route}
        waypoints={waypoints}
        onRoutePoint={(at) =>
          storeWaypoints((current) =>
            current.concat({ id: crypto.randomUUID(), lng: at.lng, lat: at.lat }),
          )
        }
        home={home}
        onReady={storeMapReady}
        apiRef={mapApiRef}
      />
      <QueryPanel
        lines={lines}
        scopeOf={scopeOf}
        dispatch={dispatch}
        onFocusFinding={focusFinding}
        now={now}
        mapReady={mapReady}
        routeCount={waypoints.length}
        routeNotice={routeNotice}
        onClearRoute={() => storeWaypoints([])}
        onUndoRoutePoint={() => storeWaypoints((current) => current.slice(0, -1))}
      />
      {/* The way out of a generation that has gone wrong, kept clear of the
          map's own controls in the opposite corner. */}
      <Block
        position="absolute"
        top="sm"
        insetInlineEnd="sm"
        zIndex={20}
        borderRadius="sm"
        bg="surface-panel"
        boxShadow="0 2px 10px rgba(0, 0, 0, 0.18)"
      >
        <UiVersionPicker />
      </Block>
    </Block>
  );
}
