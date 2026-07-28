// A pragmatic subset of OSM's opening_hours grammar: "24/7", rules joined
// by semicolons, each an optional day list ("Mo-Fr", "Sa,Su") plus time
// spans ("08:00-22:00,23:00-01:00") or off/closed. Later rules override
// earlier ones for the days they cover, matching OSM semantics. Holiday
// selectors (PH/SH) are skipped rather than failing the whole value.
// Anything outside the subset returns null: callers then show the raw
// string and render no open/closed verdict.

type TimeSpan = {
  // Minutes from midnight; end past 1440 means the span crosses midnight.
  start: number;
  end: number;
};

export type DayRule = {
  // Indexed by ISO day (1 = Monday ... 7 = Sunday).
  days: boolean[];
  spans: TimeSpan[];
  off: boolean;
};

const DAY_NUM: Record<string, number> = { Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 7 };

const parseDays = (value: string) => {
  const days = new Array<boolean>(8).fill(false);
  if (!value) return days.fill(true, 1);
  for (const token of value.split(",")) {
    const range = token.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!range) return null;
    const from = DAY_NUM[range[1]];
    const to = range[2] ? DAY_NUM[range[2]] : from;
    // A wrapped range like Sa-Tu walks through Sunday.
    for (let day = from; ; day = (day % 7) + 1) {
      days[day] = true;
      if (day === to) break;
    }
  }
  return days;
};

const parseSpans = (value: string) => {
  const spans: TimeSpan[] = [];
  for (const token of value.split(",")) {
    const match = token.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const start = Number(match[1]) * 60 + Number(match[2]);
    let end = Number(match[3]) * 60 + Number(match[4]);
    if (end <= start) end += 1440;
    spans.push({ start, end });
  }
  return spans;
};

export const parseOpeningHours = (value: string): DayRule[] | null => {
  const trimmed = value.trim();
  if (trimmed === "24/7") {
    return [{ days: new Array<boolean>(8).fill(true), spans: [{ start: 0, end: 1440 }], off: false }];
  }
  const rules: DayRule[] = [];
  for (const part of trimmed.split(";")) {
    const rule = part.trim();
    if (!rule) continue;
    if (/\b(PH|SH)\b/.test(rule)) continue;
    const match = rule.match(/^([A-Za-z,-]*)\s*(.+)$/);
    if (!match) return null;
    const days = parseDays(match[1]);
    if (!days) return null;
    const times = match[2].trim();
    if (times === "off" || times === "closed") {
      rules.push({ days, spans: [], off: true });
      continue;
    }
    const spans = parseSpans(times);
    if (!spans) return null;
    rules.push({ days, spans, off: false });
  }
  return rules.length ? rules : null;
};

// Which spans actually apply on an ISO weekday: the last rule covering that
// day wins outright, so "Mo-Su 09:00-18:00; We off" leaves Wednesday with
// nothing. Both the open/closed verdict and the next-change scan read the
// rule list through here, so they can never disagree about a day.
const effectiveSpans = (rules: DayRule[], day: number) => {
  let spans: TimeSpan[] = [];
  for (const rule of rules) {
    if (rule.days[day]) spans = rule.off ? [] : rule.spans;
  }
  return spans;
};

export const isOpenAt = (rules: DayRule[], moment: Temporal.ZonedDateTime) => {
  const day = moment.dayOfWeek;
  const minutes = moment.hour * 60 + moment.minute;
  if (effectiveSpans(rules, day).some((span) => minutes >= span.start && minutes < span.end)) {
    return true;
  }
  // A span that crossed midnight yesterday can still be open now.
  const yesterday = day === 1 ? 7 : day - 1;
  return effectiveSpans(rules, yesterday).some(
    (span) => span.end > 1440 && minutes < span.end - 1440,
  );
};

// Every opening span from yesterday through a week out, in minutes measured
// from today's midnight (so yesterday's run at offset -1 can reach past
// midnight into now). Touching spans merge, so a value split at lunchtime
// ("09:00-12:00,12:00-18:00") reads as one unbroken stretch instead of a
// closing at noon.
const SCAN_DAYS = 7;
// Where the scan runs out of days. A stretch reaching this far is not a
// stretch that ends; it is one this function cannot see the end of.
const SCAN_END = (SCAN_DAYS + 1) * 1440;

const upcomingSpans = (rules: DayRule[], fromDay: number) => {
  const spans: TimeSpan[] = [];
  for (let offset = -1; offset <= SCAN_DAYS; offset++) {
    const day = ((fromDay - 1 + offset + 7) % 7) + 1;
    for (const span of effectiveSpans(rules, day)) {
      spans.push({ start: offset * 1440 + span.start, end: offset * 1440 + span.end });
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const merged: TimeSpan[] = [];
  for (const span of spans) {
    const last = merged.at(-1);
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
};

// When the open/closed verdict next flips: the moment an open place shuts,
// or a closed one opens. Null when nothing changes inside a week (a 24/7
// place, or one whose rules never open at all), which is exactly when a
// "closes at" line should be absent rather than guessed.
//
// A ZonedDateTime rather than a count of minutes, because opening hours are
// WALL CLOCK and a duration is not. On the night the clocks go back, a shop
// shutting at 04:00 is five elapsed hours from 01:00 but four hours on the
// wall, and a caller adding the duration would label it an hour early.
// Rebuilding the wall time on the target day leaves that arithmetic to
// Temporal, which knows about the repeated hour.
export const nextChange = (rules: DayRule[], moment: Temporal.ZonedDateTime) => {
  const minutes = moment.hour * 60 + moment.minute;
  const spans = upcomingSpans(rules, moment.dayOfWeek);
  const current = spans.find((span) => minutes >= span.start && minutes < span.end);
  // An open stretch that runs to the edge of the scan (a 24/7 place) has no
  // closing time to report. Returning the edge itself would invent one.
  if (current && current.end >= SCAN_END) return null;
  const boundary = current ? current.end : spans.find((span) => span.start > minutes)?.start;
  if (boundary === undefined) return null;
  const dayOffset = Math.floor(boundary / 1440);
  const minuteOfDay = boundary % 1440;
  return moment
    .startOfDay()
    .add({ days: dayOffset })
    .with({ hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 });
};

const clock12 = (raw: string) => {
  const [hourRaw, minute] = raw.split(":");
  const hour = Number(hourRaw) % 24;
  const meridiem = hour < 12 ? "am" : "pm";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return minute === "00" ? `${display}${meridiem}` : `${display}:${minute}${meridiem}`;
};

// The raw value with each 24-hour time rewritten in 12-hour form:
// "Tu-Su 17:00-22:00" reads "Tu-Su 5pm-10pm". Day tokens stay as mapped.
export const formatHours = (value: string) => value.replace(/\b(\d{1,2}:\d{2})\b/g, clock12);

// A wall-clock label for one moment, in the same 12-hour form the raw hours
// render in, so "Closes at 8pm" and "Mo-Sa 10am-8pm" agree on screen.
export const clockLabel = (moment: Temporal.ZonedDateTime) =>
  clock12(`${moment.hour}:${String(moment.minute).padStart(2, "0")}`);
