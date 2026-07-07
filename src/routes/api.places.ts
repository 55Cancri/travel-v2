import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

// One place's Google rating, budget-guarded. The client asks per pinned
// card (name + coordinates); the answer caches in KV for 30 days, and a
// monthly counter hard-stops Google calls before the free tier's 10k
// ceiling, so a runaway month costs zero instead of $2.83 per further
// thousand. Both guards sit here because the dashboard-side quota cap is
// advisory config someone can forget; this one ships with the code.

const MONTHLY_CALL_CEILING = 9000;
const CACHE_DAYS = 30;
const MATCH_RADIUS_METERS = 300;
const SEARCH_TEXT = "https://places.googleapis.com/v1/places:searchText";

type WirePlaceAnswer = {
  rating: number | null;
  count?: number;
  mapsUri?: string;
  reason?: "no key" | "budget exhausted" | "no match";
};

type WireGooglePlace = {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  location?: { latitude?: number; longitude?: number };
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

const monthKey = () => {
  const now = Temporal.Now.plainDateISO("UTC");
  return `google:calls:${now.year}-${String(now.month).padStart(2, "0")}`;
};

export const Route = createFileRoute("/api/places")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = env.GOOGLE_PLACES_API_KEY;
        if (!key) return jsonBody({ rating: null, reason: "no key" });
        const url = new URL(request.url);
        const lat = Number(url.searchParams.get("lat"));
        const lng = Number(url.searchParams.get("lng"));
        const name = (url.searchParams.get("name") ?? "").slice(0, 120);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !name) {
          return jsonBody({ rating: null, reason: "no match" }, 400);
        }
        const cacheKey = `google:place:${name.toLowerCase()}:${lat.toFixed(4)}:${lng.toFixed(4)}`;
        const cached = await env.PLACE_CACHE.get(cacheKey);
        if (cached) {
          return new Response(cached, {
            headers: { "Content-Type": "application/json" },
          });
        }
        const spentRaw = await env.PLACE_CACHE.get(monthKey());
        const spent = Number(spentRaw ?? "0");
        if (spent >= MONTHLY_CALL_CEILING) {
          return jsonBody({ rating: null, reason: "budget exhausted" });
        }
        // Not atomic, but the failure mode of a lost increment is a
        // slightly earlier ceiling stop with a 1000-call margin above it.
        await env.PLACE_CACHE.put(monthKey(), String(spent + 1), {
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
              "places.rating,places.userRatingCount,places.googleMapsUri,places.location",
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
