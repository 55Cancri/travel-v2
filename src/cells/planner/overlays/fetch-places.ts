// Point-of-interest overlays from OpenStreetMap via Overpass. One request
// covers every enabled point overlay for the viewport: the query is a
// union of per-overlay selectors and the elements classify back into
// overlays afterward (a place tagged both vegan and vegetarian shows as
// vegan when both overlays are on, not twice).

import type { OverlayKind } from "./catalog";
import { overpassQuery } from "./overpass";

export type OverlayPlace = {
  id: string;
  kind: OverlayKind;
  lng: number;
  lat: number;
  name: string;
  // Ready-to-render tooltip lines (cuisine, hours, fee).
  notes: string[];
};

const FOOD_AMENITY = `["amenity"~"restaurant|cafe|fast_food"]`;

// Overpass selectors per overlay, without the trailing bbox.
const SELECTORS: Partial<Record<OverlayKind, string[]>> = {
  vegan: [`nwr["diet:vegan"~"yes|only"]${FOOD_AMENITY}`],
  vegetarian: [`nwr["diet:vegetarian"~"yes|only"]${FOOD_AMENITY}`],
  luggage: [`nwr["amenity"~"^(luggage_locker|left_luggage)$"]`],
  bikes: [`nwr["amenity"="bicycle_rental"]`],
};

type WireElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const titleCase = (value: string) =>
  value
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const placeNotes = (kind: OverlayKind, tags: Record<string, string>) => {
  const notes: string[] = [];
  if (kind === "vegan" && tags["diet:vegan"] === "only") notes.push("Fully vegan");
  if (kind === "vegetarian" && tags["diet:vegetarian"] === "only") {
    notes.push("Fully vegetarian");
  }
  if (tags.cuisine) notes.push(titleCase(tags.cuisine.split(";")[0]));
  if (kind === "bikes" && tags.brand && tags.brand !== tags.name) notes.push(tags.brand);
  if (kind === "luggage" && tags.fee === "yes") notes.push("Paid");
  if (tags.opening_hours) notes.push(tags.opening_hours);
  return notes;
};

// Which overlay an element belongs to, given what is enabled. Vegan
// outranks vegetarian so a doubly tagged place lands on the stricter
// overlay when both are on.
const classify = (kinds: OverlayKind[], tags: Record<string, string>): OverlayKind | null => {
  if (kinds.includes("vegan") && /^(yes|only)$/.test(tags["diet:vegan"] ?? "")) return "vegan";
  if (kinds.includes("vegetarian") && /^(yes|only)$/.test(tags["diet:vegetarian"] ?? "")) {
    return "vegetarian";
  }
  if (kinds.includes("luggage") && /^(luggage_locker|left_luggage)$/.test(tags.amenity ?? "")) {
    return "luggage";
  }
  if (kinds.includes("bikes") && tags.amenity === "bicycle_rental") return "bikes";
  return null;
};

export type ViewBounds = { south: number; west: number; north: number; east: number };

export const fetchOverlayPlaces = async (
  kinds: OverlayKind[],
  view: ViewBounds,
  signal: AbortSignal,
) => {
  const bbox = `(${view.south},${view.west},${view.north},${view.east})`;
  const blocks = kinds
    .flatMap((kind) => SELECTORS[kind] ?? [])
    .map((selector) => `${selector}${bbox};`)
    .join("");
  const query = `[out:json][timeout:25];(${blocks});out center tags;`;
  const body = await overpassQuery<{ elements?: WireElement[] }>(query, signal);
  const places: OverlayPlace[] = [];
  const seen = new Set<string>();
  for (const element of body.elements ?? []) {
    const id = `${element.type}/${element.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const tags = element.tags ?? {};
    const kind = classify(kinds, tags);
    const lng = element.lon ?? element.center?.lon;
    const lat = element.lat ?? element.center?.lat;
    if (!kind || lng === undefined || lat === undefined) continue;
    places.push({
      id,
      kind,
      lng,
      lat,
      name: tags.name ?? tags.brand ?? tags.operator ?? "Unnamed",
      notes: placeNotes(kind, tags),
    });
  }
  return places;
};
