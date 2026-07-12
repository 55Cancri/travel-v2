// The canvas document: a flat list of lines, each carrying its own indent
// and marker kind. Pure logic only; the Canvas component owns state and
// the DOM.

export type LineKind = "text" | "bullet" | "checkbox" | "numbered";

export type Line = {
  id: string;
  text: string;
  indent: number;
  kind: LineKind;
  done: boolean;
};

export const MAX_INDENT = 5;

export const newLine = (seed?: Partial<Omit<Line, "id">>) => ({
  id: crypto.randomUUID(),
  text: "",
  indent: 0,
  kind: "text" as LineKind,
  done: false,
  ...seed,
});

// Typing a marker prefix at the start of a plain line converts it: "- "
// becomes a bullet, "[] " (or "[ ] ") a checkbox, "1. " (any number) a
// numbered item. Returns the claimed kind and the text with the prefix
// stripped, or null when the text claims nothing.
export const claimMarker = (text: string) => {
  if (text.startsWith("- ")) return { kind: "bullet" as LineKind, rest: text.slice(2) };
  if (text.startsWith("[] ")) return { kind: "checkbox" as LineKind, rest: text.slice(3) };
  if (text.startsWith("[ ] ")) return { kind: "checkbox" as LineKind, rest: text.slice(4) };
  const numbered = /^\d+\. /.exec(text);
  if (numbered) return { kind: "numbered" as LineKind, rest: text.slice(numbered[0].length) };
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
