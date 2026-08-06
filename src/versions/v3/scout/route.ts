// Routes for a map's edges, one plan per edge, in parallel. An edge knows
// which transport modes it allows, and the plan honors them: walk-only
// edges take the foot router whatever the distance, walkable hops with
// walking allowed do the same, and everything else asks public transport
// restricted to the edge's modes. That is the same walk-or-ride judgement
// the trip planner makes, made here over a saved graph instead of a day.
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
} from "entities/routing";
import type { RideMode, SavedPlace, ScoutEdge } from "entities/scout-maps";

export type RouteLeg = {
  line: number[][];
  mode: "walk" | "ride";
  // What carries you on a ride ("Bus 21", "Metro 52"), for the popup.
  name?: string;
  // The graph edge this leg draws, so a press on the drawn line can open
  // that edge's editor.
  edgeId: string;
};

export type RoutePlan = {
  legs: RouteLeg[];
  // Names what could not be routed, so a straight line is never mistaken
  // for a real path.
  notice?: string;
};

// The transit router's vocabulary for each of ours. "train" spans the
// whole heavy-rail family on purpose: nobody scouting a city plans
// regional versus night rail separately.
const MOTIS_MODES: Record<Exclude<RideMode, "walk">, string[]> = {
  bus: ["BUS", "COACH"],
  tram: ["TRAM"],
  metro: ["SUBWAY"],
  train: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL", "REGIONAL_RAIL", "SUBURBAN"],
  ferry: ["FERRY"],
};

const transitModesFor = (modes: RideMode[]) =>
  modes.flatMap((mode) => (mode === "walk" ? [] : MOTIS_MODES[mode]));

const straightLeg = (edge: ScoutEdge, from: SavedPlace, to: SavedPlace): RouteLeg => ({
  line: [
    [from.lng, from.lat],
    [to.lng, to.lat],
  ],
  mode: "walk",
  edgeId: edge.id,
});

const planEdge = async (
  edge: ScoutEdge,
  from: SavedPlace,
  to: SavedPlace,
  dateIso: string,
  signal: AbortSignal,
): Promise<RouteLeg[]> => {
  const rideModes = transitModesFor(edge.modes);
  const walkable = metersBetween(from, to) <= WALK_LIMIT_METERS;
  const walkAllowed = edge.modes.includes("walk");
  if (rideModes.length === 0 || (walkable && walkAllowed)) {
    const road = await fetchRoadRoute(
      [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
      signal,
    );
    return [{ line: road.line, mode: "walk", edgeId: edge.id }];
  }
  const ride = await fetchRide(from, to, dateIso, signal, rideModes);
  return ride.map((leg) => ({
    line: leg.line,
    mode: leg.mode,
    name: [leg.vehicle, leg.name].filter(Boolean).join(" ") || undefined,
    edgeId: edge.id,
  }));
};

export const planEdges = async (
  places: Record<string, SavedPlace>,
  edges: ScoutEdge[],
  dateIso: string,
  signal: AbortSignal,
): Promise<RoutePlan> => {
  const drawable = edges.filter((edge) => places[edge.fromId] && places[edge.toId]);
  if (drawable.length === 0) return { legs: [] };
  const answers = await Promise.allSettled(
    drawable.map((edge) =>
      planEdge(edge, places[edge.fromId], places[edge.toId], dateIso, signal),
    ),
  );
  const legs: RouteLeg[] = [];
  let straightened = 0;
  answers.forEach((answer, idx) => {
    const edge = drawable[idx];
    if (answer.status === "rejected") {
      if (!signal.aborted) console.warn("[scout] edge routing failed:", answer.reason);
      straightened += 1;
      legs.push(straightLeg(edge, places[edge.fromId], places[edge.toId]));
      return;
    }
    legs.push(...answer.value);
  });
  return {
    legs,
    notice:
      straightened > 0
        ? `${straightened} of ${drawable.length} connections could not be routed and are drawn straight.`
        : undefined,
  };
};
