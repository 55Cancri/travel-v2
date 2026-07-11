// Bus stops and their live departure boards from Transitous (the
// community MOTIS instance, keyless). Stops load per viewport; a board
// loads on demand when a stop is hovered.

import type { ViewBounds } from "./fetch-places";

export type BusStopPoint = {
  id: string;
  name: string;
  lng: number;
  lat: number;
  tz: string;
};

export type BoardEntry = {
  line: string;
  headsign: string;
  departIso: string;
  live: boolean;
};

const MAP_STOPS = "https://api.transitous.org/api/v1/map/stops";
const STOP_TIMES = "https://api.transitous.org/api/v1/stoptimes";

type WireMapStop = {
  stopId?: string;
  name?: string;
  lat?: number;
  lon?: number;
  tz?: string;
  modes?: string[];
};

export const fetchBusStops = async (view: ViewBounds, signal: AbortSignal) => {
  const query = new URLSearchParams({
    min: `${view.south},${view.west}`,
    max: `${view.north},${view.east}`,
  });
  const res = await fetch(`${MAP_STOPS}?${query}`, { signal });
  if (!res.ok) throw new Error(`transit stops responded ${res.status}`);
  const body = (await res.json()) as WireMapStop[];
  const stops: BusStopPoint[] = [];
  for (const stop of body) {
    if (!stop.stopId || stop.lat === undefined || stop.lon === undefined) continue;
    if (!stop.modes?.includes("BUS")) continue;
    stops.push({
      id: stop.stopId,
      name: stop.name ?? "Stop",
      lng: stop.lon,
      lat: stop.lat,
      tz: stop.tz ?? "UTC",
    });
  }
  return stops;
};

type WireStopTime = {
  routeShortName?: string;
  headsign?: string;
  realTime?: boolean;
  cancelled?: boolean;
  place?: { departure?: string };
};

export const fetchStopBoard = async (stopId: string, signal: AbortSignal) => {
  const query = new URLSearchParams({
    stopId,
    // Whole seconds only: MOTIS chokes on Temporal's nanosecond fractions
    // and silently answers for the wrong day.
    time: Temporal.Now.instant().round({ smallestUnit: "second" }).toString(),
    n: "12",
  });
  const res = await fetch(`${STOP_TIMES}?${query}`, { signal });
  if (!res.ok) throw new Error(`stop times responded ${res.status}`);
  const body = (await res.json()) as { stopTimes?: WireStopTime[] };
  const entries: BoardEntry[] = [];
  for (const stopTime of body.stopTimes ?? []) {
    const departIso = stopTime.place?.departure;
    if (!departIso || stopTime.cancelled) continue;
    entries.push({
      line: stopTime.routeShortName ?? "",
      headsign: stopTime.headsign ?? "",
      departIso,
      live: stopTime.realTime === true,
    });
  }
  return entries;
};
