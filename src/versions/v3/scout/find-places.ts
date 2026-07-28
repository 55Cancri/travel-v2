// What one typed line resolves to. Two sources answer at once, because the
// same line has to serve both of the things a traveler types: a chain
// ("media markt"), where the useful answer is every branch inside the view,
// and one specific address, where the useful answer is a single point.
//
// OpenStreetMap via Overpass covers the first: it matches name, brand, and
// operator, so branches come back whether or not each shopfront repeats the
// brand, and it is the only source here carrying opening_hours. Photon
// covers the second, and reaches places outside the view that Overpass
// cannot see. Results merge into one list because the typist should never
// have to say which kind of thing they meant.
//
// The Overpass half is scoped to the visible view: an unbounded name regex
// is the query that gets a client throttled.

import { fetchAddressHits } from "entities/geocode";
import { overpassQuery } from "entities/osm";

export type ViewBounds = { south: number; west: number; north: number; east: number };

export type Finding = {
  id: string;
  name: string;
  lng: number;
  lat: number;
  address?: string;
  // The raw OSM opening_hours value, still in 24-hour local wall time.
  hours?: string;
  website?: string;
  phone?: string;
  // What OSM calls this kind of place ("Electronics", "Supermarket").
  category?: string;
  // Geocoder hits carry a location and nothing else, so a row can explain
  // why one result knows its hours and its neighbor does not.
  source: "osm" | "geocoder";
};

// Below three characters a name regex matches half a city, and below this
// zoom the view covers more ground than the public Overpass instance should
// be asked to scan.
export const MIN_QUERY_CHARS = 3;
export const MIN_SEARCH_ZOOM = 11;

const RESULT_CAP = 120;
// A geocoder hit this close to an OSM hit of the same name is that same
// shop, described twice.
const SAME_PLACE_METERS = 80;

type WireElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

// Both a POSIX regex and a double-quoted Overpass string literal, so the
// metacharacters and the quote both need their backslash.
const escapeForQuery = (value: string) => value.replace(/[\\^$.|?*+()[\]{}"]/g, "\\$&");

const titleCase = (value: string) =>
  value
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

// OSM files a place under whichever of these keys fits it; the first one
// present names the place's kind. "yes" is a presence flag, never a kind.
const CATEGORY_KEYS = ["shop", "amenity", "tourism", "leisure", "office", "healthcare", "craft"];

const categoryOf = (tags: Record<string, string>) => {
  for (const key of CATEGORY_KEYS) {
    const value = tags[key];
    if (value && value !== "yes") return titleCase(value.split(";")[0]);
  }
  return undefined;
};

const addressOf = (tags: Record<string, string>) => {
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  return [street, tags["addr:city"]].filter(Boolean).join(", ") || undefined;
};

const metersBetween = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const toRad = Math.PI / 180;
  const x = (bLng - aLng) * toRad * Math.cos(((aLat + bLat) / 2) * toRad);
  const y = (bLat - aLat) * toRad;
  return Math.sqrt(x * x + y * y) * 6371000;
};

const osmFindings = async (query: string, view: ViewBounds, signal: AbortSignal) => {
  const needle = escapeForQuery(query);
  const bbox = `(${view.south},${view.west},${view.north},${view.east})`;
  const blocks = ["name", "brand", "operator"]
    .map((key) => `nwr["${key}"~"${needle}",i]${bbox};`)
    .join("");
  const body = await overpassQuery<{ elements?: WireElement[] }>(
    `[out:json][timeout:25];(${blocks});out center tags;`,
    signal,
  );
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const element of body.elements ?? []) {
    const id = `osm:${element.type}/${element.id}`;
    // A chain branch matches on name AND brand; Overpass returns it once
    // per matching block.
    if (seen.has(id)) continue;
    seen.add(id);
    const tags = element.tags ?? {};
    const lng = element.lon ?? element.center?.lon;
    const lat = element.lat ?? element.center?.lat;
    const name = tags.name ?? tags.brand ?? tags.operator;
    if (lng === undefined || lat === undefined || !name) continue;
    findings.push({
      id,
      name,
      lng,
      lat,
      address: addressOf(tags),
      hours: tags.opening_hours,
      website: tags.website ?? tags["contact:website"],
      phone: tags.phone ?? tags["contact:phone"],
      category: categoryOf(tags),
      source: "osm",
    });
  }
  return findings;
};

const geocoderFindings = async (
  query: string,
  bias: { lng: number; lat: number },
  signal: AbortSignal,
) => {
  const hits = await fetchAddressHits(query, bias, signal);
  return hits.map(
    (hit): Finding => ({
      id: `geocoder:${hit.lng.toFixed(5)},${hit.lat.toFixed(5)}`,
      name: hit.label,
      lng: hit.lng,
      lat: hit.lat,
      address: hit.address,
      source: "geocoder",
    }),
  );
};

export type LineResults = {
  findings: Finding[];
  // A source that failed while the other answered. The line stays useful
  // and says what it is missing, instead of pretending it searched
  // everywhere.
  notice?: string;
};

export type SearchScope = {
  view: ViewBounds;
  bias: { lng: number; lat: number };
  // False when the map is pulled back too far for a name sweep. The
  // geocoder still answers, so an address stays findable from any altitude.
  scanMap: boolean;
};

// Both sources at once. One failing leaves the other's results standing with
// a notice; both failing throws, because then the line found nothing and the
// reason is the only useful thing left to say.
export const findPlaces = async (
  query: string,
  scope: SearchScope,
  signal: AbortSignal,
): Promise<LineResults> => {
  const [osm, geocoder] = await Promise.allSettled([
    scope.scanMap ? osmFindings(query, scope.view, signal) : Promise.resolve([]),
    geocoderFindings(query, scope.bias, signal),
  ]);
  if (osm.status === "rejected" && geocoder.status === "rejected") {
    throw osm.reason;
  }
  const mapHits = osm.status === "fulfilled" ? osm.value : [];
  const addressHits = geocoder.status === "fulfilled" ? geocoder.value : [];
  // A geocoder hit standing on top of an OSM hit of the same name is that
  // same shop; the OSM one wins because it knows the opening hours.
  const merged = mapHits.concat(
    addressHits.filter(
      (hit) =>
        !mapHits.some(
          (known) =>
            known.name.toLowerCase() === hit.name.toLowerCase() &&
            metersBetween(known.lat, known.lng, hit.lat, hit.lng) < SAME_PLACE_METERS,
        ),
    ),
  );
  if (osm.status === "rejected") {
    console.warn("[scout] overpass search failed:", osm.reason);
  }
  if (geocoder.status === "rejected") {
    console.warn("[scout] geocoder search failed:", geocoder.reason);
  }
  return { findings: merged.slice(0, RESULT_CAP), notice: noticeFor(scope, osm, geocoder) };
};

const noticeFor = (
  scope: SearchScope,
  osm: PromiseSettledResult<Finding[]>,
  geocoder: PromiseSettledResult<Finding[]>,
) => {
  if (osm.status === "rejected") return "Map search failed, showing address matches only.";
  if (geocoder.status === "rejected") return "Address lookup failed, showing map matches only.";
  if (!scope.scanMap) return "Zoom in to also sweep the map for every branch here.";
  return undefined;
};
