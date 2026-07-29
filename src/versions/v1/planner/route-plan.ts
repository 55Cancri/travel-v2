import type { RouteVia } from "entities/trips/types";
import {
  fetchRide,
  fetchRoadRoute,
  metersBetween,
  nearestVertex,
  straightRoute,
  WALK_LIMIT_METERS,
  type RoadRoute,
  type TransitLeg,
} from "entities/routing";

// Route math for the day route editor. A day's plan becomes a list of
// parts: walking CHAINS (consecutive close-together stops with their
// locked vias, road-fitted by the public FOSSGIS OSRM instance and
// draggable to insert vias) split apart by RIDES (hops too long to walk,
// planned by Transitous as transit itineraries). Also attributes a grabbed
// point on a chain's line to the leg it belongs to so a new via lands
// between the right pair of waypoints.

export type RouteStop = { itemId: string; lng: number; lat: number };

export type RouteWaypoint =
  | { kind: "stop"; itemId: string; lng: number; lat: number }
  | { kind: "via"; via: RouteVia };

export const waypointCoord = (waypoint: RouteWaypoint): [number, number] =>
  waypoint.kind === "stop"
    ? [waypoint.lng, waypoint.lat]
    : [waypoint.via.lng, waypoint.via.lat];

// Stops in day order, each followed by its anchored vias, sliced into
// walking chains wherever a leg exceeds the walk limit (that leg becomes a
// ride). Vias anchored to a missing stop, to the final stop (no leg to
// bend), or to a leg that turned into a ride drop out here rather than
// bending the wrong line. Single-stop chains (a stop between two rides)
// carry no walk of their own and vanish.
const splitStops = (stops: RouteStop[], vias: RouteVia[]) => {
  const skeleton: Array<
    | { kind: "chain"; waypoints: RouteWaypoint[] }
    | { kind: "ride"; from: RouteStop; to: RouteStop }
  > = [];
  let chain: RouteWaypoint[] = [];
  stops.forEach((stop, idx) => {
    chain.push({ kind: "stop", ...stop });
    if (idx === stops.length - 1) return;
    const next = stops[idx + 1];
    if (metersBetween(stop, next) > WALK_LIMIT_METERS) {
      if (chain.length >= 2) skeleton.push({ kind: "chain", waypoints: chain });
      skeleton.push({ kind: "ride", from: stop, to: next });
      chain = [];
      return;
    }
    for (const via of vias) {
      if (via.afterItemId === stop.itemId) chain.push({ kind: "via", via });
    }
  });
  if (chain.length >= 2) skeleton.push({ kind: "chain", waypoints: chain });
  return skeleton;
};

export type DayRoutePart =
  | { kind: "chain"; waypoints: RouteWaypoint[]; road: RoadRoute }
  | { kind: "ride"; from: RouteStop; to: RouteStop; legs: TransitLeg[] };

// Plans the whole day: chains fit to roads, rides planned as transit, all
// requests in flight at once. onUpdate fires immediately with straight
// placeholder geometry (scope changes feel instant), again as each part's
// answer lands, and one final time with settled=true so the caller knows
// whether anything had to stay a straight line. Nothing fires after abort.
export const planDayRoute = (
  stops: RouteStop[],
  vias: RouteVia[],
  dateIso: string,
  signal: AbortSignal,
  onUpdate: (parts: DayRoutePart[], settled: boolean, failed: boolean) => void,
) => {
  const parts: DayRoutePart[] = splitStops(stops, vias).map((part) =>
    part.kind === "chain"
      ? { kind: "chain", waypoints: part.waypoints, road: straightRoute(part.waypoints.map(waypointCoord)) }
      : {
          kind: "ride",
          from: part.from,
          to: part.to,
          legs: [
            {
              mode: "ride",
              line: [
                [part.from.lng, part.from.lat],
                [part.to.lng, part.to.lat],
              ],
            },
          ],
        },
  );
  onUpdate(parts, false, false);
  let failed = false;
  const settling = parts.map((part, idx) => {
    const fetched =
      part.kind === "chain"
        ? fetchRoadRoute(part.waypoints.map(waypointCoord), signal).then((road) => {
            parts[idx] = { ...part, road };
          })
        : fetchRide(part.from, part.to, dateIso, signal).then((legs) => {
            parts[idx] = { ...part, legs };
          });
    return fetched
      .then(() => {
        if (!signal.aborted) onUpdate(parts, false, failed);
      })
      .catch((error: unknown) => {
        // An abort is flow control (the scope changed); a real failure
        // keeps this part's straight line and is reported once settled.
        if (signal.aborted) return;
        failed = true;
        console.warn("[map] route part failed, keeping straight line:", error);
      });
  });
  Promise.all(settling).then(() => {
    if (!signal.aborted) onUpdate(parts, true, failed);
  });
};

// Which leg was grabbed: the pair of consecutive waypoints whose stretch of
// line contains the vertex nearest the grab point. Returns the anchor the
// new via needs (the stop it follows, and the via it slots in after when
// the leg segment starts at one).
export const legAt = (
  route: RoadRoute,
  waypoints: RouteWaypoint[],
  lng: number,
  lat: number,
) => {
  if (waypoints.length < 2) return null;
  const vertex = nearestVertex(route.line, lng, lat);
  let leg = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (vertex >= route.waypointVertex[i]) leg = i;
  }
  const start = waypoints[leg];
  if (start.kind === "stop") {
    return { legIndex: leg, afterItemId: start.itemId, insertAfterViaId: undefined };
  }
  return {
    legIndex: leg,
    afterItemId: start.via.afterItemId,
    insertAfterViaId: start.via.id,
  };
};
