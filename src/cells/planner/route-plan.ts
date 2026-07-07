import type { RouteVia } from "entities/trips/types";

// Pure route math for the day route editor: assembling the waypoint list
// (stops interleaved with locked vias), fetching road-following geometry
// from the public FOSSGIS OSRM instance (walking profile: these are city
// itineraries; the instance ignores the profile segment of the path), and
// attributing a grabbed point on the line to the leg it belongs to so a
// new via lands between the right pair of waypoints.

export type RouteStop = { itemId: string; lng: number; lat: number };

export type RouteWaypoint =
  | { kind: "stop"; itemId: string; lng: number; lat: number }
  | { kind: "via"; via: RouteVia };

export const waypointCoord = (waypoint: RouteWaypoint): [number, number] =>
  waypoint.kind === "stop"
    ? [waypoint.lng, waypoint.lat]
    : [waypoint.via.lng, waypoint.via.lat];

// Stops in day order, each followed by its anchored vias in array order.
// Vias anchored to a missing stop (item deleted, moved off the day) or to
// the final stop (no leg to bend) drop out here rather than bending the
// wrong leg.
export const buildWaypoints = (stops: RouteStop[], vias: RouteVia[]) => {
  const waypoints: RouteWaypoint[] = [];
  stops.forEach((stop, idx) => {
    waypoints.push({ kind: "stop", ...stop });
    if (idx === stops.length - 1) return;
    for (const via of vias) {
      if (via.afterItemId === stop.itemId) waypoints.push({ kind: "via", via });
    }
  });
  return waypoints;
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
