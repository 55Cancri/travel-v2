import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { sessionFromRequest } from "./-door";

// Place autocomplete, proxied so the key stays server-side and the spend
// stays capped. Deliberately sessionless: a Google autocomplete session
// terminated by a Pro or Enterprise details call bills at the priciest
// SKU, while bare requests ride the Essentials tier's 10k free events a
// month and the KV cache absorbs repeats. The field mask asks for the
// prediction text and nothing that would raise the tier; the suggestion's
// main text IS the display name, so details never needs to fetch one.
//
// The bias circle nudges ranking toward the map the user is looking at
// without fencing results in: a query that names another city ("hotel hoy
// paris") still resolves there, which is the whole point of switching to
// an engine that understands location words.

const MONTHLY_CALL_CEILING = 9000;
const CACHE_DAYS = 30;
const BIAS_RADIUS_METERS = 20_000;
const MAX_QUERY_CHARS = 120;
const AUTOCOMPLETE = "https://places.googleapis.com/v1/places:autocomplete";

export type WireSearchHit = {
  placeId: string;
  name: string;
  // Where the place is, as Google phrases it ("Paris, France").
  area?: string;
  // Google's type tags ("restaurant", "lodging"), for a row glyph later.
  kinds?: string[];
};

export type WireSearchAnswer = {
  hits: WireSearchHit[];
  reason?: "no key" | "budget exhausted";
};

type WireSuggestion = {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
    types?: string[];
  };
};

const jsonBody = (payload: WireSearchAnswer, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const monthStamp = () => {
  const now = Temporal.Now.plainDateISO("UTC");
  return `${now.year}-${String(now.month).padStart(2, "0")}`;
};

export const Route = createFileRoute("/api/search")({
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
        if (!key) return jsonBody({ hits: [], reason: "no key" });
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_CHARS);
        const lat = Number(url.searchParams.get("lat"));
        const lng = Number(url.searchParams.get("lng"));
        if (q.length < 3 || !Number.isFinite(lat) || !Number.isFinite(lng)) {
          return jsonBody({ hits: [] });
        }
        // The bias rounds to a ~1km grid so panning within a neighbourhood
        // reuses the cached answer instead of minting a new key per pixel.
        const cacheKey = `google:ac:${q.toLowerCase()}:${lat.toFixed(2)}:${lng.toFixed(2)}`;
        const cached = await env.PLACE_CACHE.get(cacheKey);
        if (cached) {
          return new Response(cached, { headers: { "Content-Type": "application/json" } });
        }
        const counterKey = `google:ac:${monthStamp()}`;
        const spent = Number((await env.PLACE_CACHE.get(counterKey)) ?? "0");
        if (spent >= MONTHLY_CALL_CEILING) {
          return jsonBody({ hits: [], reason: "budget exhausted" });
        }
        // Not atomic: simultaneous requests can each write the same
        // incremented value and UNDERCOUNT, so the ceiling can trip a few
        // calls late. The ceiling sits a thousand under the free tier to
        // absorb exactly that slack; two door-gated users cannot widen it
        // meaningfully. Counting is best-effort, so a KV write refusal
        // (per-key rate limit under a typing burst) must not fail the
        // search.
        try {
          await env.PLACE_CACHE.put(counterKey, String(spent + 1), {
            expirationTtl: 60 * 60 * 24 * 62,
          });
        } catch (error) {
          console.warn("[search] budget counter write failed:", error);
        }
        const res = await fetch(AUTOCOMPLETE, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask":
              "suggestions.placePrediction.placeId," +
              "suggestions.placePrediction.text.text," +
              "suggestions.placePrediction.structuredFormat.mainText.text," +
              "suggestions.placePrediction.structuredFormat.secondaryText.text," +
              "suggestions.placePrediction.types",
          },
          body: JSON.stringify({
            input: q,
            locationBias: {
              circle: { center: { latitude: lat, longitude: lng }, radius: BIAS_RADIUS_METERS },
            },
          }),
        });
        if (!res.ok) {
          console.warn("[search] google autocomplete failed:", res.status, await res.text());
          return jsonBody({ hits: [] }, 502);
        }
        const body = (await res.json()) as { suggestions?: WireSuggestion[] };
        const hits: WireSearchHit[] = [];
        for (const suggestion of body.suggestions ?? []) {
          const prediction = suggestion.placePrediction;
          const name =
            prediction?.structuredFormat?.mainText?.text ?? prediction?.text?.text;
          if (!prediction?.placeId || !name) continue;
          hits.push({
            placeId: prediction.placeId,
            name,
            area: prediction.structuredFormat?.secondaryText?.text,
            kinds: prediction.types,
          });
        }
        const answer: WireSearchAnswer = { hits };
        await env.PLACE_CACHE.put(cacheKey, JSON.stringify(answer), {
          expirationTtl: 60 * 60 * 24 * CACHE_DAYS,
        });
        return jsonBody(answer);
      },
    },
  },
});
