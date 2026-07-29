// The road half of routing: the public FOSSGIS OSRM foot router, plus the
// line geometry every caller of it needs (nearest vertex, nearest point on
// the line, a straight stand-in before the router answers).
//
// Coordinates in, coordinates out. An earlier version took a trip's own
// waypoint union, which tied a network client to one screen's data model
// for no gain: the router only ever wanted the pairs.

export type Coord = [number, number];

// Beyond this a leg stops being a walk and becomes a transit ride (roughly
// a 20-minute walk).
export const WALK_LIMIT_METERS = 1500;

// Equirectangular approximation: plenty at itinerary scale, where the only
// question is "walkable or not".
export const metersBetween = (
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
) => {
  const scale = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dLng = (b.lng - a.lng) * scale;
  const dLat = b.lat - a.lat;
  return Math.hypot(dLng, dLat) * 111320;
};

// The fetched line plus, per request waypoint, the index of its nearest
// line vertex: the split points that let a grabbed vertex resolve to a leg.
export type RoadRoute = { line: number[][]; waypointVertex: number[] };

// A straight polyline through the waypoints wears the same shape, so leg
// attribution works before the router answers (or when it fails).
export const straightRoute = (coords: Coord[]): RoadRoute => ({
  line: coords.map((pair) => [pair[0], pair[1]]),
  waypointVertex: coords.map((_, idx) => idx),
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

export const fetchRoadRoute = async (coords: Coord[], signal: AbortSignal) => {
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
