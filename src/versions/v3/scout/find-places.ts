// What one typed line resolves to. Two sources answer, and they answer at
// very different speeds: the geocoder returns in about a tenth of a second,
// while a name sweep of the visible map through Overpass routinely takes ten
// seconds. So results STREAM. Whatever has arrived is shown, and the line
// says when more is still coming. Waiting for both before showing anything
// is what made a fast search feel broken.
//
// The two sources answer different questions. Photon is a search index and
// handles "one specific place, wherever it is". Overpass is an analytics API,
// not an index, but it is the only way to ask "every branch of this chain
// inside what I am looking at", which is the thing the panel exists for. It
// is also the only source carrying opening hours.

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
  // why one result knows its hours and its neighbour does not.
  source: "osm" | "geocoder";
  // Carries a wikidata or wikipedia tag. The nearest thing OSM has to a
  // prominence signal, and the same one the trip planner uses to tell a
  // landmark from a lawn fixture.
  notable?: boolean;
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
// How long the expensive half waits before it starts. The whole call is
// aborted by the next keystroke, so this doubles as the sweep's own
// debounce: nobody sweeps for a phrase still being typed.
const SWEEP_DELAY_MS = 600;
// And how long it gets in total. The public Overpass instance queues, retries
// with backoff, and under load simply does not answer, and every sweep waits
// behind the one in front of it. Without a deadline one stuck query leaves
// the line saying "still sweeping" forever and blocks every later sweep.
// Giving up and saying so beats a spinner with no end.
const SWEEP_DEADLINE_MS = 20_000;

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
const CATEGORY_KEYS = [
  "shop",
  "amenity",
  "tourism",
  "leisure",
  "office",
  "healthcare",
  "craft",
  "historic",
  "railway",
  "public_transport",
];

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

const rest = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("aborted"));
      },
      { once: true },
    );
  });

// A lone latin letter or digit is too weak to search on, but a lone CJK
// character is a whole word, so length alone cannot be the test.
export const wordsOf = (query: string) =>
  query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 2 || /[^\p{ASCII}]/u.test(word));

// Overpass is asked for ANY of the typed words, and the ranking below sorts
// out which matches actually answer the whole phrase. Alternation, not the
// whole phrase: a museum whose entire name is "Nemo" has to come back for
// "Nemo Science", and it cannot if the query is one substring. Nor can the
// single most selective word do the job, because the word that is missing
// from the target's name is often the longest one ("science" here).
//
// POSIX ERE, which is what Overpass speaks, has alternation but no
// lookahead, so "all of these words in any order" is not expressible. Any
// word plus local ranking is the closest thing that fits in one query.
export const namePattern = (words: string[]) =>
  words.map((word) => escapeForQuery(word)).join("|");

// How much of what was typed a name accounts for, nudged by prominence.
// Word coverage alone gets this wrong in a way worth naming: for "Nemo
// Science", the museum is called just "Nemo" while its own rooftop bar is
// called "Bar of NEMO Science Center", so the bar covers more of the phrase
// than the thing everybody means. A wikidata tag is what separates them.
const relevanceOf = (finding: Finding, words: string[], phrase: string) => {
  const name = finding.name.toLowerCase();
  const covered = words.filter((word) => name.includes(word)).length;
  return (
    covered * 2 +
    (name.startsWith(phrase) ? 2 : 0) +
    (name === phrase ? 3 : 0) +
    (finding.notable ? 3 : 0)
  );
};

