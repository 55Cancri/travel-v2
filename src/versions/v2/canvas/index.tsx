// The default Inter file is upright-only; without the italic face, <i>
// has nothing to match and renders unslanted.
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/inter/wght-italic.css";
import * as React from "react";
import { Block } from "atoms";
import { EditBar } from "./edit-bar";
import { LineRow } from "./line-row";
import {
  type Line,
  type LineKind,
  type Mark,
  applyMark,
  claimMarker,
  clampIndent,
  concatSpans,
  marksOver,
  migrateStoredLine,
  newLine,
  numberFor,
  plainSpans,
  sliceSpans,
  textOf,
} from "./lines";
import { caretOnEdge, parseSpans, selectionOffsets, setSelection } from "./rich-dom";

const CANVAS_KEY = "travel2:v2:canvas";

const loadLines = (): Line[] => {
  try {
    const raw = localStorage.getItem(CANVAS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const seen = new Set<string>();
        const sound = parsed
          .map(migrateStoredLine)
          .filter((line): line is Line => {
            if (line === null || seen.has(line.id)) return false;
            seen.add(line.id);
            return true;
          })
          .map((line) => ({ ...line, indent: clampIndent(line.indent) }));
        if (sound.length < parsed.length) {
          console.warn(
            `[canvas] dropped ${parsed.length - sound.length} malformed stored line(s)`,
          );
        }
        if (sound.length > 0) return sound;
      }
    }
  } catch (error) {
    console.warn("[canvas] stored canvas unreadable, starting fresh:", error);
  }
  return [newLine()];
};

