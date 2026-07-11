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

type DayRule = {
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

export const isOpenAt = (rules: DayRule[], moment: Temporal.ZonedDateTime) => {
  const day = moment.dayOfWeek;
  const minutes = moment.hour * 60 + moment.minute;
  let open = false;
  for (const rule of rules) {
    if (!rule.days[day]) continue;
    open = !rule.off && rule.spans.some((span) => minutes >= span.start && minutes < span.end);
  }
  // A span that crossed midnight yesterday can still be open now.
  const yesterday = day === 1 ? 7 : day - 1;
  for (const rule of rules) {
    if (rule.off || !rule.days[yesterday]) continue;
    if (rule.spans.some((span) => span.end > 1440 && minutes < span.end - 1440)) open = true;
  }
  return open;
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
