import * as React from "react";
import { seed } from "./seed";
import type { ContainerRef, Db, Item, ItemKind, RouteVia } from "./types";

// Module store: one snapshot, plain mutation functions, useSyncExternalStore
// for React. Persistence is localStorage for now — the
// mutation surface is the seam where the real sync layer (outbox → Durable
// Object → D1) slots in later without touching any component.

const STORAGE_KEY = "travel2:db:v1";

const load = (): Db | null => {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Db;
    return parsed.version === 1 ? parsed : null;
  } catch (error) {
    // A corrupt stored db falls back to the seed; say so instead of
    // silently discarding the owner's data.
    console.warn("[trips] stored db unreadable, using seed:", error);
    return null;
  }
};

let db: Db = load() ?? seed;
const listeners = new Set<() => void>();

const emit = () => {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (error) {
      console.warn("[trips] persist failed:", error);
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

// Server snapshot is always the seed; components gate on useMounted() before
// trusting the store, so the localStorage copy never causes a hydration clash.
export const useDb = () => React.useSyncExternalStore(subscribe, getDb, () => seed);

export const useMounted = () => {
  const [mounted, storeMounted] = React.useState(false);
  React.useEffect(() => storeMounted(true), []);
  return mounted;
};

export const resetToSeed = () => {
  db = seed;
  emit();
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ---- container helpers ----------------------------------------------------

export const containerItemIds = (data: Db, ref: ContainerRef): string[] =>
  ref.type === "day"
    ? (data.days[ref.id]?.itemIds ?? [])
    : (data.segments[ref.id]?.poolItemIds ?? []);

const withContainerItems = (data: Db, ref: ContainerRef, itemIds: string[]): Db => {
  if (ref.type === "day") {
    const day = data.days[ref.id];
    if (!day) return data;
    return { ...data, days: { ...data.days, [ref.id]: { ...day, itemIds } } };
  }
  const segment = data.segments[ref.id];
  if (!segment) return data;
  return {
    ...data,
    segments: { ...data.segments, [ref.id]: { ...segment, poolItemIds: itemIds } },
  };
};

// ---- trip mutations --------------------------------------------------------

export const createTrip = (name: string) => {
  const id = newId();
  db = {
    ...db,
    tripOrder: [...db.tripOrder, id],
    trips: { ...db.trips, [id]: { id, name, segmentIds: [] } },
  };
  emit();
  return id;
};

export const renameTrip = (tripId: string, name: string) => {
  const trip = db.trips[tripId];
  if (!trip || !name.trim()) return;
  db = { ...db, trips: { ...db.trips, [tripId]: { ...trip, name: name.trim() } } };
  emit();
};

export const addSegment = (tripId: string, name: string) => {
  const trip = db.trips[tripId];
  if (!trip) return null;
  const id = newId();
  db = {
    ...db,
    trips: { ...db.trips, [tripId]: { ...trip, segmentIds: [...trip.segmentIds, id] } },
    segments: { ...db.segments, [id]: { id, name, dayIds: [], poolItemIds: [] } },
  };
  emit();
  return id;
};

export const renameSegment = (segmentId: string, name: string) => {
  const segment = db.segments[segmentId];
  if (!segment || !name.trim()) return;
  db = {
    ...db,
    segments: { ...db.segments, [segmentId]: { ...segment, name: name.trim() } },
  };
  emit();
};

export const addDay = (segmentId: string, date: string) => {
  const segment = db.segments[segmentId];
  if (!segment) return null;
  const id = newId();
  db = {
    ...db,
    segments: {
      ...db.segments,
      [segmentId]: { ...segment, dayIds: [...segment.dayIds, id] },
    },
    days: { ...db.days, [id]: { id, date, itemIds: [] } },
  };
  emit();
  return id;
};

// ---- item mutations --------------------------------------------------------

export const insertItemAfter = (ref: ContainerRef, index: number, kind: ItemKind = "activity") => {
  const id = newId();
  const created: Item = { id, text: "", kind, status: "planned" };
  const ids = Array.from(containerItemIds(db, ref));
  ids.splice(index + 1, 0, id);
  db = withContainerItems({ ...db, items: { ...db.items, [id]: created } }, ref, ids);
  emit();
  return created;
};

// Multiline paste: each line becomes its own item, spliced in after `index` in
// one emit. Returns the created items (last one gets focus).
export const insertLines = (ref: ContainerRef, index: number, lines: string[]) => {
  const created: Item[] = lines.map((text) => ({
    id: newId(),
    text,
    kind: "activity",
    status: "planned",
  }));
  const ids = Array.from(containerItemIds(db, ref));
  ids.splice(index + 1, 0, ...created.map((entry) => entry.id));
  const items = { ...db.items };
  for (const entry of created) items[entry.id] = entry;
  db = withContainerItems({ ...db, items }, ref, ids);
  emit();
  return created;
};

export const removeItem = (ref: ContainerRef, itemId: string) => {
  const ids = containerItemIds(db, ref).filter((id) => id !== itemId);
  const items = { ...db.items };
  delete items[itemId];
  db = withContainerItems({ ...db, items }, ref, ids);
  emit();
};

// Shallow-merge partial fields (kind, time, note, details, …) — the item
// editor's write path.
export const updateItem = (itemId: string, partial: Partial<Omit<Item, "id">>) => {
  const entry = db.items[itemId];
  if (!entry) return;
  db = { ...db, items: { ...db.items, [itemId]: { ...entry, ...partial } } };
  emit();
};

// How many items live anywhere in a segment (idea pool + all its days) —
// drives the delete confirmation (empty city deletes silently).
export const segmentItemCount = (data: Db, segmentId: string) => {
  const segment = data.segments[segmentId];
  if (!segment) return 0;
  const dayItemIds = segment.dayIds.flatMap((dayId) => data.days[dayId]?.itemIds ?? []);
  return [...segment.poolItemIds, ...dayItemIds].filter(
    (id) => data.items[id]?.text.trim() !== "",
  ).length;
};

export const deleteSegment = (tripId: string, segmentId: string) => {
  const trip = db.trips[tripId];
  const segment = db.segments[segmentId];
  if (!trip || !segment) return;
  const items = { ...db.items };
  const days = { ...db.days };
  for (const id of segment.poolItemIds) delete items[id];
  for (const dayId of segment.dayIds) {
    for (const id of days[dayId]?.itemIds ?? []) delete items[id];
    delete days[dayId];
  }
  const segments = { ...db.segments };
  delete segments[segmentId];
  db = {
    ...db,
    items,
    days,
    segments,
    trips: {
      ...db.trips,
      [tripId]: { ...trip, segmentIds: trip.segmentIds.filter((id) => id !== segmentId) },
    },
  };
  emit();
};

export const moveSegment = (tripId: string, fromIndex: number, toIndex: number) => {
  const trip = db.trips[tripId];
  if (!trip) return;
  const ids = Array.from(trip.segmentIds);
  const [moved] = ids.splice(fromIndex, 1);
  if (moved === undefined) return;
  ids.splice(toIndex, 0, moved);
  db = { ...db, trips: { ...db.trips, [tripId]: { ...trip, segmentIds: ids } } };
  emit();
};

export const setItemText = (itemId: string, text: string) => {
  const entry = db.items[itemId];
  if (!entry) return;
  db = { ...db, items: { ...db.items, [itemId]: { ...entry, text } } };
  emit();
};

export const toggleItemDone = (itemId: string) => {
  const entry = db.items[itemId];
  if (!entry) return;
  const status = entry.status === "done" ? "planned" : "done";
  db = { ...db, items: { ...db.items, [itemId]: { ...entry, status } } };
  emit();
};

export const toggleItemCancelled = (itemId: string) => {
  const entry = db.items[itemId];
  if (!entry) return;
  const status = entry.status === "cancelled" ? "planned" : "cancelled";
  db = { ...db, items: { ...db.items, [itemId]: { ...entry, status } } };
  emit();
};

export const moveItem = (ref: ContainerRef, fromIndex: number, toIndex: number) => {
  const ids = Array.from(containerItemIds(db, ref));
  const [moved] = ids.splice(fromIndex, 1);
  if (moved === undefined) return;
  ids.splice(toIndex, 0, moved);
  db = withContainerItems(db, ref, ids);
  emit();
};

// ---- route vias -----------------------------------------------------------

const withDayVias = (dayId: string, vias: RouteVia[]): boolean => {
  const day = db.days[dayId];
  if (!day) return false;
  db = { ...db, days: { ...db.days, [dayId]: { ...day, vias } } };
  return true;
};

// insertAfterViaId places the new via directly after an existing one on the
// same leg; omitted, it leads its anchor group (grabbed between the stop
// and that leg's first via).
export const addRouteVia = (
  dayId: string,
  via: { afterItemId: string; lng: number; lat: number },
  insertAfterViaId?: string,
) => {
  const vias = Array.from(db.days[dayId]?.vias ?? []);
  const entry: RouteVia = { id: newId(), ...via };
  const anchorIdx = insertAfterViaId
    ? vias.findIndex((v) => v.id === insertAfterViaId)
    : -1;
  if (anchorIdx >= 0) {
    vias.splice(anchorIdx + 1, 0, entry);
  } else {
    const groupStart = vias.findIndex((v) => v.afterItemId === via.afterItemId);
    vias.splice(groupStart >= 0 ? groupStart : vias.length, 0, entry);
  }
  if (!withDayVias(dayId, vias)) return null;
  emit();
  return entry.id;
};

export const moveRouteVia = (dayId: string, viaId: string, lng: number, lat: number) => {
  const vias = (db.days[dayId]?.vias ?? []).map((v) =>
    v.id === viaId ? { ...v, lng, lat } : v,
  );
  if (!withDayVias(dayId, vias)) return;
  emit();
};

export const removeRouteVia = (dayId: string, viaId: string) => {
  const vias = (db.days[dayId]?.vias ?? []).filter((v) => v.id !== viaId);
  if (!withDayVias(dayId, vias)) return;
  emit();
};
