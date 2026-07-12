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

const placeAt = (el: HTMLElement, target: number): [Node, number] => {
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

// Places the selection at text offsets, clamped to the content.
export const setSelection = (el: HTMLElement, start: number, end = start) => {
  const range = document.createRange();
  range.setStart(...placeAt(el, start));
  range.setEnd(...placeAt(el, Math.max(start, end)));
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
};

// Whether the caret sits on the line's first (or last) VISUAL row, which
// is when an arrow key hops to the neighboring line instead of moving
// within a wrapped one. A collapsed caret at an element boundary between
// mark wrappers can legitimately have no rect, so the fallback measures
// the character beside the caret; only a truly unmeasurable line (empty)
// counts as on-edge.
export const caretOnEdge = (el: HTMLElement, edge: "first" | "last") => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(edge === "first");
  let rect = range.getClientRects()[0];
  if (!rect) {
    const offsets = selectionOffsets(el);
    const length = el.textContent?.length ?? 0;
    if (!offsets || length === 0) return true;
    const at = edge === "first" ? offsets.start : offsets.end;
    const charRange = document.createRange();
    if (at < length) {
      charRange.setStart(...placeAt(el, at));
      charRange.setEnd(...placeAt(el, at + 1));
    } else {
      charRange.setStart(...placeAt(el, at - 1));
      charRange.setEnd(...placeAt(el, at));
    }
    rect = charRange.getClientRects()[0];
    if (!rect) return true;
  }
  const shell = el.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
  return edge === "first"
    ? rect.top - shell.top < lineHeight * 0.6
    : shell.bottom - rect.bottom < lineHeight * 0.6;
};
