import * as React from "react";
import type {
  MapCamera,
  RecentSearch,
  RideMode,
  SavedPlace,
  ScoutDb,
  ScoutEdge,
  ScoutMap,
} from "./types";
import { ALL_RIDE_MODES } from "./types";

// Module store in the same shape as the trips store: one snapshot, plain
// mutation functions, useSyncExternalStore for React, localStorage for
// persistence. The mutation surface is the seam where the sync layer
// slots in later without touching any component.

const STORAGE_KEY = "travel2:scout:v1";
const RECENTS_CAP = 30;
// A query typed this many times counts as a common one and surfaces in
// the search drawer's suggestions.
export const FREQUENT_SEARCH_FLOOR = 3;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Temporal.Now.instant().epochMilliseconds}-${Math.random().toString(36).slice(2)}`;

const nowMs = () => Temporal.Now.instant().epochMilliseconds;

const freshMap = (name: string): ScoutMap => ({
  id: newId(),
  name,
  places: {},
  placeOrder: [],
  edges: [],
});

const openingDb = (): ScoutDb => {
  const first = freshMap("Map 1");
  return {
    version: 1,
    activeMapId: first.id,
    mapOrder: [first.id],
    maps: { [first.id]: first },
    searches: { saved: [], recents: [] },
  };
};

const load = (): ScoutDb | null => {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScoutDb;
    return parsed.version === 1 ? parsed : null;
  } catch (error) {
    console.warn("[scout-maps] stored maps unreadable:", error);
    return null;
  }
};

// The server snapshot: stable for the lifetime of the module so
// useSyncExternalStore never sees a fresh object per read. Components gate
// on mount before trusting the store, so this never reaches paint.
const OPENING_DB = openingDb();

let db: ScoutDb = load() ?? OPENING_DB;
const listeners = new Set<() => void>();

const emit = () => {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (error) {
      console.warn("[scout-maps] persist failed:", error);
    }
  }
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getDb = () => db;

export const useScoutDb = () =>
  React.useSyncExternalStore(subscribe, getDb, () => OPENING_DB);

// The current snapshot for non-React callers (map event handlers, tests).
export const readScoutDb = getDb;

export const activeMap = (snapshot: ScoutDb): ScoutMap =>
  snapshot.maps[snapshot.activeMapId] ?? snapshot.maps[snapshot.mapOrder[0]];

const withMap = (mapId: string, change: (map: ScoutMap) => ScoutMap) => {
  const map = db.maps[mapId];
  if (!map) return;
  db = { ...db, maps: { ...db.maps, [mapId]: change(map) } };
  emit();
};

// ---- maps ------------------------------------------------------------------

export const createMap = (name: string) => {
  const map = freshMap(name.trim() || `Map ${db.mapOrder.length + 1}`);
  db = {
    ...db,
    activeMapId: map.id,
    mapOrder: db.mapOrder.concat(map.id),
    maps: { ...db.maps, [map.id]: map },
  };
  emit();
  return map.id;
};

export const renameMap = (mapId: string, name: string) => {
  if (!name.trim()) return;
  withMap(mapId, (map) => ({ ...map, name: name.trim() }));
};

export const moveMap = (fromIdx: number, toIdx: number) => {
  const order = Array.from(db.mapOrder);
  const [moved] = order.splice(fromIdx, 1);
  if (moved === undefined) return;
  order.splice(toIdx, 0, moved);
  db = { ...db, mapOrder: order };
  emit();
};

// Deleting the last map leaves a fresh empty one: a screen with no map at
// all offers no way back.
export const deleteMap = (mapId: string) => {
  if (!db.maps[mapId]) return;
  const maps = { ...db.maps };
  delete maps[mapId];
  let order = db.mapOrder.filter((id) => id !== mapId);
  if (order.length === 0) {
    const replacement = freshMap("Map 1");
    maps[replacement.id] = replacement;
    order = [replacement.id];
  }
  db = {
    ...db,
    maps,
    mapOrder: order,
    activeMapId: db.activeMapId === mapId ? order[0] : db.activeMapId,
  };
  emit();
};

export const switchMap = (mapId: string) => {
  if (!db.maps[mapId] || db.activeMapId === mapId) return;
  db = { ...db, activeMapId: mapId };
  emit();
};

export const rememberMapCamera = (mapId: string, camera: MapCamera) => {
  withMap(mapId, (map) => ({ ...map, camera }));
};

// ---- places ----------------------------------------------------------------

export const savePlace = (
  mapId: string,
  draft: Omit<SavedPlace, "id" | "savedAtMs">,
) => {
  const place: SavedPlace = { ...draft, id: newId(), savedAtMs: nowMs() };
  withMap(mapId, (map) => ({
    ...map,
    places: { ...map.places, [place.id]: place },
    placeOrder: map.placeOrder.concat(place.id),
  }));
  return place.id;
};

// Shallow merge (label, color, hours, ...): the place drawer's write path.
export const updatePlace = (
  mapId: string,
  placeId: string,
  partial: Partial<Omit<SavedPlace, "id">>,
) => {
  withMap(mapId, (map) => {
    const place = map.places[placeId];
    if (!place) return map;
    return { ...map, places: { ...map.places, [placeId]: { ...place, ...partial } } };
  });
};

// An edge cannot outlive either endpoint.
export const removePlace = (mapId: string, placeId: string) => {
  withMap(mapId, (map) => {
    const places = { ...map.places };
    delete places[placeId];
    return {
      ...map,
      places,
      placeOrder: map.placeOrder.filter((id) => id !== placeId),
      edges: map.edges.filter((edge) => edge.fromId !== placeId && edge.toId !== placeId),
    };
  });
};

// ---- edges -----------------------------------------------------------------

// Directional (the order tapped is the route's direction), born with every
// mode allowed. Re-adding an existing edge returns it instead of doubling.
export const addEdge = (mapId: string, fromId: string, toId: string) => {
  const map = db.maps[mapId];
  if (!map || fromId === toId || !map.places[fromId] || !map.places[toId]) return null;
  const known = map.edges.find((edge) => edge.fromId === fromId && edge.toId === toId);
  if (known) return known.id;
  const edge: ScoutEdge = { id: newId(), fromId, toId, modes: Array.from(ALL_RIDE_MODES) };
  withMap(mapId, (current) => ({ ...current, edges: current.edges.concat(edge) }));
  return edge.id;
};

// An edge with no modes at all cannot route; the last mode stays on.
export const setEdgeModes = (mapId: string, edgeId: string, modes: RideMode[]) => {
  if (modes.length === 0) return;
  withMap(mapId, (map) => ({
    ...map,
    edges: map.edges.map((edge) => (edge.id === edgeId ? { ...edge, modes } : edge)),
  }));
};

export const removeEdge = (mapId: string, edgeId: string) => {
  withMap(mapId, (map) => ({
    ...map,
    edges: map.edges.filter((edge) => edge.id !== edgeId),
  }));
};

export const clearEdges = (mapId: string) => {
  withMap(mapId, (map) => ({ ...map, edges: [] }));
};

// ---- searches --------------------------------------------------------------

// Every answered search lands here once; repeats bump the count that makes
// a query "common". Newest first, capped so the list stays a memory and
// not a log.
export const noteSearch = (query: string) => {
  const text = query.trim();
  if (!text) return;
  const key = text.toLowerCase();
  const known = db.searches.recents.find((entry) => entry.query.toLowerCase() === key);
  const entry: RecentSearch = known
    ? { ...known, lastMs: nowMs(), count: known.count + 1 }
    : { query: text, lastMs: nowMs(), count: 1 };
  const recents = [entry]
    .concat(db.searches.recents.filter((other) => other.query.toLowerCase() !== key))
    .slice(0, RECENTS_CAP);
  db = { ...db, searches: { ...db.searches, recents } };
  emit();
};

export const saveSearch = (query: string, label?: string) => {
  const text = query.trim();
  if (!text) return null;
  const known = db.searches.saved.find(
    (entry) => entry.query.toLowerCase() === text.toLowerCase(),
  );
  if (known) return known.id;
  const entry = { id: newId(), query: text, label };
  db = { ...db, searches: { ...db.searches, saved: db.searches.saved.concat(entry) } };
  emit();
  return entry.id;
};

export const forgetSearch = (id: string) => {
  db = {
    ...db,
    searches: { ...db.searches, saved: db.searches.saved.filter((entry) => entry.id !== id) },
  };
  emit();
};

// The queries typed often enough to suggest before typing starts, most
// used first, without echoing what is already pinned as saved.
export const frequentSearches = (snapshot: ScoutDb) => {
  const savedQueries = new Set(
    snapshot.searches.saved.map((entry) => entry.query.toLowerCase()),
  );
  return snapshot.searches.recents
    .filter(
      (entry) =>
        entry.count >= FREQUENT_SEARCH_FLOOR && !savedQueries.has(entry.query.toLowerCase()),
    )
    .toSorted((a, b) => b.count - a.count);
};
