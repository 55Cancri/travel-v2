// The area's bus network from OpenStreetMap via Overpass: every bus route
// relation crossing the viewport, with its way geometries as a multiline.
// Responses run to a few megabytes for a city view, so callers cache by
// bounds and only refetch when the view leaves the covered area.

import type { ViewBounds } from "./fetch-places";
import { overpassQuery } from "./overpass";

export type BusRoute = {
  id: number;
  ref: string;
  name: string;
  color?: string;
  operator?: string;
  lines: number[][][];
};

type WireMember = {
  type: string;
  ref: number;
  geometry?: Array<{ lat: number; lon: number }>;
};

type WireRelation = {
  id: number;
  tags?: Record<string, string>;
  members?: WireMember[];
};

export const fetchBusNetwork = async (view: ViewBounds, signal: AbortSignal) => {
  const bbox = `(${view.south},${view.west},${view.north},${view.east})`;
  const query = `[out:json][timeout:40];relation["route"="bus"]${bbox};out geom;`;
  const body = await overpassQuery<{ elements?: WireRelation[] }>(query, signal);
  const routes: BusRoute[] = [];
  for (const relation of body.elements ?? []) {
    const tags = relation.tags ?? {};
    // Out-and-back variants of one line share most ways; drawing each way
    // once per relation keeps the multiline a third the size.
    const wayIds = new Set<number>();
    const lines: number[][][] = [];
    for (const member of relation.members ?? []) {
      if (member.type !== "way" || !member.geometry || wayIds.has(member.ref)) continue;
      wayIds.add(member.ref);
      const line = member.geometry.map((point) => [point.lon, point.lat]);
      if (line.length >= 2) lines.push(line);
    }
    if (!lines.length) continue;
    routes.push({
      id: relation.id,
      ref: tags.ref ?? "",
      name: tags.name ?? [tags.from, tags.to].filter(Boolean).join(" → "),
      color: tags.colour,
      operator: tags.operator,
      lines,
    });
  }
  return routes;
};
