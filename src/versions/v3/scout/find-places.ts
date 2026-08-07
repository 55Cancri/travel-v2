// What one typed line resolves to. Two sources answer two different
// questions and get two separate result sections, never blended:
//
// - Google autocomplete is the search engine. It is typo tolerant, ranks
//   by prominence, and understands location words, so "hotel hoy paris"
//   lands on the Paris hotel from anywhere on Earth. Its hits carry NO
//   coordinates until a details call resolves them, which happens on the
//   first interaction with a hit (tick, or press to fly), never
//   speculatively, because details calls are the budgeted resource.
// - Overpass answers "every branch of this chain inside what I am looking
//   at", which no search engine does. It is slow (routinely ten seconds),
//   view-scoped by nature, and the only source carrying OSM opening
//   hours, so its answers stream in under their own clearly labeled
//   section instead of polluting the engine's ranking.
//
// Each source's fresh answer REPLACES its section wholesale. The blending
// and cross-source ranking this file used to do existed to prop up two
// weak sources; with a real engine on top it only reintroduced the noise
// (an Amsterdam hotel outranking the Paris hotel someone typed).

import { fetchSearchHits, type GoogleHours } from "entities/place-search";
import { overpassQuery } from "entities/osm";

export type ViewBounds = { south: number; west: number; north: number; east: number };

export type Finding = {
  id: string;
  name: string;
  // Engine hits are born without coordinates; a details call fills them
  // in on first interaction. Sweep hits always carry them.
  lng?: number;
  lat?: number;
  // For engine hits this opens as the engine's area line ("Paris,
  // France") and becomes the full street address once resolved.
  address?: string;
  // The raw OSM opening_hours value, still in 24-hour local wall time.
  // Only sweep hits carry hours; a pinned engine hit fetches its own.
  hours?: string;
  // The engine's structured schedule, fetched the first time the hit is
  // ticked onto the map; hoursKnown marks that the ask has ANSWERED
  // (with or without a schedule), which is what ends a "Loading
  // times..." line.
  spotHours?: GoogleHours;
  hoursKnown?: boolean;
  website?: string;
  phone?: string;
  // What OSM calls this kind of place ("Electronics", "Supermarket").
  category?: string;
  source: "google" | "osm";
  // The engine's place id, the key for resolving coordinates and hours.
  placeId?: string;
  // Carries a wikidata or wikipedia tag. The nearest thing OSM has to a
  // prominence signal.
  notable?: boolean;
};

// Below three characters a name regex matches half a city, and below this
// zoom the view covers more ground than the public Overpass instance should
// be asked to scan.
export const MIN_QUERY_CHARS = 3;
export const MIN_SEARCH_ZOOM = 11;

const SWEEP_RESULT_CAP = 120;
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

const rankSweep = (findings: Finding[], words: string[], phrase: string) =>
  findings
    .map((finding) => ({ finding, score: relevanceOf(finding, words, phrase) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.finding)
    .slice(0, SWEEP_RESULT_CAP);

const sweepFindings = async (words: string[], view: ViewBounds, signal: AbortSignal) => {
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

export type SearchScope = {
  view: ViewBounds;
  bias: { lng: number; lat: number };
  // False when the map is pulled back too far for a name sweep. The
  // engine still answers, so anything stays findable from any altitude.
  scanMap: boolean;
};

export type LineResults = {
  // The engine's hits, in the engine's own order.
  places: Finding[];
  // The view sweep's hits, ranked locally.
  nearby: Finding[];
  // A source that failed while the other answered, or a reason the sweep
  // did not run. The line stays useful and says what it is missing.
  notice?: string;
  // The slow half is still out. The panel says so rather than letting the
  // first few results look like the whole answer.
  sweeping: boolean;
};

// Reports through `onResults` every time a source lands. Resolves once both
// are done. Throws only when BOTH failed, because then the line found
// nothing and the reason is the only useful thing left to say.
export const findPlaces = async (
  query: string,
  scope: SearchScope,
  signal: AbortSignal,
  onResults: (results: LineResults) => void,
  // The sweep runs only when the owner asked this query for it: it is
  // slow, view-bound, and uninvited it read as noise beside the
  // engine's answers.
  wantSweep: boolean,
) => {
  const phrase = query.trim().toLowerCase();
  const words = wordsOf(query);
  const sweepDue = wantSweep && scope.scanMap;
  let places: Finding[] = [];
  let nearby: Finding[] = [];
  let engineReason: string | undefined;
  let sweeping = sweepDue;
  const failures: string[] = [];

  const emit = () => {
    if (signal.aborted) return;
    onResults({
      places,
      nearby,
      notice: noticeFor(scope, failures, sweeping, engineReason, wantSweep),
      sweeping,
    });
  };

  const engine = fetchSearchHits(query, scope.bias, signal)
    .then((answer) => {
      engineReason = answer.reason;
      places = answer.hits.map(
        (hit): Finding => ({
          id: `google:${hit.placeId}`,
          name: hit.name,
          address: hit.area,
          source: "google",
          placeId: hit.placeId,
        }),
      );
    })
    .catch((error: unknown) => {
      if (!signal.aborted) console.warn("[scout] engine search failed:", error);
      failures.push("engine");
    })
    .then(emit);

  const sweep = (async () => {
    if (!sweepDue) return;
    // Aborted by the next keystroke, which is exactly the point.
    await rest(SWEEP_DELAY_MS, signal);
    // The caller's abort OR the deadline, whichever comes first.
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(SWEEP_DEADLINE_MS)]);
    return sweepFindings(words, scope.view, bounded);
  })()
    .then((hits) => {
      if (hits) nearby = rankSweep(hits, words, phrase);
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

  await Promise.all([engine, sweep]);
  // Thrown only when every source that RAN failed: an unasked or
  // out-of-zoom sweep never runs, and an engine failure there is a
  // total failure, not a quiet empty answer.
  const attempted = sweepDue ? 2 : 1;
  if (failures.length >= attempted) {
    throw new Error("Neither the search engine nor the map sweep answered.");
  }
};

const noticeFor = (
  scope: SearchScope,
  failures: string[],
  sweeping: boolean,
  engineReason: string | undefined,
  wantSweep: boolean,
) => {
  if (engineReason === "budget exhausted") {
    // Both halves can be gone at once, and the notice must not promise
    // sweep results that never came.
    return failures.includes("overpass")
      ? "This month's search budget is spent and the map sweep did not answer."
      : "This month's search budget is spent, so this is the map sweep only.";
  }
  if (engineReason === "no key") return "Place search is not configured on this server.";
  if (failures.includes("engine")) return "The search engine did not answer, map sweep only.";
  if (failures.includes("overpass")) {
    return "The map sweep did not answer, so this is search hits only. Press the glass to retry.";
  }
  // Sweep talk only reaches someone who asked for a sweep.
  if (wantSweep && !scope.scanMap) {
    return "Zoom in closer to sweep the map for every match here.";
  }
  if (sweeping) return "Still sweeping the map for more matches...";
  return undefined;
};
