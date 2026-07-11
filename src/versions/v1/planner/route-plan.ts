import type { RouteVia } from "entities/trips/types";
import { fetchRide, type TransitLeg } from "./transit-plan";

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

// Beyond this a leg stops being a walk and becomes a transit ride
// (roughly a 20-minute walk).
export const WALK_LIMIT_METERS = 1500;

// Equirectangular approximation: plenty at itinerary scale, where the only
// question is "walkable or not".
const metersBetween = (a: { lng: number; lat: number }, b: { lng: number; lat: number }) => {
  const scale = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dLng = (b.lng - a.lng) * scale;
  const dLat = b.lat - a.lat;
  return Math.hypot(dLng, dLat) * 111320;
};

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

// The fetched line plus, per request waypoint, the index of its nearest
// line vertex: the split points that let a grabbed vertex resolve to a leg.
export type RoadRoute = { line: number[][]; waypointVertex: number[] };

// A straight polyline through the waypoints wears the same shape, so leg
// attribution works before the router answers (or when it fails).
export const straightRoute = (waypoints: RouteWaypoint[]): RoadRoute => ({
  line: waypoints.map(waypointCoord),
  waypointVertex: waypoints.map((_, idx) => idx),
});

const FOOT_ROUTER = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";
const roadRouteCache = new Map<string, RoadRoute>();

// Squared equirectangular distance: monotonic in true distance at city
// scale, which is all nearest-point comparisons need.
const flatDistanceSq = (a: number[], lng: number, lat: number) => {
  const scale = Math.cos((lat * Math.PI) / 180);
  const dLng = (a[0] - lng) * scale;
  const dLat = a[1] - lat;
  return dLng * dLng + dLat * dLat;
};

export const nearestVertex = (
  line: number[][],
  lng: number,
  lat: number,
  fromIdx = 0,
) => {
  let best = fromIdx;
  let bestD = Infinity;
  for (let i = fromIdx; i < line.length; i++) {
    const d = flatDistanceSq(line[i], lng, lat);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
};

// The closest point ON the line (projected onto its segments, not just the
// nearest vertex, so it stays glued to straight fallback lines too): where
// the hover grab-handle rides.
export const nearestPointOnLine = (line: number[][], lng: number, lat: number) => {
  if (line.length === 0) return null;
  const scale = Math.cos((lat * Math.PI) / 180);
  let best: [number, number] = [line[0][0], line[0][1]];
  let bestD = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i];
    const [bx, by] = line[i + 1];
    const dx = (bx - ax) * scale;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t =
      lenSq === 0
        ? 0
        : Math.min(1, Math.max(0, (((lng - ax) * scale) * dx + (lat - ay) * dy) / lenSq));
    const cx = ax + (bx - ax) * t;
    const cy = ay + (by - ay) * t;
    const ddx = (lng - cx) * scale;
    const ddy = lat - cy;
    const d = ddx * ddx + ddy * ddy;
    if (d < bestD) {
      bestD = d;
      best = [cx, cy];
    }
  }
  return best;
};

export const fetchRoadRoute = async (
  waypoints: RouteWaypoint[],
  signal: AbortSignal,
) => {
  const coords = waypoints.map(waypointCoord);
  const key = coords.map((pair) => pair.join(",")).join(";");
  const cached = roadRouteCache.get(key);
  if (cached) return cached;
  const res = await fetch(
    `${FOOT_ROUTER}/${key}?overview=full&geometries=geojson&steps=false`,
    { signal },
  );
  if (!res.ok) throw new Error(`router responded ${res.status}`);
  const body = (await res.json()) as {
    code?: string;
    routes?: Array<{ geometry?: { coordinates?: number[][] } }>;
    waypoints?: Array<{ location?: [number, number] }>;
  };
  const line = body.routes?.[0]?.geometry?.coordinates;
  if (body.code !== "Ok" || !line || line.length < 2) {
    throw new Error(`router returned no route (${body.code ?? "no code"})`);
  }
  // Searching each snapped waypoint from the previous one's vertex keeps
  // the indices monotonic even when the route crosses itself.
  const waypointVertex: number[] = [];
  let cursor = 0;
  for (let i = 0; i < coords.length; i++) {
    const snapped = body.waypoints?.[i]?.location ?? coords[i];
    cursor = nearestVertex(line, snapped[0], snapped[1], cursor);
    waypointVertex.push(cursor);
  }
  const route: RoadRoute = { line, waypointVertex };
  roadRouteCache.set(key, route);
  return route;
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
      ? { kind: "chain", waypoints: part.waypoints, road: straightRoute(part.waypoints) }
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
        ? fetchRoadRoute(part.waypoints, signal).then((road) => {
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
