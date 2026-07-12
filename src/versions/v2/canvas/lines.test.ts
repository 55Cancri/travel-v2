import { describe, expect, test } from "bun:test";
import {
  type Line,
  type Span,
  applyMark,
  claimMarker,
  concatSpans,
  migrateStoredLine,
  normalizeSpans,
  numberFor,
  sliceSpans,
  textOf,
} from "./lines";

const span = (text: string, marks: Span["marks"] = []) => ({ text, marks });

describe("normalizeSpans", () => {
  test("merges adjacent runs with the same marks and drops empty runs", () => {
    expect(normalizeSpans([span("a"), span(""), span("b")])).toEqual([span("ab")]);
  });

  test("mark order and duplicates collapse to one canonical spelling", () => {
    expect(
      normalizeSpans([span("a", ["italic", "bold"]), span("b", ["bold", "bold", "italic"])]),
    ).toEqual([span("ab", ["bold", "italic"])]);
  });

  test("distinct mark sets never merge", () => {
    expect(normalizeSpans([span("a", ["bold"]), span("b", ["bold", "italic"])])).toEqual([
      span("a", ["bold"]),
      span("b", ["bold", "italic"]),
    ]);
  });
});

describe("sliceSpans / concatSpans", () => {
  const runs = [span("one ", ["bold"]), span("two ", []), span("three", ["italic"])];

  test("slices across run boundaries keeping marks", () => {
    expect(sliceSpans(runs, 2, 9)).toEqual([span("e ", ["bold"]), span("two ", []), span("t", ["italic"])]);
  });

  test("full-range slice is identity", () => {
    expect(sliceSpans(runs, 0)).toEqual(runs);
  });

  test("concat re-merges a split point", () => {
    expect(concatSpans(sliceSpans(runs, 0, 6), sliceSpans(runs, 6))).toEqual(runs);
  });
});

describe("applyMark", () => {
  test("marks a plain range and splits its neighbors", () => {
    expect(applyMark([span("hello world")], 6, 11, "bold")).toEqual([
      span("hello "),
      span("world", ["bold"]),
    ]);
  });

  test("toggles off only when the whole range carries the mark", () => {
    const mixed = [span("he", ["bold"]), span("llo")];
    expect(applyMark(mixed, 0, 5, "bold")).toEqual([span("hello", ["bold"])]);
    expect(applyMark([span("hello", ["bold"])], 0, 5, "bold")).toEqual([span("hello")]);
  });

  test("stacks a second mark over part of an existing one", () => {
    expect(applyMark([span("hello", ["bold"])], 0, 2, "italic")).toEqual([
      span("he", ["bold", "italic"]),
      span("llo", ["bold"]),
    ]);
  });
});

describe("claimMarker", () => {
  test("claims bullet, checkbox, and numbered prefixes", () => {
    expect(claimMarker([span("- go")])).toMatchObject({ kind: "bullet", stripped: 2 });
    expect(claimMarker([span("[] go")])).toMatchObject({ kind: "checkbox", stripped: 3 });
    expect(claimMarker([span("[ ] go")])).toMatchObject({ kind: "checkbox", stripped: 4 });
    expect(claimMarker([span("12. go")])).toMatchObject({ kind: "numbered", stripped: 4 });
  });

  test("claims across marked runs, stripping through them", () => {
    const claimed = claimMarker([span("- ", ["bold"]), span("go")]);
    expect(claimed?.kind).toBe("bullet");
    expect(textOf(claimed?.rest ?? [])).toBe("go");
  });

  test("ignores prefixes past the start", () => {
    expect(claimMarker([span("go - go")])).toBeNull();
  });
});

describe("migrateStoredLine", () => {
  test("lifts a text-era record to a single plain span", () => {
    const lifted = migrateStoredLine({
      id: "a",
      text: "old words",
      indent: 1,
      kind: "bullet",
      done: false,
    });
    expect(lifted?.spans).toEqual([span("old words")]);
  });

  test("canonicalizes a noncanonical rich record", () => {
    const lifted = migrateStoredLine({
      id: "a",
      spans: [span("", []), span("x", ["italic", "bold", "bold"])],
      indent: 0,
      kind: "text",
      done: false,
    });
    expect(lifted?.spans).toEqual([span("x", ["bold", "italic"])]);
  });

  test("rejects junk", () => {
    expect(migrateStoredLine(null)).toBeNull();
    expect(migrateStoredLine({ bogus: true })).toBeNull();
    expect(migrateStoredLine({ id: 1, text: "x", indent: 0, kind: "text", done: false })).toBeNull();
  });
});

describe("numberFor", () => {
  const line = (kind: Line["kind"], indent: number): Line => ({
    id: crypto.randomUUID(),
    spans: [],
    indent,
    kind,
    done: false,
  });

  test("counts a same-indent run, skipping deeper lines", () => {
    const lines = [line("numbered", 0), line("numbered", 1), line("numbered", 0), line("numbered", 0)];
    expect(lines.map((_, i) => numberFor(lines, i))).toEqual([1, 1, 2, 3]);
  });

  test("a plain line at the same depth resets the run", () => {
    const lines = [line("numbered", 0), line("text", 0), line("numbered", 0)];
    expect(numberFor(lines, 2)).toBe(1);
  });
});
