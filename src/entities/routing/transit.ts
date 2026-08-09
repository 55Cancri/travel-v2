// Transit legs for the day route, fetched from Transitous (the community
// MOTIS instance, keyless). One plan request per long hop returns a mixed
// itinerary: walks to and from stations plus the rides between them, each
// with its own polyline, line name, and brand color.

// A stop the ride calls at (boarding and alighting included), with its
// scheduled time where the feed provides one.
export type RideStop = { name: string; lng: number; lat: number; timeIso?: string };

export type TransitLeg = {
  mode: "walk" | "ride";
  line: number[][];
  name?: string;
  color?: string;
  // What carries you ("Bus", "Train", ...) and where it is headed, for the
  // hover tooltip on the drawn line.
  vehicle?: string;
  headsign?: string;
  // Scheduled leg times as instants plus the stop's IANA zone (display
  // formats at the UI boundary), and whether the feed marked them live.
  departIso?: string;
  arriveIso?: string;
  tz?: string;
  live?: boolean;
  stops?: RideStop[];
  // Departures of the same line, same direction, after this one: the
  // "next buses" the tooltip offers.
  nextDeparts?: string[];
};

const VEHICLE_LABELS: Record<string, string> = {
  BUS: "Bus",
  COACH: "Coach",
  TRAM: "Tram",
  SUBWAY: "Metro",
  METRO: "Metro",
  FERRY: "Ferry",
  RAIL: "Train",
  REGIONAL_RAIL: "Train",
  REGIONAL_FAST_RAIL: "Train",
  HIGHSPEED_RAIL: "Train",
  LONG_DISTANCE: "Train",
  NIGHT_RAIL: "Night train",
  CABLE_CAR: "Cable car",
  FUNICULAR: "Funicular",
  AIRPLANE: "Flight",
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
      result += (byte & 0x1f) * 2 ** shift;
      shift += 5;
    }
    // Arithmetic zigzag decode: 32-bit bitwise operators corrupt
    // precision-7 longitudes past ~107 degrees (Tokyo comes back at -75).
    return result % 2 === 1 ? -(result + 1) / 2 : result / 2;
  };
  while (idx < points.length) {
    lat += nextDelta();
    lng += nextDelta();
    line.push([lng / factor, lat / factor]);
  }
  return line;
};

type WireStop = {
  name?: string;
  stopId?: string;
  lat?: number;
  lon?: number;
  tz?: string;
  arrival?: string;
  departure?: string;
};

type WirePlanLeg = {
  mode?: string;
  routeShortName?: string;
  routeLongName?: string;
  routeColor?: string;
  headsign?: string;
  from?: WireStop;
  to?: WireStop;
  intermediateStops?: WireStop[];
  startTime?: string;
  endTime?: string;
  realTime?: boolean;
  legGeometry?: { points?: string; precision?: number };
};

const STOP_TIMES = "https://api.transitous.org/api/v1/stoptimes";

type WireStopTime = {
  routeShortName?: string;
  headsign?: string;
  place?: { departure?: string };
};

// The boarding stop's departures board, narrowed to the same line and
// direction. ISO instants compare as strings.
const fetchNextDeparts = async (
  stopId: string,
  routeName: string | undefined,
  headsign: string | undefined,
  afterIso: string,
  signal: AbortSignal,
) => {
  const query = new URLSearchParams({ stopId, time: afterIso, n: "30" });
  const res = await fetch(`${STOP_TIMES}?${query}`, { signal });
  if (!res.ok) throw new Error(`stop times responded ${res.status}`);
  const body = (await res.json()) as { stopTimes?: WireStopTime[] };
  return (body.stopTimes ?? [])
    .filter((entry) => entry.routeShortName === routeName && entry.headsign === headsign)
    .map((entry) => entry.place?.departure)
    .filter((iso): iso is string => iso !== undefined && iso > afterIso)
    .slice(0, 3);
};

const rideStop = (stop: WireStop | undefined): RideStop | null =>
  stop && stop.lat !== undefined && stop.lon !== undefined
    ? {
        name: stop.name ?? "",
        lng: stop.lon,
        lat: stop.lat,
        timeIso: stop.departure ?? stop.arrival,
      }
    : null;

