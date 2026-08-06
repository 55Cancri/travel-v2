// Is this place open right now, and when does that change? Judged in the
// place's OWN timezone, because a traveler reading the map is often not in
// it yet, and "closes at 8pm" has to mean 8pm where the shop stands.
//
// The clock is passed in rather than read here, so a verdict is a pure
// function of a moment. That is what lets the screen re-ask every minute
// (a shop that shuts while the map is open must stop claiming to be open)
// without any of this having to know that a screen exists.

import * as React from "react";
import tzLookup from "tz-lookup";
import { clockLabel, isOpenAt, nextChange, parseOpeningHours } from "entities/osm";
import type { GoogleHours, HoursPoint } from "entities/place-search";
import type { PlaceHours } from "entities/scout-maps";

export type OpenVerdict = {
  // "unknown" covers both an untagged place and hours written outside the
  // grammar we parse. Neither is evidence that the door is shut, so the map
  // never paints it as closed.
  phase: "open" | "closed" | "unknown";
  // Wall clock of the next flip, when it is near enough to act on.
  at?: string;
};

// Past half a day out, the next flip stops being useful to a person
// standing on the map today.
const HORIZON_MINUTES = 12 * 60;

// Takes any spot-shaped value (a search finding, a saved place's OSM
// hours): raw opening_hours plus where the place stands. Engine hits carry
// no hours (and no coordinates until resolved), so they read as unknown
// rather than closed.
export const openVerdict = (
  spot: { hours?: string; lat?: number; lng?: number },
  now: Temporal.Instant,
): OpenVerdict => {
  if (!spot.hours || spot.lat === undefined || spot.lng === undefined) {
    return { phase: "unknown" };
  }
  const rules = parseOpeningHours(spot.hours);
  if (!rules) return { phase: "unknown" };
  const moment = now.toZonedDateTimeISO(tzLookup(spot.lat, spot.lng));
  const flipAt = nextChange(rules, moment);
  const soon = flipAt !== null && moment.until(flipAt).total({ unit: "minutes" }) <= HORIZON_MINUTES;
  return {
    phase: isOpenAt(rules, moment) ? "open" : "closed",
    at: soon && flipAt !== null ? clockLabel(flipAt) : undefined,
  };
};

const WEEK_MINUTES = 7 * 24 * 60;

const minutesOfWeek = (day: number, hour: number, minute: number) =>
  (day * 24 + hour) * 60 + minute;

const clockOf = (point: HoursPoint) => `${point.hour}:${String(point.minute).padStart(2, "0")}`;

// The engine's schedule speaks in weekly periods and a UTC offset, so the
// verdict needs no timezone database: the place's wall clock is now plus
// its offset. Google's convention for always-open is a single period with
// an open and no close.
export const googleOpenVerdict = (hours: GoogleHours, now: Temporal.Instant): OpenVerdict => {
  const local = now.toZonedDateTimeISO("UTC").add({ minutes: hours.utcOffsetMinutes });
  // Temporal counts Monday as 1 through Sunday as 7; the schedule counts
  // Sunday as 0.
  const t = minutesOfWeek(local.dayOfWeek % 7, local.hour, local.minute);
  let closesIn = Infinity;
  let closesAt: HoursPoint | null = null;
  let opensIn = Infinity;
  let opensAt: HoursPoint | null = null;
  for (const period of hours.periods) {
    if (!period.close) return { phase: "open" };
    const start = minutesOfWeek(period.open.day, period.open.hour, period.open.minute);
    let end = minutesOfWeek(period.close.day, period.close.hour, period.close.minute);
    // A period that closes past the week's wrap (Saturday night into
    // Sunday) ends "next week" in minutes-of-week terms.
    if (end <= start) end += WEEK_MINUTES;
    // The moment is tested against this week's copy of the period and
    // last week's (a Sunday 01:00 falls inside Saturday's late window).
    for (const copy of [t, t + WEEK_MINUTES]) {
      if (copy >= start && copy < end && end - copy < closesIn) {
        closesIn = end - copy;
        closesAt = period.close;
      }
    }
    const untilOpen = (start - t + WEEK_MINUTES) % WEEK_MINUTES;
    if (untilOpen < opensIn) {
      opensIn = untilOpen;
      opensAt = period.open;
    }
  }
  if (closesAt) {
    return {
      phase: "open",
      at: closesIn <= HORIZON_MINUTES ? clockOf(closesAt) : undefined,
    };
  }
  if (hours.periods.length === 0) return { phase: "unknown" };
  return {
    phase: "closed",
    at: opensAt && opensIn <= HORIZON_MINUTES ? clockOf(opensAt) : undefined,
  };
};

// One verdict for whichever grammar a saved place's hours arrived in.
export const placeOpenVerdict = (
  place: { hours?: PlaceHours; lat: number; lng: number },
  now: Temporal.Instant,
): OpenVerdict => {
  if (!place.hours) return { phase: "unknown" };
  return place.hours.kind === "osm"
    ? openVerdict({ hours: place.hours.raw, lat: place.lat, lng: place.lng }, now)
    : googleOpenVerdict(place.hours, now);
};

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Today's line of the weekly schedule ("Tuesday: 10:00 AM – 5:30 PM"),
// the card's fallback when the next open/close flip is too far out to
// name. Matched by the day NAME rather than position, because the
// engine's ordering of the sentences is not contractual; the positional
// read stays only as the fallback for a non-English answer.
export const googleTodayLine = (hours: GoogleHours, now: Temporal.Instant) => {
  if (hours.weekdayText.length === 0) return null;
  const local = now.toZonedDateTimeISO("UTC").add({ minutes: hours.utcOffsetMinutes });
  const name = WEEKDAY_NAMES[local.dayOfWeek - 1];
  return (
    hours.weekdayText.find((line) => line.startsWith(name)) ??
    hours.weekdayText[local.dayOfWeek - 1] ??
    null
  );
};

// The full sentence, for a result row and the map's popup.
export const openLine = (verdict: OpenVerdict) => {
  if (verdict.phase === "unknown") return null;
  if (verdict.phase === "open") return verdict.at ? `Open · closes ${verdict.at}` : "Open";
  return verdict.at ? `Closed · opens ${verdict.at}` : "Closed";
};

// The terse form that rides under a pin, where every character competes
// with the map underneath.
export const openTag = (verdict: OpenVerdict) => {
  if (verdict.phase === "unknown") return null;
  if (verdict.phase === "open") return verdict.at ? `closes ${verdict.at}` : null;
  return verdict.at ? `closed · opens ${verdict.at}` : "closed";
};

// A clock that advances once a minute, so every verdict on screen re-reads
// itself. Minute resolution is all opening hours have.
export function useMinuteClock() {
  const [now, storeNow] = React.useState(() => Temporal.Now.instant());
  React.useEffect(() => {
    const timer = setInterval(() => storeNow(Temporal.Now.instant()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