const rankFindings = (findings: Finding[], words: string[], phrase: string) =>
  findings
    .map((finding) => ({ finding, score: relevanceOf(finding, words, phrase) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.finding)
    .slice(0, RESULT_CAP);

const osmFindings = async (words: string[], view: ViewBounds, signal: AbortSignal) => {
  const needle = namePattern(words);
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
    const category = categoryOf(tags);
    // A street called Anemoonstraat substring-matches "nemo" and is not
    // somewhere you can go. Roads with no POI category drop out.
    if (tags.highway && !category) continue;
    findings.push({
      id,
      name,
      lng,
      lat,
      address: addressOf(tags),
      hours: tags.opening_hours,
      website: tags.website ?? tags["contact:website"],
      phone: tags.phone ?? tags["contact:phone"],
      category,
      source: "osm",
      notable: tags.wikidata !== undefined || tags.wikipedia !== undefined,
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

export type SearchScope = {
  view: ViewBounds;
  bias: { lng: number; lat: number };
  // False when the map is pulled back too far for a name sweep. The
  // geocoder still answers, so an address stays findable from any altitude.
  scanMap: boolean;
};

export type LineResults = {
  findings: Finding[];
  // A source that failed while the other answered, or a reason the sweep
  // did not run. The line stays useful and says what it is missing.
  notice?: string;
  // The slow half is still out. The panel says so rather than letting the
  // first few results look like the whole answer.
  sweeping: boolean;
};

// A geocoder hit standing on top of an OSM hit of the same name is that same
// shop; the OSM one wins because it knows the opening hours.
const merge = (mapHits: Finding[], addressHits: Finding[]) =>
  mapHits.concat(
    addressHits.filter(
      (hit) =>
        !mapHits.some(
          (known) =>
            known.name.toLowerCase() === hit.name.toLowerCase() &&
            metersBetween(known.lat, known.lng, hit.lat, hit.lng) < SAME_PLACE_METERS,
        ),
    ),
  );

// Reports through `onResults` every time a source lands. Resolves once both
// are done. Throws only when BOTH failed, because then the line found
// nothing and the reason is the only useful thing left to say.
export const findPlaces = async (
  query: string,
  scope: SearchScope,
  signal: AbortSignal,
  onResults: (results: LineResults) => void,
) => {
  const phrase = query.trim().toLowerCase();
  const words = wordsOf(query);
  let mapHits: Finding[] = [];
  let addressHits: Finding[] = [];
  let sweeping = scope.scanMap;
  const failures: string[] = [];

  const emit = () => {
    if (signal.aborted) return;
    onResults({
      findings: rankFindings(merge(mapHits, addressHits), words, phrase),
      notice: noticeFor(scope, failures, sweeping),
      sweeping,
    });
  };

  const address = geocoderFindings(query, scope.bias, signal)
    .then((hits) => {
      addressHits = hits;
    })
    .catch((error: unknown) => {
      if (!signal.aborted) console.warn("[scout] geocoder search failed:", error);
      failures.push("geocoder");
    })
    .then(emit);

  const sweep = (async () => {
    if (!scope.scanMap) return;
    // Aborted by the next keystroke, which is exactly the point.
    await rest(SWEEP_DELAY_MS, signal);
    // The caller's abort OR the deadline, whichever comes first.
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(SWEEP_DEADLINE_MS)]);
    return osmFindings(words, scope.view, bounded);
  })()
    .then((hits) => {
      if (hits) mapHits = hits;
    })
    .catch((error: unknown) => {
      if (!signal.aborted) {
        console.warn("[scout] map sweep failed:", error);
        failures.push("overpass");
      }
    })
    .then(() => {
      sweeping = false;
      emit();
    });

  await Promise.all([address, sweep]);
  if (failures.length >= 2) throw new Error("Neither the map nor the address lookup answered.");
};

const noticeFor = (scope: SearchScope, failures: string[], sweeping: boolean) => {
  if (failures.includes("overpass")) {
    return "The map sweep did not answer, so this is address matches only. Press the glass to retry.";
  }
  if (failures.includes("geocoder")) return "Address lookup failed, showing map matches only.";
  if (!scope.scanMap) return "Zoom in to also sweep the map for every branch here.";
  if (sweeping) return "Still sweeping the map for more matches...";
  return undefined;
};
