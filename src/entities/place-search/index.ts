// Client half of the worker's place search: autocomplete hits and place
// resolution, each behind an in-memory cache so retyping and re-ticking
// never re-spend the (budget-capped) server calls. The wire shapes here
// mirror src/routes/api.search.ts and api.place-details.ts, mirrored
// rather than imported because those files read worker bindings and must
// never enter the client bundle.

export type SearchHit = {
  placeId: string;
  name: string;
  // Where the place is, as the engine phrases it ("Paris, France").
  area?: string;
  kinds?: string[];
};

export type SearchAnswer = {
  hits: SearchHit[];
  // The server's reason for an empty-handed answer, surfaced to the line
  // notice instead of being mistaken for "no such place".
  reason?: "no key" | "budget exhausted";
};

// A period boundary in the place's own wall clock (day 0 = Sunday).
export type HoursPoint = { day: number; hour: number; minute: number };

export type GoogleHours = {
  periods: Array<{ open: HoursPoint; close?: HoursPoint }>;
  weekdayText: string[];
  utcOffsetMinutes: number;
};

export type PlaceSpot = {
  lng: number;
  lat: number;
  address?: string;
  hours?: GoogleHours;
};

// Caches hold the PROMISE, not the value: two surfaces asking the same
// question in the same instant (a tick and a fly on one hit, two lines
// typing one phrase) must share one paid request, not race two. A
// rejected promise leaves the cache so the next ask retries. An aborted
// caller's promise stays shared, so its abort must not use the shared
// fetch's signal (each caller races the shared promise against its own
// signal instead); here callers never abort mid-flight, so the shared
// fetch simply runs signal-less.
const hitCache = new Map<string, Promise<SearchAnswer>>();
const spotCache = new Map<string, Promise<PlaceSpot>>();

const dedupedLookup = <Answer>(
  cache: Map<string, Promise<Answer>>,
  key: string,
  ask: () => Promise<Answer>,
) => {
  const inFlight = cache.get(key);
  if (inFlight) return inFlight;
  const answer = ask();
  cache.set(key, answer);
  answer.catch(() => cache.delete(key));
  return answer;
};

export const fetchSearchHits = (
  query: string,
  bias: { lng: number; lat: number },
  signal: AbortSignal,
): Promise<SearchAnswer> => {
  const trimmed = query.trim();
  const key = `${trimmed.toLowerCase()}§${bias.lat.toFixed(2)},${bias.lng.toFixed(2)}`;
  const answer = dedupedLookup(hitCache, key, async () => {
    const params = new URLSearchParams({
      q: trimmed,
      lat: String(bias.lat),
      lng: String(bias.lng),
    });
    const res = await fetch(`/api/search?${params}`);
    if (!res.ok) throw new Error(`place search responded ${res.status}`);
    return (await res.json()) as SearchAnswer;
  });
  // The caller's abort races the joined answer without killing it for
  // whoever else is waiting on the same key.
  return Promise.race([
    answer,
    new Promise<never>((_, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason ?? new Error("aborted")), {
        once: true,
      });
    }),
  ]);
};

// Resolves a hit to coordinates (and, when asked, opening hours). Throws
// when the place cannot be resolved, because a caller was about to pin or
// fly to it and needs to say why it cannot.
export const fetchPlaceSpot = (placeId: string, wantHours: boolean): Promise<PlaceSpot> => {
  const key = `${placeId}:${wantHours ? 1 : 0}`;
  return dedupedLookup(spotCache, key, async () => {
    const params = new URLSearchParams({ id: placeId });
    if (wantHours) params.set("hours", "1");
    const res = await fetch(`/api/place-details?${params}`);
    if (!res.ok) throw new Error(`place details responded ${res.status}`);
    const spot = (await res.json()) as PlaceSpot & { reason?: string };
    if (spot.reason) throw new Error(`place details answered: ${spot.reason}`);
    // A located answer also answers the bare flavor, so a later locate
    // for the same place never spends a second call.
    if (wantHours) spotCache.set(`${placeId}:0`, Promise.resolve(spot));
    return spot;
  });
};
