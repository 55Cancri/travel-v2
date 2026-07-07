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
  // Ready-to-render tooltip lines (cuisine, fee, what kind of sight).
  notes: string[];
  // The raw OSM opening_hours value, still in 24-hour local wall time.
  hours?: string;
  website?: string;
  menu?: string;
  phone?: string;
  address?: string;
  // For sights: the OSM category value and whether the place carries a
  // wikipedia/wikidata tag (a decent landmark-vs-lawn-fixture signal).
  category?: string;
  notable?: boolean;
};

const FOOD_AMENITY = `["amenity"~"restaurant|cafe|fast_food"]`;

const SIGHT_TOURISM = /^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park)$/;
const SIGHT_HISTORIC = /^(castle|monument|fort|ruins|city_gate)$/;
const SIGHT_LEISURE = /^(park|garden)$/;

// Overpass selectors per overlay, without the trailing bbox.
const SELECTORS: Partial<Record<OverlayKind, string[]>> = {
  vegan: [`nwr["diet:vegan"~"yes|only"]${FOOD_AMENITY}`],
  vegetarian: [`nwr["diet:vegetarian"~"yes|only"]${FOOD_AMENITY}`],
  luggage: [`nwr["amenity"~"^(luggage_locker|left_luggage)$"]`],
  bikes: [`nwr["amenity"="bicycle_rental"]`],
  sights: [
    `nwr["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park)$"]["name"]`,
    `nwr["historic"~"^(castle|monument|fort|ruins|city_gate)$"]["name"]`,
    `nwr["leisure"~"^(park|garden)$"]["name"]`,
  ],
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

const sightCategory = (tags: Record<string, string>) => {
  if (SIGHT_TOURISM.test(tags.tourism ?? "")) return tags.tourism;
  if (SIGHT_HISTORIC.test(tags.historic ?? "")) return tags.historic;
  if (SIGHT_LEISURE.test(tags.leisure ?? "")) return tags.leisure;
  return undefined;
};

const placeNotes = (kind: OverlayKind, tags: Record<string, string>) => {
  const notes: string[] = [];
  if (kind === "vegan" && tags["diet:vegan"] === "only") notes.push("Fully vegan");
  if (kind === "vegetarian" && tags["diet:vegetarian"] === "only") {
    notes.push("Fully vegetarian");
  }
  if (tags.cuisine) notes.push(titleCase(tags.cuisine.split(";")[0]));
  if (kind === "sights") {
    const category = sightCategory(tags);
    if (category) notes.push(titleCase(category));
  }
  if (kind === "bikes" && tags.brand && tags.brand !== tags.name) notes.push(tags.brand);
  if (kind === "luggage" && tags.fee === "yes") notes.push("Paid");
  return notes;
};

// Every requested overlay an element qualifies for. A doubly tagged place
// lands in BOTH the vegan and vegetarian caches (each cache must stand
// alone when the other overlay is off); the map dedupes at paint time
// with vegan winning.
const classify = (kinds: OverlayKind[], tags: Record<string, string>): OverlayKind[] => {
  const matches: OverlayKind[] = [];
  if (kinds.includes("vegan") && /^(yes|only)$/.test(tags["diet:vegan"] ?? "")) {
    matches.push("vegan");
  }
  if (kinds.includes("vegetarian") && /^(yes|only)$/.test(tags["diet:vegetarian"] ?? "")) {
    matches.push("vegetarian");
  }
  if (kinds.includes("luggage") && /^(luggage_locker|left_luggage)$/.test(tags.amenity ?? "")) {
    matches.push("luggage");
  }
  if (kinds.includes("bikes") && tags.amenity === "bicycle_rental") matches.push("bikes");
  if (kinds.includes("sights") && sightCategory(tags) !== undefined) matches.push("sights");
  return matches;
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
    const lng = element.lon ?? element.center?.lon;
    const lat = element.lat ?? element.center?.lat;
    if (lng === undefined || lat === undefined) continue;
    const street = tags["addr:street"];
    for (const kind of classify(kinds, tags)) {
      places.push({
        id,
        kind,
        lng,
        lat,
        name: tags.name ?? tags.brand ?? tags.operator ?? "Unnamed",
        notes: placeNotes(kind, tags),
        hours: tags.opening_hours,
        website: tags.website ?? tags["contact:website"],
        menu: tags["website:menu"],
        phone: tags.phone ?? tags["contact:phone"],
        address: street
          ? [street, tags["addr:housenumber"]].filter(Boolean).join(" ")
          : undefined,
        category: kind === "sights" ? sightCategory(tags) : undefined,
        notable: tags.wikidata !== undefined || tags.wikipedia !== undefined,
      });
    }
  }
  return places;
};
