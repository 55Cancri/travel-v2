// Transit legs for the day route, fetched from Transitous (the community
// MOTIS instance, keyless). One plan request per long hop returns a mixed
// itinerary: walks to and from stations plus the rides between them, each
// with its own polyline, line name, and brand color.

export type TransitLeg = {
  mode: "walk" | "ride";
  line: number[][];
  name?: string;
  color?: string;
};

const TRANSIT_ROUTER = "https://api.transitous.org/api/v1/plan";
const rideCache = new Map<string, TransitLeg[]>();

// Standard Google polyline decoding at the precision the response declares
// (MOTIS uses 7 digits, not the classic 5). Returns [lng, lat] pairs to
// match the rest of the route math.
const decodePolyline = (points: string, precision: number) => {
  const factor = 10 ** precision;
  const line: number[][] = [];
  let lat = 0;
  let lng = 0;
  let idx = 0;
  const nextDelta = () => {
    let result = 0;
    let shift = 0;
    let byte = 0x20;
    while (byte >= 0x20) {
      byte = points.charCodeAt(idx++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    }
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (idx < points.length) {
    lat += nextDelta();
    lng += nextDelta();
    line.push([lng / factor, lat / factor]);
  }
  return line;
};

type WirePlanLeg = {
  mode?: string;
  routeShortName?: string;
  routeLongName?: string;
  routeColor?: string;
  legGeometry?: { points?: string; precision?: number };
};

export const fetchRide = async (
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  departIso: string,
  signal: AbortSignal,
) => {
  const key = `${from.lng},${from.lat};${to.lng},${to.lat};${departIso}`;
  const cached = rideCache.get(key);
  if (cached) return cached;
  const query = new URLSearchParams({
    fromPlace: `${from.lat},${from.lng}`,
    toPlace: `${to.lat},${to.lng}`,
    time: departIso,
    numItineraries: "1",
    // Some hops have no transit at all (dunes, parks, small towns). A
    // direct walking itinerary from MOTIS's street router covers those;
    // the default direct-time cap is too small for the hops that reach
    // here (they already exceed the walk limit), so raise it.
    directModes: "WALK",
    maxDirectTime: "10800",
  });
  const res = await fetch(`${TRANSIT_ROUTER}?${query}`, { signal });
  if (!res.ok) throw new Error(`transit router responded ${res.status}`);
  const body = (await res.json()) as {
    itineraries?: Array<{ legs?: WirePlanLeg[] }>;
    direct?: Array<{ legs?: WirePlanLeg[] }>;
  };
  const wireLegs = body.itineraries?.[0]?.legs ?? body.direct?.[0]?.legs;
  if (!wireLegs?.length) throw new Error("transit router returned no itinerary");
  const legs: TransitLeg[] = [];
  for (const leg of wireLegs) {
    const points = leg.legGeometry?.points;
    if (!points) continue;
    const line = decodePolyline(points, leg.legGeometry?.precision ?? 5);
    if (line.length < 2) continue;
    if (leg.mode === "WALK") {
      legs.push({ mode: "walk", line });
    } else {
      legs.push({
        mode: "ride",
        line,
        name: leg.routeShortName ?? leg.routeLongName,
        color: leg.routeColor ? `#${leg.routeColor}` : undefined,
      });
    }
  }
  if (!legs.length) throw new Error("transit itinerary had no drawable legs");
  rideCache.set(key, legs);
  return legs;
};