// The editable canvas: flat lines of styled spans that convert to
// bullets, checkboxes, and numbered items as you type their markers,
// take inline bold/italic/underline/strike over selections, indent with
// Tab or the edit bar, and persist per device. Renders client-only (the
// route's mount gate), so localStorage is safe here.
//
// Mutations compute the next document AT EVENT TIME from linesRef and
// hand setState a plain value: React may replay updater functions, so
// nothing that mints ids or writes refs may live inside one.
export function Canvas() {
  const [lines, setLines] = React.useState<Line[]>(loadLines);
  const [editing, setEditing] = React.useState(false);
  const [selectedMarks, setSelectedMarks] = React.useState<Mark[] | null>(null);
  const linesRef = React.useRef(lines);
  const inputs = React.useRef(new Map<string, HTMLElement>());
  const pendingFocus = React.useRef<{ id: string; start: number; end: number } | null>(null);
  const activeId = React.useRef<string | null>(null);
  const composing = React.useRef(false);
  const shellRef = React.useRef<HTMLDivElement | null>(null);

  const commit = (next: Line[]) => {
    linesRef.current = next;
    setLines(next);
  };

  React.useEffect(() => {
    try {
      localStorage.setItem(CANVAS_KEY, JSON.stringify(lines));
    } catch {
      // Storage can be sealed (private mode throws on setItem). The
      // canvas keeps working for the session; only reload persistence
      // is lost.
    }
  }, [lines]);

  // Focus lands after the render that created or reshaped its line, and
  // after every LineRow's own DOM sync (child layout effects run first).
  React.useLayoutEffect(() => {
    const want = pendingFocus.current;
    if (!want) return;
    pendingFocus.current = null;
    const el = inputs.current.get(want.id);
    if (!el) return;
    el.focus();
    setSelection(el, want.start, want.end);
    // A same-element focus fires no focus event and the programmatic
    // selection lands after it anyway, so the bar reads the fresh
    // selection here or not at all.
    syncTextSelected();
  });

  const lineAt = (id: string) => linesRef.current.findIndex((line) => line.id === id);

  // Plain typing: the line's DOM leads, state follows. Marker prefixes
  // claim their kind here; nothing else moves the caret.
  const editInput = (id: string) => {
    if (composing.current) return;
    const el = inputs.current.get(id);
    const at = lineAt(id);
    if (!el || at < 0) return;
    const line = linesRef.current[at];
    const spans = parseSpans(el);
    if (line.kind === "text") {
      const claimed = claimMarker(spans);
      if (claimed) {
        const caret = selectionOffsets(el)?.start ?? textOf(spans).length;
        const to = Math.max(0, caret - claimed.stripped);
        pendingFocus.current = { id, start: to, end: to };
        commit(
          linesRef.current.map((entry) =>
            entry.id === id ? { ...entry, kind: claimed.kind, spans: claimed.rest } : entry,
          ),
        );
        return;
      }
    }
    commit(linesRef.current.map((entry) => (entry.id === id ? { ...entry, spans } : entry)));
  };

  const splitAt = (id: string) => {
    const at = lineAt(id);
    if (at < 0) return;
    const prev = linesRef.current;
    const line = prev[at];
    // Enter on an empty marker line demotes it to plain text instead
    // of spawning another empty item.
    if (line.kind !== "text" && line.spans.length === 0) {
      pendingFocus.current = { id, start: 0, end: 0 };
      commit(
        prev.map((entry) =>
          entry.id === id ? { ...entry, kind: "text" as const, done: false } : entry,
        ),
      );
      return;
    }
    // Enter over a selection replaces it: the head keeps what precedes
    // the selection, the spawned line gets what follows it.
    const el = inputs.current.get(id);
    const offsets = (el && selectionOffsets(el)) ?? null;
    const length = textOf(line.spans).length;
    const start = offsets?.start ?? length;
    const end = offsets?.end ?? start;
    const spawned = newLine({
      spans: sliceSpans(line.spans, end),
      indent: line.indent,
      kind: line.kind,
    });
    pendingFocus.current = { id: spawned.id, start: 0, end: 0 };
    commit(
      prev
        .slice(0, at)
        .concat([{ ...line, spans: sliceSpans(line.spans, 0, start) }, spawned], prev.slice(at + 1)),
    );
  };

  const backspaceAtStart = (id: string) => {
    const at = lineAt(id);
    if (at < 0) return;
    const prev = linesRef.current;
    const line = prev[at];
    // The undo ladder: marker first, then one indent step, then merge
    // into the line above.
    if (line.kind !== "text") {
      pendingFocus.current = { id, start: 0, end: 0 };
      commit(
        prev.map((entry) =>
          entry.id === id ? { ...entry, kind: "text" as const, done: false } : entry,
        ),
      );
      return;
    }
    if (line.indent > 0) {
      pendingFocus.current = { id, start: 0, end: 0 };
      commit(
        prev.map((entry) => (entry.id === id ? { ...entry, indent: entry.indent - 1 } : entry)),
      );
      return;
    }
    if (at === 0) return;
    const above = prev[at - 1];
    const seam = textOf(above.spans).length;
    pendingFocus.current = { id: above.id, start: seam, end: seam };
    commit(
      prev
        .slice(0, at - 1)
        .concat([{ ...above, spans: concatSpans(above.spans, line.spans) }], prev.slice(at + 1)),
    );
  };

  const shiftIndent = (id: string | null, delta: number) => {
    if (!id) return;
    commit(
      linesRef.current.map((line) =>
        line.id === id ? { ...line, indent: clampIndent(line.indent + delta) } : line,
      ),
    );
  };

  const toggleDone = (id: string) => {
    commit(
      linesRef.current.map((line) => (line.id === id ? { ...line, done: !line.done } : line)),
    );
  };

  // Paste never lets the browser insert live DOM (that path skips the
  // span model entirely and is the door markup would walk through): the
  // clipboard's PLAIN TEXT enters the model, with newlines spawning
  // lines that inherit the target's kind and indent.
  const pasteText = (id: string, raw: string) => {
    const at = lineAt(id);
    if (at < 0) return;
    const prev = linesRef.current;
    const line = prev[at];
    const el = inputs.current.get(id);
    const offsets = (el && selectionOffsets(el)) ?? null;
    const length = textOf(line.spans).length;
    const start = offsets?.start ?? length;
    const end = offsets?.end ?? start;
    const segments = raw.replace(/\r\n?/g, "\n").split("\n");
    const head = sliceSpans(line.spans, 0, start);
    const tail = sliceSpans(line.spans, end);
    if (segments.length === 1) {
      const seam = start + segments[0].length;
      pendingFocus.current = { id, start: seam, end: seam };
      commit(
        prev.map((entry) =>
          entry.id === id
            ? { ...entry, spans: concatSpans(concatSpans(head, plainSpans(segments[0])), tail) }
            : entry,
        ),
      );
      return;
    }
    const opened = { ...line, spans: concatSpans(head, plainSpans(segments[0])) };
    const middle = segments
      .slice(1, -1)
      .map((segment) => newLine({ spans: plainSpans(segment), indent: line.indent, kind: line.kind }));
    const last = segments.at(-1) ?? "";
    const closing = newLine({
      spans: concatSpans(plainSpans(last), tail),
      indent: line.indent,
      kind: line.kind,
    });
    pendingFocus.current = { id: closing.id, start: last.length, end: last.length };
    commit(prev.slice(0, at).concat([opened], middle, [closing], prev.slice(at + 1)));
  };

  // The bar's marker buttons: press converts the focused line, pressing
  // its current kind again strips it back to plain text.
  const markLine = (id: string | null, kind: Exclude<LineKind, "text">) => {
    if (!id) return;
    commit(
      linesRef.current.map((line) => {
        if (line.id !== id) return line;
        if (line.kind === kind) return { ...line, kind: "text" as const, done: false };
        return { ...line, kind, done: false };
      }),
    );
  };

  // Inline formatting over the current selection; a collapsed caret has
  // nothing to format. The selection survives the re-render by offset.
  const formatSelection = (id: string | null, mark: Mark) => {
    if (!id) return;
    const el = inputs.current.get(id);
    const at = lineAt(id);
    if (!el || at < 0) return;
    const offsets = selectionOffsets(el);
    if (!offsets || offsets.start === offsets.end) return;
    pendingFocus.current = { id, start: offsets.start, end: offsets.end };
    commit(
      linesRef.current.map((entry) =>
        entry.id === id
          ? { ...entry, spans: applyMark(entry.spans, offsets.start, offsets.end, mark) }
          : entry,
      ),
    );
  };

  // Mobile IMEs (Android GBoard especially) fire keydown with unusable
  // keys, so Enter and backspace-at-start also answer through NATIVE
  // beforeinput, delegated from the shell (React's onBeforeInput is a
  // synthetic that misses it). A handled keydown cancels its
  // beforeinput, so desktop never double-fires. Composition events keep
  // parsing paused until the IME commits its text.
  React.useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const abort = new AbortController();
    const lineOf = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return null;
      const host = target.closest<HTMLElement>("[data-canvas-line]");
      if (!host) return null;
      for (const [lineId, node] of inputs.current) {
        if (node === host) return { id: lineId, el: host };
      }
      return null;
    };
    shell.addEventListener(
      "beforeinput",
      (event) => {
        const hit = lineOf(event.target);
        if (!hit) return;
        if (event.inputType === "insertParagraph" || event.inputType === "insertLineBreak") {
          event.preventDefault();
          splitAt(hit.id);
          return;
        }
        if (event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop") {
          // The paste listener already routed the text through the
          // model; anything reaching here would insert live DOM.
          event.preventDefault();
          return;
        }
        if (event.inputType === "deleteContentBackward") {
          const offsets = selectionOffsets(hit.el);
          if (offsets && offsets.start === 0 && offsets.end === 0) {
            event.preventDefault();
            backspaceAtStart(hit.id);
          }
        }
      },
      { signal: abort.signal },
    );
    shell.addEventListener(
      "paste",
      (event) => {
        const hit = lineOf(event.target);
        if (!hit) return;
        event.preventDefault();
        pasteText(hit.id, event.clipboardData?.getData("text/plain") ?? "");
      },
      { signal: abort.signal },
    );
    shell.addEventListener(
      "drop",
      (event) => {
        if (lineOf(event.target)) event.preventDefault();
      },
      { signal: abort.signal },
    );
    shell.addEventListener(
      "compositionstart",
      (event) => {
        composing.current = true;
        const hit = lineOf(event.target);
        if (hit) hit.el.dataset.composing = "";
      },
      { signal: abort.signal },
    );
    shell.addEventListener(
      "compositionend",
      (event) => {
        composing.current = false;
        const hit = lineOf(event.target);
        if (hit) {
          delete hit.el.dataset.composing;
          editInput(hit.id);
        }
      },
      { signal: abort.signal },
    );
    return () => abort.abort();
  }, []);

  // The bar swaps between line controls and format controls based on
  // whether real text is selected in the active line, and the format
  // buttons read the selection's common marks as their pressed state.
  // Recomputed on every selection event AND whenever the active line
  // changes, since a programmatic focus does not always fire
  // selectionchange. The mount-time document listener keeps the first
  // render's copy of this function, so it may read only refs and state
  // setters, never state or props.
  const syncTextSelected = () => {
    const id = activeId.current;
    const el = id ? inputs.current.get(id) : null;
    // The focus gate keeps a selectionchange straggling in after blur
    // from resurrecting the format bar.
    const offsets = el && document.activeElement === el ? selectionOffsets(el) : null;
    if (!el || !offsets || offsets.start === offsets.end) {
      setSelectedMarks(null);
      return;
    }
    const next = marksOver(parseSpans(el), offsets.start, offsets.end);
    setSelectedMarks((prev) => (prev && prev.join() === next.join() ? prev : next));
  };

  React.useEffect(() => {
    const abort = new AbortController();
    document.addEventListener("selectionchange", syncTextSelected, { signal: abort.signal });
    return () => abort.abort();
  }, []);

  // Up/down hop lines editor-style, keeping the caret's character column.
  // Wrapped lines keep native caret movement inside themselves; only the
  // edge row leaves the line.
  const hop = (event: React.KeyboardEvent<HTMLElement>, up: boolean) => {
    const el = event.currentTarget;
    if (!caretOnEdge(el, up ? "first" : "last")) return;
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-canvas-line]"));
    const neighbor = rows[rows.indexOf(el) + (up ? -1 : 1)];
    if (!neighbor) return;
    event.preventDefault();
    const offsets = selectionOffsets(el);
    // A range hops from the edge it is traveling toward.
    const column = (up ? offsets?.start : offsets?.end) ?? 0;
    const length = neighbor.textContent?.length ?? 0;
    neighbor.focus();
    setSelection(neighbor, Math.min(column, length));
  };

  const FORMAT_KEYS: Record<string, Mark> = { b: "bold", i: "italic", u: "underline" };

  const lineKeyDown = (id: string) => (event: React.KeyboardEvent<HTMLElement>) => {
    // An IME mid-composition owns Enter (it confirms the composed
    // text), and structural edits would tear the composition apart.
    // keyCode 229 covers engines that drop the isComposing flag on the
    // keydown that ends a composition.
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.metaKey || event.ctrlKey) {
      const key = event.key.toLowerCase();
      const mark = event.shiftKey && key === "x" ? "strike" : !event.shiftKey && FORMAT_KEYS[key];
      if (mark) {
        // The browser's own contenteditable formatting would bypass the
        // span model entirely.
        event.preventDefault();
        formatSelection(id, mark);
        return;
      }
    }
    if (event.key === "Enter") {
      event.preventDefault();
      splitAt(id);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      shiftIndent(id, event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === "Backspace") {
      const offsets = selectionOffsets(event.currentTarget);
      if (offsets && offsets.start === 0 && offsets.end === 0) {
        event.preventDefault();
        backspaceAtStart(id);
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
      hop(event, event.key === "ArrowUp");
    }
  };

  // The edit bar exists for a focused LINE. Focus landing on any other
  // control inside the shell means typing ended, so the bar goes away
  // rather than acting on a stale line.
  const trackFocus = (event: React.FocusEvent) => {
    const el = event.target;
    if (el instanceof HTMLElement && el.dataset.canvasLine !== undefined) {
      for (const [id, node] of inputs.current) {
        if (node === el) {
          activeId.current = id;
          break;
        }
      }
      syncTextSelected();
      setEditing(true);
      return;
    }
    setEditing(false);
  };

  const releaseFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setSelectedMarks(null);
    setEditing(false);
  };

  const focusTail = () => {
    const tail = linesRef.current.at(-1);
    if (!tail) return;
    const el = inputs.current.get(tail.id);
    if (!el) return;
    el.focus();
    setSelection(el, textOf(tail.spans).length);
  };

  return (
    <Block ref={shellRef} onFocus={trackFocus} onBlur={releaseFocus}>
      {lines.map((line, idx) => (
        <LineRow
          key={line.id}
          line={line}
          ordinal={numberFor(lines, idx)}
          onInput={() => editInput(line.id)}
          onKeyDown={lineKeyDown(line.id)}
          onToggle={() => toggleDone(line.id)}
          inputRef={(el) => {
            if (el) inputs.current.set(line.id, el);
            else inputs.current.delete(line.id);
          }}
        />
      ))}
      {/* The blank run-off below the last line: tapping it puts the caret
          at the end of the document, like any canvas. */}
      <Block h="8rem" onClick={focusTail} />
      {editing ? (
        <EditBar
          marks={selectedMarks}
          onMark={(kind) => markLine(activeId.current, kind)}
          onFormat={(mark) => formatSelection(activeId.current, mark)}
          onOutdent={() => shiftIndent(activeId.current, -1)}
          onIndent={() => shiftIndent(activeId.current, 1)}
        />
      ) : null}
    </Block>
  );
}
