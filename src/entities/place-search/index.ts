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

const hitCache = new Map<string, SearchAnswer>();
const spotCache = new Map<string, PlaceSpot>();

export const fetchSearchHits = async (
  query: string,
  bias: { lng: number; lat: number },
  signal: AbortSignal,
): Promise<SearchAnswer> => {
  const trimmed = query.trim();
  const key = `${trimmed.toLowerCase()}§${bias.lat.toFixed(2)},${bias.lng.toFixed(2)}`;
  const cached = hitCache.get(key);
  if (cached) return cached;
  const params = new URLSearchParams({
    q: trimmed,
    lat: String(bias.lat),
    lng: String(bias.lng),
  });
  const res = await fetch(`/api/search?${params}`, { signal });
  if (!res.ok) throw new Error(`place search responded ${res.status}`);
  const answer = (await res.json()) as SearchAnswer;
  hitCache.set(key, answer);
  return answer;
};

// Resolves a hit to coordinates (and, when asked, opening hours). Throws
// when the place cannot be resolved, because a caller was about to pin or
// fly to it and needs to say why it cannot.
export const fetchPlaceSpot = async (
  placeId: string,
  wantHours: boolean,
  signal?: AbortSignal,
): Promise<PlaceSpot> => {
  const key = `${placeId}:${wantHours ? 1 : 0}`;
  const cached = spotCache.get(key);
  if (cached) return cached;
  const params = new URLSearchParams({ id: placeId });
  if (wantHours) params.set("hours", "1");
  const res = await fetch(`/api/place-details?${params}`, { signal });
  if (!res.ok) throw new Error(`place details responded ${res.status}`);
  const spot = (await res.json()) as PlaceSpot & { reason?: string };
  if (spot.reason) throw new Error(`place details answered: ${spot.reason}`);
  spotCache.set(key, spot);
  // A located answer also answers the bare flavor, so a later locate for
  // the same place never spends a second call.
  if (wantHours) spotCache.set(`${placeId}:0`, spot);
  return spot;
};
