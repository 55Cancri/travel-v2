import type { GoogleHours } from "entities/place-search";

// A scout map is a saved document: named pins, the routed edges between
// them, and the camera it was left at. Several maps coexist (one per
// question being scouted) and the search memory (saved and recent
// queries) is shared across all of them.

// What may carry you along an edge. "train" covers the long-distance and
// regional rail family, "metro" the underground.
export type RideMode = "walk" | "bus" | "tram" | "train" | "metro" | "ferry";

export const ALL_RIDE_MODES: RideMode[] = ["walk", "bus", "tram", "train", "metro", "ferry"];

// Opening hours in whichever grammar the place's source spoke. OSM tags
// arrive as one raw opening_hours string; the search engine returns
// structured weekly periods plus the place's UTC offset.
export type PlaceHours =
  | { kind: "osm"; raw: string }
  | ({ kind: "google" } & GoogleHours);

export type SavedPlace = {
  id: string;
  // What the owner calls it, editable; opens as the found place's name.
  label: string;
  color: string;
  lng: number;
  lat: number;
  address?: string;
  hours?: PlaceHours;
  // The engine place id or OSM element id this pin came from, kept so
  // hours can be refreshed later without a new search.
  sourceRef?: string;
  savedAtMs: number;
};

export type ScoutEdge = {
  id: string;
  fromId: string;
  toId: string;
  // Empty never occurs: an edge is born with every mode allowed and the
  // drawer toggles from there.
  modes: RideMode[];
};

export type MapCamera = { lng: number; lat: number; zoom: number };

export type ScoutMap = {
  id: string;
  name: string;
  camera?: MapCamera;
  places: Record<string, SavedPlace>;
  placeOrder: string[];
  edges: ScoutEdge[];
};

export type SavedSearch = { id: string; query: string; label?: string };

export type RecentSearch = { query: string; lastMs: number; count: number };

export type ScoutDb = {
  version: 1;
  activeMapId: string;
  mapOrder: string[];
  maps: Record<string, ScoutMap>;
  searches: { saved: SavedSearch[]; recents: RecentSearch[] };
};

// One palette for query lines and saved pins, so a promoted pin keeps the
// color it was found under: saturated enough to hold against pale
// streets, light enough to stay visible on the dark canvas.
export const PIN_COLORS = [
  "#E11D48",
  "#0EA5E9",
  "#16A34A",
  "#8B5CF6",
  "#F59E0B",
  "#0D9488",
];
