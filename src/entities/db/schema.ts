import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// The eventual D1 schema — mirrors src/entities/trips/types.ts. NOT WIRED YET:
// nothing imports this and no migrations have been generated; the app runs on
// the localStorage mock. It exists so the data design stays honest as the UI
// evolves (drizzle-kit generate will emit ./migrations when we go live).
//
// Ordering note: the mock uses positional arrays; the real schema uses
// fractional-index `rank` strings so two offline clients can both reorder
// without coordination.

export const trips = sqliteTable("trips", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  dates: text("dates"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const segments = sqliteTable(
  "segments",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id").notNull(),
    name: text("name").notNull(),
    rank: text("rank").notNull(),
  },
  (table) => [index("segments_by_trip").on(table.tripId, table.rank)],
);

export const days = sqliteTable(
  "days",
  {
    id: text("id").primaryKey(),
    segmentId: text("segment_id").notNull(),
    date: text("date").notNull(), // ISO yyyy-mm-dd
    title: text("title"),
  },
  (table) => [index("days_by_segment").on(table.segmentId, table.date)],
);

export const places = sqliteTable("places", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  // Geocode once, cache forever (opening hours JSON, photo URL, provider id).
  openingHoursJson: text("opening_hours_json"),
  photoUrl: text("photo_url"),
  providerId: text("provider_id"),
  fetchedAt: integer("fetched_at"),
});

export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id").notNull(),
    segmentId: text("segment_id").notNull(),
    dayId: text("day_id"), // null = segment idea pool
    rank: text("rank").notNull(),
    text: text("text").notNull(),
    kind: text("kind").notNull(), // activity | food | lodging | transport | note
    status: text("status").notNull(), // planned | done | cancelled
    time: text("time"),
    note: text("note"),
    url: text("url"),
    cost: text("cost"),
    placeId: text("place_id"),
    detailsJson: text("details_json"), // check-in/out, codes, phone
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("items_by_day").on(table.dayId, table.rank),
    index("items_by_segment").on(table.segmentId, table.dayId, table.rank),
  ],
);

// Cached route legs between consecutive day items (mode, duration, geometry,
// timetable snapshot) — computed online at plan time, readable offline.
export const legs = sqliteTable(
  "legs",
  {
    id: text("id").primaryKey(),
    dayId: text("day_id").notNull(),
    fromItemId: text("from_item_id").notNull(),
    toItemId: text("to_item_id").notNull(),
    mode: text("mode").notNull(), // walk | transit | drive
    durationSec: integer("duration_sec"),
    polyline: text("polyline"),
    timetableJson: text("timetable_json"),
    fetchedAt: integer("fetched_at"),
  },
  (table) => [index("legs_by_day").on(table.dayId)],
);

// Append-only mutation log: the sync backbone AND the versioning/history story.
// Offline clients queue these; the TripRoom DO applies them to the tables
// above, stamps server_seq, and broadcasts.
export const mutations = sqliteTable(
  "mutations",
  {
    serverSeq: integer("server_seq").primaryKey({ autoIncrement: true }),
    mutationId: text("mutation_id").notNull(),
    tripId: text("trip_id").notNull(),
    clientId: text("client_id").notNull(),
    userId: text("user_id").notNull(),
    op: text("op").notNull(),
    payloadJson: text("payload_json").notNull(),
    hlc: text("hlc").notNull(), // hybrid logical clock for LWW
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("mutations_dedupe").on(table.tripId, table.mutationId),
    index("mutations_by_trip").on(table.tripId, table.serverSeq),
  ],
);
