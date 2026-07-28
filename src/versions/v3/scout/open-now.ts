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
import type { Finding } from "./find-places";

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

export const openVerdict = (finding: Finding, now: Temporal.Instant): OpenVerdict => {
  if (!finding.hours) return { phase: "unknown" };
  const rules = parseOpeningHours(finding.hours);
  if (!rules) return { phase: "unknown" };
  const moment = now.toZonedDateTimeISO(tzLookup(finding.lat, finding.lng));
  const flipAt = nextChange(rules, moment);
  const soon = flipAt !== null && moment.until(flipAt).total({ unit: "minutes" }) <= HORIZON_MINUTES;
  return {
    phase: isOpenAt(rules, moment) ? "open" : "closed",
    at: soon && flipAt !== null ? clockLabel(flipAt) : undefined,
  };
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
