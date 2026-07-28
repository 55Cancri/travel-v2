// The app installs the polyfill from its router entry, which a unit run
// never reaches.
import "temporal-polyfill/global";
import { describe, expect, test } from "bun:test";
import { isOpenAt, nextChange, parseOpeningHours } from "./opening-hours";

// A moment in a fixed zone, so a verdict never depends on where the suite
// runs. 2026-07-27 is a Monday, which makes the weekday arithmetic readable.
const moment = (isoDay: string, clock: string) =>
  Temporal.ZonedDateTime.from(`${isoDay}T${clock}[UTC]`);

const MONDAY = "2026-07-27";
const WEDNESDAY = "2026-07-29";
const SATURDAY = "2026-08-01";

const rulesOf = (value: string) => {
  const rules = parseOpeningHours(value);
  if (!rules) throw new Error(`unparsed: ${value}`);
  return rules;
};

describe("parseOpeningHours", () => {
  test.each([
    ["ring the bell", "prose"],
    ["Mo-Fr sunrise-sunset", "unsupported time words"],
    ["Mo-Fr 09:00+", "open-ended span"],
  ])("returns null for %p (%s)", (value) => {
    expect(parseOpeningHours(value)).toBeNull();
  });

  test("skips holiday rules rather than failing the whole value", () => {
    expect(parseOpeningHours("Mo-Su 09:00-17:00; PH off")).not.toBeNull();
  });
});

describe("isOpenAt", () => {
  const shop = rulesOf("Mo-Sa 08:00-22:00; Su 10:00-18:00");

  test.each([
    [MONDAY, "07:59", false],
    [MONDAY, "08:00", true],
    [MONDAY, "21:59", true],
    // The closing minute itself is shut: a span runs up to its end, not through it.
    [MONDAY, "22:00", false],
  ])("%s at %s is open=%p", (day, clock, expected) => {
    expect(isOpenAt(shop, moment(day, clock))).toBe(expected);
  });

  test("a later rule overrides an earlier one for the days it names", () => {
    const closedWednesdays = rulesOf("Mo-Su 09:00-18:00; We off");
    expect(isOpenAt(closedWednesdays, moment(WEDNESDAY, "12:00"))).toBe(false);
    expect(isOpenAt(closedWednesdays, moment(MONDAY, "12:00"))).toBe(true);
  });

  test("a span that crossed midnight is still open in the small hours", () => {
    const bar = rulesOf("Fr-Sa 20:00-03:00");
    // Saturday 01:00 falls inside Friday's run, which ends at 03:00.
    expect(isOpenAt(bar, moment(SATURDAY, "01:00"))).toBe(true);
    expect(isOpenAt(bar, moment(SATURDAY, "04:00"))).toBe(false);
  });

  test("24/7 is open at every hour", () => {
    expect(isOpenAt(rulesOf("24/7"), moment(MONDAY, "03:30"))).toBe(true);
  });
});

describe("nextChange", () => {
  const shop = rulesOf("Mo-Sa 08:00-22:00; Su 10:00-18:00");
  // The wall clock of the flip is the whole point, so that is what we assert.
  const flipClock = (rules: Parameters<typeof nextChange>[0], at: Temporal.ZonedDateTime) => {
    const flip = nextChange(rules, at);
    return flip && `${flip.toPlainDate()} ${flip.toPlainTime().toString({ smallestUnit: "minute" })}`;
  };

  test("finds the hour an open place shuts", () => {
    expect(flipClock(shop, moment(MONDAY, "21:30"))).toBe("2026-07-27 22:00");
  });

  test("finds the hour a closed place opens", () => {
    expect(flipClock(shop, moment(MONDAY, "07:00"))).toBe("2026-07-27 08:00");
  });

  test("reaches into tomorrow once today is done", () => {
    expect(flipClock(shop, moment(MONDAY, "23:00"))).toBe("2026-07-28 08:00");
  });

  test("a split written around lunch is one unbroken stretch", () => {
    const split = rulesOf("Mo-Su 09:00-12:00,12:00-18:00");
    // Not a closing at noon: the touching spans merge, so the next change
    // is the real 18:00 shutter.
    expect(flipClock(split, moment(MONDAY, "11:00"))).toBe("2026-07-27 18:00");
  });

  test("a genuine midday break does close", () => {
    const siesta = rulesOf("Mo-Su 09:00-13:00,16:00-20:00");
    expect(flipClock(siesta, moment(MONDAY, "12:30"))).toBe("2026-07-27 13:00");
  });

  test("is null when nothing ever changes", () => {
    expect(nextChange(rulesOf("24/7"), moment(MONDAY, "12:00"))).toBeNull();
  });

  test("reports the wall clock across a daylight-saving shift", () => {
    // Amsterdam's clocks go back inside this run: 01:00 to 04:00 is four
    // hours on the wall but five elapsed. The shutter is still 04:00.
    const overnight = rulesOf("Su 01:00-04:00");
    const duringTheFold = Temporal.ZonedDateTime.from(
      "2026-10-25T01:30+02:00[Europe/Amsterdam]",
    );
    const flip = nextChange(overnight, duringTheFold);
    expect(flip?.toPlainTime().toString({ smallestUnit: "minute" })).toBe("04:00");
    expect(duringTheFold.until(flip!).total({ unit: "hours" })).toBe(3.5);
  });

  test("never reports a flip that already happened in a repeated hour", () => {
    // 02:30 occurs twice on this date. Standing in the SECOND one, the
    // earlier occurrence is in the past, and naming it would read as a shop
    // that closed before it was asked about.
    const late = rulesOf("Su 00:00-02:45");
    const secondPass = Temporal.ZonedDateTime.from(
      "2026-10-25T02:30+01:00[Europe/Amsterdam]",
    );
    const flip = nextChange(late, secondPass);
    expect(secondPass.until(flip!).total({ unit: "minutes" })).toBeGreaterThan(0);
  });
});
