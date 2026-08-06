import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { sessionFromRequest } from "./-door";

// One place resolved from its Google place id, in two flavors that map to
// two billing tiers. The bare flavor (coordinates + address) rides the
// Essentials SKU and answers every "where is this result" press. Asking
// for hours moves the call to the Enterprise SKU, whose free allotment is
// tiny, so hours are fetched only at the moment a place is pinned into a
// map and carry their own low ceiling. Both flavors cache for 30 days.

const MONTHLY_LOCATE_CEILING = 9000;
const MONTHLY_HOURS_CEILING = 800;
const CACHE_DAYS = 30;
const PLACES = "https://places.googleapis.com/v1/places/";

// Google's period boundary: a weekday (0 = Sunday) and a wall-clock time
// in the place's own zone.
export type WireHoursPoint = { day: number; hour: number; minute: number };

export type WirePlaceHours = {
  periods: Array<{ open: WireHoursPoint; close?: WireHoursPoint }>;
  weekdayText: string[];
  utcOffsetMinutes: number;
};

export type WirePlaceSpot = {
  lng: number;
  lat: number;
  address?: string;
  hours?: WirePlaceHours;
  reason?: "no key" | "budget exhausted" | "no match";
};

type WireGoogleHours = {
  periods?: Array<{
    open?: { day?: number; hour?: number; minute?: number };
    close?: { day?: number; hour?: number; minute?: number };
  }>;
  weekdayDescriptions?: string[];
};

type WireGooglePlace = {
  location?: { latitude?: number; longitude?: number };
  formattedAddress?: string;
  regularOpeningHours?: WireGoogleHours;
  utcOffsetMinutes?: number;
};

const jsonBody = (payload: WirePlaceSpot | { error: string }, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const monthStamp = () => {
  const now = Temporal.Now.plainDateISO("UTC");
  return `${now.year}-${String(now.month).padStart(2, "0")}`;
};

// The REGULAR weekly schedule only, deliberately. Google's "current"
// hours are a dated seven-day window (holiday exceptions included), and
// replaying that window as a repeating week from a 30-day cache would
// repeat Christmas hours into January. The regular schedule is the one
// shape that stays true for a month. (The cached utcOffsetMinutes can go
// stale across a DST switch and shift verdicts an hour until the cache
// turns over; accepted for a schedule display.)
const hoursOf = (place: WireGooglePlace): WirePlaceHours | undefined => {
  const schedule = place.regularOpeningHours;
  const offset = place.utcOffsetMinutes;
  if (!schedule?.periods || offset === undefined) return undefined;
  const periods = [];
  for (const period of schedule.periods) {
    const open = period.open;
    if (open?.day === undefined || open.hour === undefined || open.minute === undefined) continue;
    const close = period.close;
    periods.push({
      open: { day: open.day, hour: open.hour, minute: open.minute },
      close:
        close?.day !== undefined && close.hour !== undefined && close.minute !== undefined
          ? { day: close.day, hour: close.hour, minute: close.minute }
          : undefined,
    });
  }
  if (periods.length === 0) return undefined;
  return {
    periods,
    weekdayText: schedule.weekdayDescriptions ?? [],
    utcOffsetMinutes: offset,
  };
};

export const Route = createFileRoute("/api/place-details")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if ((await sessionFromRequest(request)) === null) {
          return jsonBody({ error: "signed out" }, 401);
        }
        const key = env.GOOGLE_PLACES_API_KEY;
        if (!key) return jsonBody({ lng: 0, lat: 0, reason: "no key" });
        const url = new URL(request.url);
        const id = (url.searchParams.get("id") ?? "").slice(0, 300);
        const wantHours = url.searchParams.get("hours") === "1";
        // Place ids are Google's own token alphabet; anything outside it is
        // a malformed request, not a place.
        if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) {
          return jsonBody({ lng: 0, lat: 0, reason: "no match" }, 400);
        }
        const cacheKey = `google:pd:${id}:${wantHours ? 1 : 0}`;
        const cached = await env.PLACE_CACHE.get(cacheKey);
        if (cached) {
          return new Response(cached, { headers: { "Content-Type": "application/json" } });
        }
        const counterKey = wantHours
          ? `google:hours:${monthStamp()}`
          : `google:pd:${monthStamp()}`;
        const ceiling = wantHours ? MONTHLY_HOURS_CEILING : MONTHLY_LOCATE_CEILING;
        const spent = Number((await env.PLACE_CACHE.get(counterKey)) ?? "0");
        if (spent >= ceiling) {
          return jsonBody({ lng: 0, lat: 0, reason: "budget exhausted" });
        }
        // Not atomic: simultaneous requests can each write the same
        // incremented value and UNDERCOUNT, so the ceiling can trip a few
        // calls late. Both ceilings sit well under their free tiers to
        // absorb exactly that slack; two door-gated users cannot widen it
        // meaningfully. Counting is best-effort, so a KV write refusal
        // (per-key rate limit under a burst) must not fail the lookup.
        try {
          await env.PLACE_CACHE.put(counterKey, String(spent + 1), {
            expirationTtl: 60 * 60 * 24 * 62,
          });
        } catch (error) {
          console.warn("[place-details] budget counter write failed:", error);
        }
        const res = await fetch(`${PLACES}${id}`, {
          headers: {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask":
              "location,formattedAddress" +
              (wantHours ? ",regularOpeningHours,utcOffsetMinutes" : ""),
          },
        });
        if (!res.ok) {
          console.warn("[place-details] google place fetch failed:", res.status, await res.text());
          return jsonBody({ lng: 0, lat: 0, reason: "no match" }, 502);
        }
        const place = (await res.json()) as WireGooglePlace;
        const lat = place.location?.latitude;
        const lng = place.location?.longitude;
        if (lat === undefined || lng === undefined) {
          return jsonBody({ lng: 0, lat: 0, reason: "no match" }, 502);
        }
        const answer: WirePlaceSpot = {
          lng,
          lat,
          address: place.formattedAddress,
          hours: wantHours ? hoursOf(place) : undefined,
        };
        await env.PLACE_CACHE.put(cacheKey, JSON.stringify(answer), {
          expirationTtl: 60 * 60 * 24 * CACHE_DAYS,
        });
        return jsonBody(answer);
      },
    },
  },
});
