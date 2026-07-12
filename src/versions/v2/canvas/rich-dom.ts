import { type Mark, type Span, normalizeSpans } from "./lines";

// The seam between span state and each line's contenteditable DOM.
// Rendering builds real nodes (never markup strings), so user text can
// carry any character without becoming markup. Parsing flattens whatever
// the browser or a paste produced down to text plus the four known
// marks; unknown wrappers contribute only their text.

const MARK_TAGS: Record<Mark, string> = {
  bold: "B",
  italic: "I",
  underline: "U",
  strike: "S",
};

const TAG_MARKS: Record<string, Mark> = {
  B: "bold",
  STRONG: "bold",
  I: "italic",
  EM: "italic",
  U: "underline",
  S: "strike",
  STRIKE: "strike",
  DEL: "strike",
};

export const renderSpans = (el: HTMLElement, spans: Span[]) => {
  el.replaceChildren(
    ...spans.map((span) => {
      let node: Node = document.createTextNode(span.text);
      for (const mark of span.marks) {
        const wrap = document.createElement(MARK_TAGS[mark]);
        wrap.appendChild(node);
        node = wrap;
      }
      return node;
    }),
  );
};

export const parseSpans = (el: HTMLElement) => {
  const spans: Span[] = [];
  const walk = (node: Node, marks: Mark[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      spans.push({ text: node.textContent ?? "", marks });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const mark = TAG_MARKS[node.tagName];
    const inherited = mark && !marks.includes(mark) ? marks.concat(mark) : marks;
    for (const child of Array.from(node.childNodes)) walk(child, inherited);
  };
  for (const child of Array.from(el.childNodes)) walk(child, []);
  return normalizeSpans(spans);
};

export const sameSpans = (a: Span[], b: Span[]) => JSON.stringify(a) === JSON.stringify(b);

// The selection's [start, end] as text offsets inside the line, or null
// when the selection lives elsewhere.
export const selectionOffsets = (el: HTMLElement) => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return null;
  const measure = (node: Node, offset: number) => {
    const probe = document.createRange();
    probe.selectNodeContents(el);
    probe.setEnd(node, offset);
    return probe.toString().length;
  };
  return {
    start: measure(range.startContainer, range.startOffset),
    end: measure(range.endContainer, range.endOffset),
  };
};

// Places the selection at text offsets, clamped to the content.
export const setSelection = (el: HTMLElement, start: number, end = start) => {
  const place = (target: number): [Node, number] => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = target;
    let last: [Node, number] = [el, 0];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = node.textContent?.length ?? 0;
      if (remaining <= length) return [node, remaining];
      remaining -= length;
      last = [node, length];
    }
    return last;
  };
  const range = document.createRange();
  range.setStart(...place(start));
  range.setEnd(...place(Math.max(start, end)));
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
};

// Whether the caret sits on the line's first (or last) VISUAL row, which
// is when an arrow key hops to the neighboring line instead of moving
// within a wrapped one. Rect-less carets (empty lines, edge quirks)
// count as on-edge so the hop never strands.
export const caretOnEdge = (el: HTMLElement, edge: "first" | "last") => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(edge === "first");
  const rects = range.getClientRects();
  if (rects.length === 0) return true;
  const rect = rects[0];
  const shell = el.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
  return edge === "first"
    ? rect.top - shell.top < lineHeight * 0.6
    : shell.bottom - rect.bottom < lineHeight * 0.6;
};
