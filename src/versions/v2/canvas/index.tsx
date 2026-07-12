import * as React from "react";
import { Block } from "atoms";
import { caretLine } from "./caret-line";
import { EditBar } from "./edit-bar";
import { LineRow } from "./line-row";
import { type Line, claimMarker, clampIndent, newLine, numberFor } from "./lines";

const CANVAS_KEY = "travel2:v2:canvas";

const loadLines = (): Line[] => {
  try {
    const raw = localStorage.getItem(CANVAS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Line[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (error) {
    console.warn("[canvas] stored canvas unreadable, starting fresh:", error);
  }
  return [newLine()];
};

// The editable canvas: flat lines that convert to bullets, checkboxes,
// and numbered items as you type their markers, indent with Tab or the
// edit bar, and persist per device. Renders client-only (the route's
// mount gate), so localStorage is safe here.
export function Canvas() {
  const [lines, setLines] = React.useState<Line[]>(loadLines);
  const [editing, setEditing] = React.useState(false);
  const inputs = React.useRef(new Map<string, HTMLTextAreaElement>());
  const pendingFocus = React.useRef<{ id: string; at: number } | null>(null);
  const activeId = React.useRef<string | null>(null);
  const shellRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    try {
      localStorage.setItem(CANVAS_KEY, JSON.stringify(lines));
    } catch {
      // Storage can be sealed (private mode throws on setItem). The
      // canvas keeps working for the session; only reload persistence
      // is lost.
    }
  }, [lines]);

  // Focus lands after the render that created or reshaped its line.
  React.useLayoutEffect(() => {
    const want = pendingFocus.current;
    if (!want) return;
    pendingFocus.current = null;
    const el = inputs.current.get(want.id);
    if (!el) return;
    el.focus();
    el.setSelectionRange(want.at, want.at);
  });

  const editText = (id: string, value: string, caret: number) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        if (line.kind === "text") {
          const claimed = claimMarker(value);
          if (claimed) {
            const stripped = value.length - claimed.rest.length;
            pendingFocus.current = { id, at: Math.max(0, caret - stripped) };
            return { ...line, kind: claimed.kind, text: claimed.rest };
          }
        }
        return { ...line, text: value };
      }),
    );
  };

  const splitAt = (id: string) => {
    const caret = inputs.current.get(id)?.selectionStart ?? 0;
    setLines((prev) => {
      const at = prev.findIndex((line) => line.id === id);
      if (at < 0) return prev;
      const line = prev[at];
      // Enter on an empty marker line demotes it to plain text instead
      // of spawning another empty item.
      if (line.kind !== "text" && line.text === "") {
        pendingFocus.current = { id, at: 0 };
        return prev.map((entry) =>
          entry.id === id ? { ...entry, kind: "text" as const, done: false } : entry,
        );
      }
      const spawned = newLine({
        text: line.text.slice(caret),
        indent: line.indent,
        kind: line.kind,
      });
      pendingFocus.current = { id: spawned.id, at: 0 };
      return prev
        .slice(0, at)
        .concat([{ ...line, text: line.text.slice(0, caret) }, spawned], prev.slice(at + 1));
    });
  };

  const backspaceAtStart = (id: string) => {
    setLines((prev) => {
      const at = prev.findIndex((line) => line.id === id);
      if (at < 0) return prev;
      const line = prev[at];
      // The undo ladder: marker first, then one indent step, then merge
      // into the line above.
      if (line.kind !== "text") {
        pendingFocus.current = { id, at: 0 };
        return prev.map((entry) =>
          entry.id === id ? { ...entry, kind: "text" as const, done: false } : entry,
        );
      }
      if (line.indent > 0) {
        pendingFocus.current = { id, at: 0 };
        return prev.map((entry) =>
          entry.id === id ? { ...entry, indent: entry.indent - 1 } : entry,
        );
      }
      if (at === 0) return prev;
      const above = prev[at - 1];
      pendingFocus.current = { id: above.id, at: above.text.length };
      return prev
        .slice(0, at - 1)
        .concat([{ ...above, text: above.text + line.text }], prev.slice(at + 1));
    });
  };

  const shiftIndent = (id: string | null, delta: number) => {
    if (!id) return;
    setLines((prev) =>
      prev.map((line) =>
        line.id === id ? { ...line, indent: clampIndent(line.indent + delta) } : line,
      ),
    );
  };

  const toggleDone = (id: string) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, done: !line.done } : line)),
    );
  };

  // Up/down hop lines editor-style, keeping the caret's character column.
  // Wrapped lines keep native caret movement inside themselves; only the
  // edge row leaves the line.
  const hop = (event: React.KeyboardEvent<HTMLTextAreaElement>, up: boolean) => {
    const el = event.currentTarget;
    const { line, lineCount } = caretLine(el);
    if (up ? line > 0 : line < lineCount - 1) return;
    const rows = Array.from(
      document.querySelectorAll<HTMLTextAreaElement>("textarea[data-canvas-line]"),
    );
    const neighbor = rows[rows.indexOf(el) + (up ? -1 : 1)];
    if (!neighbor) return;
    event.preventDefault();
    const column = el.selectionStart ?? 0;
    const at = Math.min(column, neighbor.value.length);
    neighbor.focus();
    neighbor.setSelectionRange(at, at);
  };

  // Mobile IMEs (Android GBoard especially) fire keydown with unusable
  // keys, so Enter and backspace-at-start also answer through NATIVE
  // beforeinput, delegated from the shell (React's onBeforeInput is a
  // synthetic that misses it). A handled keydown cancels its
  // beforeinput, so desktop never double-fires. The mutations inside
  // only touch refs and functional setState, so the mount-once
  // listener never sees stale state.
  React.useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const abort = new AbortController();
    shell.addEventListener(
      "beforeinput",
      (event) => {
        const el = event.target;
        if (!(el instanceof HTMLTextAreaElement) || el.dataset.canvasLine === undefined) return;
        let id: string | null = null;
        for (const [lineId, node] of inputs.current) {
          if (node === el) {
            id = lineId;
            break;
          }
        }
        if (!id) return;
        if (event.inputType === "insertLineBreak") {
          event.preventDefault();
          splitAt(id);
          return;
        }
        if (
          event.inputType === "deleteContentBackward" &&
          (el.selectionStart ?? 0) === 0 &&
          (el.selectionEnd ?? 0) === 0
        ) {
          event.preventDefault();
          backspaceAtStart(id);
        }
      },
      { signal: abort.signal },
    );
    return () => abort.abort();
  }, []);

  const lineKeyDown =
    (id: string) => (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        const el = event.currentTarget;
        if ((el.selectionStart ?? 0) === 0 && (el.selectionEnd ?? 0) === 0) {
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

  const trackFocus = (event: React.FocusEvent) => {
    const el = event.target as HTMLTextAreaElement;
    if (el.dataset?.canvasLine === undefined) return;
    for (const [id, node] of inputs.current) {
      if (node === el) {
        activeId.current = id;
        break;
      }
    }
    setEditing(true);
  };

  const releaseFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setEditing(false);
  };

  const focusTail = () => {
    const tail = lines.at(-1);
    if (!tail) return;
    const el = inputs.current.get(tail.id);
    el?.focus();
    el?.setSelectionRange(tail.text.length, tail.text.length);
  };

  return (
    <Block ref={shellRef} onFocus={trackFocus} onBlur={releaseFocus}>
      {lines.map((line, idx) => (
        <LineRow
          key={line.id}
          line={line}
          ordinal={numberFor(lines, idx)}
          onChange={(text, caret) => editText(line.id, text, caret)}
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
          onOutdent={() => shiftIndent(activeId.current, -1)}
          onIndent={() => shiftIndent(activeId.current, 1)}
        />
      ) : null}
    </Block>
  );
}
