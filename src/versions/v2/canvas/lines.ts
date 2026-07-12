// The canvas document: a flat list of lines, each carrying its own indent
// and marker kind, its content a run of styled spans. Pure logic only;
// the Canvas component owns state and the DOM.

export type LineKind = "text" | "bullet" | "checkbox" | "numbered";

export type Mark = "bold" | "italic" | "underline" | "strike";

export type Span = { text: string; marks: Mark[] };

export type Line = {
  id: string;
  spans: Span[];
  indent: number;
  kind: LineKind;
  done: boolean;
};

export const MAX_INDENT = 5;

export const newLine = (seed?: Partial<Omit<Line, "id">>) => ({
  id: crypto.randomUUID(),
  spans: [] as Span[],
  indent: 0,
  kind: "text" as LineKind,
  done: false,
  ...seed,
});

export const textOf = (spans: Span[]) => spans.map((span) => span.text).join("");

export const plainSpans = (text: string): Span[] =>
  text === "" ? [] : [{ text, marks: [] }];

const MARK_ORDER: Mark[] = ["bold", "italic", "underline", "strike"];

// One canonical spelling per mark set: deduped, fixed order. Everything
// downstream (merging, DOM comparison) relies on it.
const canonicalMarks = (marks: Mark[]) =>
  MARK_ORDER.filter((mark) => marks.includes(mark));

const sameMarks = (a: Mark[], b: Mark[]) =>
  a.length === b.length && a.every((mark, i) => b[i] === mark);

// Drops empty runs, canonicalizes each run's marks, and merges adjacent
// runs that carry identical marks, so every span list has exactly one
// shape per content.
export const normalizeSpans = (spans: Span[]) => {
  const merged: Span[] = [];
  for (const entry of spans) {
    if (entry.text === "") continue;
    const span = { text: entry.text, marks: canonicalMarks(entry.marks) };
    const tail = merged.at(-1);
    if (tail && sameMarks(tail.marks, span.marks)) {
      merged[merged.length - 1] = { ...tail, text: tail.text + span.text };
    } else {
      merged.push(span);
    }
  }
  return merged;
};

// The [start, end) substring of a span list, marks intact.
export const sliceSpans = (spans: Span[], start: number, end = Infinity) => {
  const kept: Span[] = [];
  let at = 0;
  for (const span of spans) {
    const spanStart = at;
    const spanEnd = at + span.text.length;
    at = spanEnd;
    if (spanEnd <= start || spanStart >= end) continue;
    kept.push({
      ...span,
      text: span.text.slice(Math.max(0, start - spanStart), Math.min(span.text.length, end - spanStart)),
    });
  }
  return normalizeSpans(kept);
};

export const concatSpans = (a: Span[], b: Span[]) => normalizeSpans(a.concat(b));

// Toggles a mark over [start, end): when every covered character already
// carries it the mark lifts, otherwise the whole range gains it (the
// convention every rich editor follows).
export const applyMark = (spans: Span[], start: number, end: number, mark: Mark) => {
  const covered = sliceSpans(spans, start, end);
  const everyMarked = covered.length > 0 && covered.every((span) => span.marks.includes(mark));
  const reworked = covered.map((span) => ({
    ...span,
    marks: everyMarked
      ? span.marks.filter((entry) => entry !== mark)
      : span.marks.includes(mark)
        ? span.marks
        : span.marks.concat(mark),
  }));
  return normalizeSpans(sliceSpans(spans, 0, start).concat(reworked, sliceSpans(spans, end)));
};

// The marks every character of [start, end) carries: exactly the set
// applyMark would lift rather than add, so a format button reading this
// as its pressed state always previews the toggle's direction.
export const marksOver = (spans: Span[], start: number, end: number) => {
  const covered = sliceSpans(spans, start, end);
  if (covered.length === 0) return [] as Mark[];
  return MARK_ORDER.filter((mark) => covered.every((span) => span.marks.includes(mark)));
};

// Typing a marker prefix at the start of a plain line converts it: "- "
// becomes a bullet, "[] " (or "[ ] ") a checkbox, "1. " (any number) a
// numbered item. Returns the claimed kind and the spans with the prefix
// stripped, or null when the text claims nothing.
export const claimMarker = (spans: Span[]) => {
  const text = textOf(spans);
  const strip = (n: number) => sliceSpans(spans, n);
  if (text.startsWith("- ")) return { kind: "bullet" as LineKind, rest: strip(2), stripped: 2 };
  if (text.startsWith("[] ")) return { kind: "checkbox" as LineKind, rest: strip(3), stripped: 3 };
  if (text.startsWith("[ ] ")) return { kind: "checkbox" as LineKind, rest: strip(4), stripped: 4 };
  const numbered = /^\d+\. /.exec(text);
  if (numbered) {
    return {
      kind: "numbered" as LineKind,
      rest: strip(numbered[0].length),
      stripped: numbered[0].length,
    };
  }
  return null;
};

// A numbered line's display number: one more than the run of numbered
// lines directly above it at the same indent. Deeper lines sit inside a
// parent item and never break the parent's run; a shallower or
// non-numbered line at the same depth does.
export const numberFor = (lines: Line[], at: number) => {
  let n = 1;
  for (let i = at - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.indent > lines[at].indent) continue;
    if (line.indent === lines[at].indent && line.kind === "numbered") {
      n++;
      continue;
    }
    break;
  }
  return n;
};

export const clampIndent = (indent: number) => Math.min(MAX_INDENT, Math.max(0, indent));

const KINDS = new Set(["text", "bullet", "checkbox", "numbered"]);
const MARKS = new Set(["bold", "italic", "underline", "strike"]);

const isSpan = (entry: unknown): entry is Span => {
  if (typeof entry !== "object" || entry === null) return false;
  const record = entry as Record<string, unknown>;
  return (
    typeof record.text === "string" &&
    Array.isArray(record.marks) &&
    record.marks.every((mark) => MARKS.has(mark as string))
  );
};

// Guards the localStorage boundary: stored JSON is only a Line when
// every field checks out, so a legacy or hand-mangled record can never
// crash rendering.
export const isLine = (entry: unknown): entry is Line => {
  if (typeof entry !== "object" || entry === null) return false;
  const record = entry as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    Array.isArray(record.spans) &&
    record.spans.every(isSpan) &&
    typeof record.indent === "number" &&
    KINDS.has(record.kind as string) &&
    typeof record.done === "boolean"
  );
};

// The pre-rich-text shape carried `text: string`. The load boundary
// rewrites such records into single-span lines once, and every accepted
// record leaves in canonical span form; runtime code only ever sees
// normalized spans.
export const migrateStoredLine = (entry: unknown): Line | null => {
  if (isLine(entry)) return { ...entry, spans: normalizeSpans(entry.spans) };
  if (typeof entry !== "object" || entry === null) return null;
  const record = entry as Record<string, unknown>;
  if (
    typeof record.id === "string" &&
    typeof record.text === "string" &&
    typeof record.indent === "number" &&
    KINDS.has(record.kind as string) &&
    typeof record.done === "boolean"
  ) {
    return {
      id: record.id,
      spans: record.text === "" ? [] : [{ text: record.text, marks: [] }],
      indent: record.indent,
      kind: record.kind as LineKind,
      done: record.done,
    };
  }
  return null;
};
