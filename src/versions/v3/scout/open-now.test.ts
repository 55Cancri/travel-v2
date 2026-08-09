import { describe, expect, test } from "bun:test";
import "temporal-polyfill/global";
import type { GoogleHours } from "entities/place-search";
import { googleOpenVerdict, googleTodayLine, openLine } from "./open-now";

// The engine-hours verdict: weekly periods plus a UTC offset, no timezone
// database. The traps worth testing are the week wrap (Saturday night
// into Sunday), the always-open convention (one period, no close), and
// the horizon that keeps far-off flips out of the card.

// Amsterdam summer offset.
const CEST = 120;

const schedule = (
  periods: GoogleHours["periods"],
  utcOffsetMinutes = CEST,
): GoogleHours => ({ periods, utcOffsetMinutes, weekdayText: [] });

// A Wednesday: 2026-08-05T12:00 in CEST is 10:00 UTC.
const wednesdayNoon = Temporal.Instant.from("2026-08-05T10:00:00Z");
// Sunday 01:30 local.
const sundaySmallHours = Temporal.Instant.from("2026-08-08T23:30:00Z");

describe("googleOpenVerdict", () => {
  test("open now, closing within the horizon, names the time", () => {
    const verdict = googleOpenVerdict(
      schedule([
        { open: { day: 3, hour: 10, minute: 0 }, close: { day: 3, hour: 17, minute: 30 } },
      ]),
      wednesdayNoon,
    );
    expect(verdict).toEqual({ phase: "open", at: "5:30p" });
  });

  test("closed now, next opening tomorrow morning is past the horizon", () => {
    const verdict = googleOpenVerdict(
      schedule([
        { open: { day: 4, hour: 10, minute: 0 }, close: { day: 4, hour: 17, minute: 0 } },
      ]),
      wednesdayNoon,
    );
    expect(verdict.phase).toBe("closed");
    expect(verdict.at).toBeUndefined();
  });

  test("a Saturday-night window that wraps the week still covers Sunday 01:30", () => {
    const verdict = googleOpenVerdict(
      schedule([
        { open: { day: 6, hour: 22, minute: 0 }, close: { day: 0, hour: 3, minute: 0 } },
      ]),
      sundaySmallHours,
    );
    expect(verdict).toEqual({ phase: "open", at: "3a" });
  });

  test("one period with no close means open 24 hours, said outright", () => {
    const verdict = googleOpenVerdict(
      schedule([{ open: { day: 0, hour: 0, minute: 0 } }]),
      wednesdayNoon,
    );
    expect(verdict).toEqual({ phase: "open", always: true });
    // A bare "Open" would read as "hours unstated".
    expect(openLine(verdict)).toBe("Open 24 hours");
  });

  test("no periods at all is unknown, never closed", () => {
    expect(googleOpenVerdict(schedule([]), wednesdayNoon).phase).toBe("unknown");
  });
});

describe("googleTodayLine", () => {
  test("picks the local weekday from the Monday-first sentences", () => {
    const hours: GoogleHours = {
      periods: [],
      utcOffsetMinutes: CEST,
      weekdayText: [
        "Monday: Closed",
        "Tuesday: 10:00 AM – 5:30 PM",
        "Wednesday: 10:00 AM – 5:30 PM",
        "Thursday: 10:00 AM – 5:30 PM",
        "Friday: 10:00 AM – 5:30 PM",
        "Saturday: 10:00 AM – 5:30 PM",
        "Sunday: Closed",
      ],
    };
    expect(googleTodayLine(hours, wednesdayNoon)).toBe("Wednesday: 10:00 AM – 5:30 PM");
  });
});