export const fetchRide = async (
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  dateIso: string,
  signal: AbortSignal,
  // MOTIS transit mode names (TRAM, BUS, RAIL, ...). Omitted means the
  // router's default, every transit mode.
  transitModes?: string[],
) => {
  const key = `${from.lng},${from.lat};${to.lng},${to.lat};${dateIso};${transitModes?.length ? transitModes.toSorted().join(",") : "TRANSIT"}`;
  const cached = rideCache.get(key);
  if (cached) return cached;
  // Depart mid-morning in the hop's own solar time: civil timezones sit
  // within an hour or two of longitude / 15, close enough to land the
  // schedule query in normal service hours on any continent (a fixed UTC
  // hour is 1am-4am in the Americas).
  const depart = Temporal.PlainDateTime.from(`${dateIso}T09:00:00`)
    .toZonedDateTime("UTC")
    .subtract({ hours: Math.round(from.lng / 15) })
    .toInstant()
    .toString();
  const query = new URLSearchParams({
    fromPlace: `${from.lat},${from.lng}`,
    toPlace: `${to.lat},${to.lng}`,
    time: depart,
    numItineraries: "1",
    // Some hops have no transit at all (dunes, parks, small towns). A
    // direct walking itinerary from MOTIS's street router covers those;
    // the default direct-time cap is too small for the hops that reach
    // here (they already exceed the walk limit), so raise it.
    directModes: "WALK",
    maxDirectTime: "10800",
  });
  if (transitModes?.length) query.set("transitModes", transitModes.join(","));
  const res = await fetch(`${TRANSIT_ROUTER}?${query}`, { signal });
  if (!res.ok) throw new Error(`transit router responded ${res.status}`);
  const body = (await res.json()) as {
    itineraries?: Array<{ legs?: WirePlanLeg[] }>;
    direct?: Array<{ legs?: WirePlanLeg[] }>;
  };
  const wireLegs = body.itineraries?.[0]?.legs ?? body.direct?.[0]?.legs;
  if (!wireLegs?.length) throw new Error("transit router returned no itinerary");
  const legs: TransitLeg[] = [];
  const boards: Array<{ ride: TransitLeg; stopId: string }> = [];
  for (const leg of wireLegs) {
    const points = leg.legGeometry?.points;
    if (!points) continue;
    const line = decodePolyline(points, leg.legGeometry?.precision ?? 5);
    if (line.length < 2) continue;
    if (leg.mode === "WALK") {
      legs.push({ mode: "walk", line });
    } else {
      const ride: TransitLeg = {
        mode: "ride",
        line,
        name: leg.routeShortName ?? leg.routeLongName,
        color: leg.routeColor ? `#${leg.routeColor}` : undefined,
        vehicle: VEHICLE_LABELS[leg.mode ?? ""] ?? "Transit",
        headsign: leg.headsign,
        departIso: leg.startTime,
        arriveIso: leg.endTime,
        tz: leg.from?.tz,
        live: leg.realTime === true,
        stops: [leg.from, ...(leg.intermediateStops ?? []), leg.to]
          .map(rideStop)
          .filter((stop): stop is RideStop => stop !== null),
      };
      if (leg.from?.stopId && leg.startTime) {
        boards.push({ ride, stopId: leg.from.stopId });
      }
      legs.push(ride);
    }
  }
  if (!legs.length) throw new Error("transit itinerary had no drawable legs");
  // Departures boards for every boarding stop, in parallel. A board that
  // fails only costs its ride the extra times, never the ride itself.
  await Promise.all(
    boards.map(async (board) => {
      try {
        board.ride.nextDeparts = await fetchNextDeparts(
          board.stopId,
          board.ride.name,
          board.ride.headsign,
          board.ride.departIso ?? "",
          signal,
        );
      } catch (error) {
        // An abort did not "fail this board", it ended the whole request.
        // Swallowing it here would cache an itinerary permanently missing
        // its next-departure times for every later caller.
        if (signal.aborted) throw error;
        console.warn("[transit] departures board failed:", error);
      }
    }),
  );
  rideCache.set(key, legs);
  return legs;
};
