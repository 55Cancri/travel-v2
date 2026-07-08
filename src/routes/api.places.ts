import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { sessionFromRequest } from "./-door";

// One place's Google rating, budget-guarded, with an optional hunt
// through its reviews. The client asks per pinned card (name +
// coordinates, plus a `mention` term like "vegan" for food cards); the
// answer caches in KV for 30 days, and monthly counters hard-stop Google
// calls before the free allotments end, so a runaway month costs zero
// instead of dollars per further thousand. The guards sit here because a
// dashboard-side quota cap is config someone can forget; these ship with
// the code.
//
// Two counters because Google bills by field mask: the plain
// rating/count mask rides the mid SKU (10k free per month), while adding
// `reviews` moves the call to the priciest SKU with a far smaller free
// allotment, so mention lookups get their own low ceiling.

const MONTHLY_CALL_CEILING = 9000;
const MONTHLY_REVIEW_CEILING = 500;
const CACHE_DAYS = 30;
const MATCH_RADIUS_METERS = 300;
const MENTION_SNIPPET_CHARS = 180;
const SEARCH_TEXT = "https://places.googleapis.com/v1/places:searchText";

type WireMention = {
  snippet: string;
  dateIso?: string;
  rating?: number;
};

type WirePlaceAnswer = {
  rating: number | null;
  count?: number;
  mapsUri?: string;
  mention?: WireMention;
  reason?: "no key" | "budget exhausted" | "no match";
};

type WireGoogleReview = {
  rating?: number;
  publishTime?: string;
  text?: { text?: string };
};

type WireGooglePlace = {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  location?: { latitude?: number; longitude?: number };
  reviews?: WireGoogleReview[];
};

const jsonBody = (payload: WirePlaceAnswer, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const metersBetween = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const toRad = Math.PI / 180;
  const x = (bLng - aLng) * toRad * Math.cos(((aLat + bLat) / 2) * toRad);
  const y = (bLat - aLat) * toRad;
  return Math.sqrt(x * x + y * y) * 6371000;
};

const monthStamp = () => {
  const now = Temporal.Now.plainDateISO("UTC");
  return `${now.year}-${String(now.month).padStart(2, "0")}`;
};

// Google exposes at most five reviews per place; the first one that
// speaks the term wins, trimmed to a readable window around the match.
const mentionIn = (reviews: WireGoogleReview[], term: string): WireMention | undefined => {
  const needle = term.toLowerCase();
  for (const review of reviews) {
    const text = review.text?.text;
    if (!text) continue;
    const at = text.toLowerCase().indexOf(needle);
    if (at < 0) continue;
    const start = Math.max(0, at - Math.floor((MENTION_SNIPPET_CHARS - needle.length) / 2));
    const end = Math.min(text.length, start + MENTION_SNIPPET_CHARS);
    const snippet =
      (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
    return { snippet, dateIso: review.publishTime, rating: review.rating };
  }
  return undefined;
};

export const Route = createFileRoute("/api/places")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if ((await sessionFromRequest(request)) === null) {
          return new Response(JSON.stringify({ error: "signed out" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const key = env.GOOGLE_PLACES_API_KEY;
        if (!key) return jsonBody({ rating: null, reason: "no key" });
        const url = new URL(request.url);
        const lat = Number(url.searchParams.get("lat"));
        const lng = Number(url.searchParams.get("lng"));
        const name = (url.searchParams.get("name") ?? "").slice(0, 120);
        const mention = (url.searchParams.get("mention") ?? "").slice(0, 40).toLowerCase();
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !name) {
          return jsonBody({ rating: null, reason: "no match" }, 400);
        }
        const cacheKey = `google:place:${mention ? `${mention}:` : ""}${name.toLowerCase()}:${lat.toFixed(4)}:${lng.toFixed(4)}`;
        const cached = await env.PLACE_CACHE.get(cacheKey);
        if (cached) {
          return new Response(cached, {
            headers: { "Content-Type": "application/json" },
          });
        }
        const counterKey = mention
          ? `google:reviews:${monthStamp()}`
          : `google:calls:${monthStamp()}`;
        const ceiling = mention ? MONTHLY_REVIEW_CEILING : MONTHLY_CALL_CEILING;
        const spent = Number((await env.PLACE_CACHE.get(counterKey)) ?? "0");
        if (spent >= ceiling) {
          return jsonBody({ rating: null, reason: "budget exhausted" });
        }
        // Not atomic, but the failure mode of a lost increment is a
        // slightly earlier ceiling stop, never a later one.
        await env.PLACE_CACHE.put(counterKey, String(spent + 1), {
          // Counters expire themselves two months out; a new month starts
          // a new key.
          expirationTtl: 60 * 60 * 24 * 62,
        });
        const res = await fetch(SEARCH_TEXT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask":
              "places.rating,places.userRatingCount,places.googleMapsUri,places.location" +
              (mention ? ",places.reviews" : ""),
          },
          body: JSON.stringify({
            textQuery: name,
            locationBias: {
              circle: { center: { latitude: lat, longitude: lng }, radius: 250 },
            },
            maxResultCount: 1,
          }),
        });
        if (!res.ok) {
          console.warn("[places] google searchText failed:", res.status, await res.text());
          return jsonBody({ rating: null, reason: "no match" }, 502);
        }
        const found = ((await res.json()) as { places?: WireGooglePlace[] }).places?.[0];
        const foundLat = found?.location?.latitude;
        const foundLng = found?.location?.longitude;
        const isSamePlace =
          found !== undefined &&
          foundLat !== undefined &&
          foundLng !== undefined &&
          metersBetween(lat, lng, foundLat, foundLng) <= MATCH_RADIUS_METERS;
        const answer: WirePlaceAnswer = isSamePlace
          ? {
              rating: found.rating ?? null,
              count: found.userRatingCount,
              mapsUri: found.googleMapsUri,
              mention: mention ? mentionIn(found.reviews ?? [], mention) : undefined,
            }
          : { rating: null, reason: "no match" };
        await env.PLACE_CACHE.put(cacheKey, JSON.stringify(answer), {
          expirationTtl: 60 * 60 * 24 * CACHE_DAYS,
        });
        return jsonBody(answer);
      },
    },
  },
});
