// The whole plan is a small normalized tree: Trip → Segment (city, with its own
// idea pool) → Day → Item. Items live either in a day's ordered list or in the
// segment's unassigned idea pool; moving between them is just an id splice.
// This is the mock/local shape — the real schema (D1 + mutation log) comes later.

export type ItemKind = "activity" | "food" | "lodging" | "transport" | "note";

// done/cancelled are independent of where an item lives. Cancelled items stay
// visible (struck through) — the plan remembers what almost happened.
export type ItemStatus = "planned" | "done" | "cancelled";

export type Place = {
  name: string;
  lat: number;
  lng: number;
  address?: string;
};

export type ItemDetails = {
  address?: string;
  dates?: string;
  checkIn?: string;
  checkOut?: string;
  code?: string;
  phone?: string;
};

export type Item = {
  id: string;
  text: string;
  kind: ItemKind;
  status: ItemStatus;
  time?: string;
  note?: string;
  url?: string;
  cost?: string;
  place?: Place;
  details?: ItemDetails;
};

export type Day = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  title?: string;
  itemIds: string[];
};

export type Segment = {
  id: string;
  name: string;
  dayIds: string[];
  poolItemIds: string[];
};

export type Trip = {
  id: string;
  name: string;
  dates?: string;
  segmentIds: string[];
};

export type Db = {
  version: 1;
  tripOrder: string[];
  trips: Record<string, Trip>;
  segments: Record<string, Segment>;
  days: Record<string, Day>;
  items: Record<string, Item>;
};

// Where an item list lives — a day's schedule or a segment's idea pool.
export type ContainerRef =
  | { type: "day"; id: string }
  | { type: "pool"; id: string }; // id = segment id

// Pin palette lives in CSS variables (defined in panda.config globalCss) so
// the dots — DOM elements on the map and in rows — retheme instantly with
// data-theme: saturated on light paper, softened (non-neon) on the dark map.
export const KIND_META: Record<ItemKind, { label: string; cssVar: string }> = {
  activity: { label: "Activity", cssVar: "--pin-activity" }, // terracotta
  food: { label: "Food", cssVar: "--pin-food" }, // berry
  lodging: { label: "Stay", cssVar: "--pin-lodging" }, // deep teal
  transport: { label: "Transit", cssVar: "--pin-transport" }, // steel blue
  note: { label: "Note", cssVar: "--pin-note" }, // stone
};
