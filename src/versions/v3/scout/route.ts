// A route through the points the scout Cmd-clicked, in the order they were
// clicked. Consecutive points close enough to walk are road-routed together
// as one chain; a hop too long to walk asks public transport instead, which
// is the same walk-or-ride judgement the trip planner makes, made here over
// a bare list of coordinates instead of a day.
//
// A leg whose router fails falls back to a straight line and SAYS so. That
// is a legitimate fallback rather than a hidden one: the public instances
// go down, and a straight line still answers "roughly where does this go",
// as long as nobody is told it is a real path.

import {
  fetchRide,
  fetchRoadRoute,
  metersBetween,
  WALK_LIMIT_METERS,
  type Coord,
} from "entities/routing";

export type Waypoint = { id: string; lng: number; lat: number };

export type RouteLeg = {
  line: number[][];
  mode: "walk" | "ride";
  // What carries you on a ride ("Bus 21", "Metro 52"), for the popup.
  name?: string;
};

export type RoutePlan = {
  legs: RouteLeg[];
  // Names what could not be routed, so a straight line is never mistaken
  // for a real path.
  notice?: string;
};

type Part =
  | { kind: "chain"; coords: Coord[] }
  | { kind: "ride"; from: Waypoint; to: Waypoint };

const asCoord = (point: Waypoint): Coord => [point.lng, point.lat];

// Walk runs stay together so one router call covers them; the moment a hop
// is too long, it becomes a ride and a fresh walk run starts on its far
// side. A run of one point has no walk of its own and simply vanishes.
const split = (points: Waypoint[]) => {
  const parts: Part[] = [];
  let run: Waypoint[] = [];
  for (const point of points) {
    const previous = run.at(-1);
    if (!previous) {
      run = [point];
      continue;
    }
    if (metersBetween(previous, point) <= WALK_LIMIT_METERS) {
      run.push(point);
      continue;
    }
    if (run.length >= 2) parts.push({ kind: "chain", coords: run.map(asCoord) });
    parts.push({ kind: "ride", from: previous, to: point });
    run = [point];
  }
  if (run.length >= 2) parts.push({ kind: "chain", coords: run.map(asCoord) });
  return parts;
};

const straightLeg = (part: Part): RouteLeg =>
  part.kind === "chain"
    ? { line: part.coords.map((pair) => [pair[0], pair[1]]), mode: "walk" }
    : { line: [asCoord(part.from), asCoord(part.to)], mode: "ride" };

export const planRoute = async (
  points: Waypoint[],
  dateIso: string,
  signal: AbortSignal,
): Promise<RoutePlan> => {
  const parts = split(points);
  if (parts.length === 0) return { legs: [] };
  const answers = await Promise.allSettled(
    parts.map((part) =>
      part.kind === "chain"
        ? fetchRoadRoute(part.coords, signal)
        : fetchRide(part.from, part.to, dateIso, signal),
    ),
  );
  const legs: RouteLeg[] = [];
  let straightened = 0;
  answers.forEach((answer, idx) => {
    const part = parts[idx];
    if (answer.status === "rejected") {
      if (!signal.aborted) console.warn("[scout] route leg failed:", answer.reason);
      straightened += 1;
      legs.push(straightLeg(part));
      return;
    }
    if (part.kind === "chain") {
      const road = answer.value as { line: number[][] };
      legs.push({ line: road.line, mode: "walk" });
      return;
    }
    const ride = answer.value as Array<{
      mode: "walk" | "ride";
      line: number[][];
      name?: string;
      vehicle?: string;
    }>;
    for (const leg of ride) {
      legs.push({
        line: leg.line,
        mode: leg.mode,
        name: [leg.vehicle, leg.name].filter(Boolean).join(" ") || undefined,
      });
    }
  });
  return {
    legs,
    notice:
      straightened > 0
        ? `${straightened} of ${parts.length} legs could not be routed and are drawn straight.`
        : undefined,
  };
};
