import * as React from "react";
import { Block, Button, Plus, Text } from "atoms";
import { Center, Numeric, Subtext } from "alloys";
import {
  containerItemIds,
  insertItemAfter,
  insertLines,
  moveItem,
  removeItem,
  setItemText,
  toggleItemDone,
  updateItem,
  useDb,
} from "entities/trips/store";
import type { ContainerRef, Item } from "entities/trips/types";
import { caretLine } from "./caret-line";
import { ItemRow } from "./item-row";
import { useDragReorder } from "./use-drag-reorder";

// One section = one container (a day's schedule or a segment's idea pool).
// Day headers are sticky (iOS-contacts style: each day's header holds the top
// of the viewport while its items scroll, then the next day pushes it out.
// Stickiness is naturally bounded by the <section>). Keyboard engine: Enter
// inserts below + autofocuses, Backspace on empty deletes + focuses previous,
// blur trims/removes empties. Multiline paste fans out into one row per line.
export function Section(props: {
  containerRef: ContainerRef;
  title: string;
  subtitle?: string;
  selected: boolean;
  stickyHeader?: boolean;
  // Offset from the scrollport top while stuck (the city bar's height, so day
  // headers stack directly beneath the always-stuck city name).
  stickyTop?: string;
  highlightItemIds: string[];
  // Address suggestions rank near here (the segment's city).
  placeBias: { lng: number; lat: number } | null;
  onSelect: () => void;
  onFly: (item: Item) => void;
  onEdit: (item: Item, containerRef: ContainerRef) => void;
}) {
  const db = useDb();
  const itemIds = containerItemIds(db, props.containerRef);
  const items = itemIds
    .map((id) => db.items[id])
    .filter((entry): entry is Item => entry !== undefined);
  const inputs = React.useRef(new Map<string, HTMLTextAreaElement>());
  const pendingFocus = React.useRef<string | null>(null);

  React.useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    const el = inputs.current.get(id);
    if (el) {
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  }, [itemIds.join("|")]);

  const addAfter = (idx: number) => {
    const created = insertItemAfter(props.containerRef, idx);
    pendingFocus.current = created.id;
  };

  const rowKeyDown =
    (item: Item, idx: number) =>
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addAfter(idx);
        return;
      }
      if (event.key === "Backspace" && item.text === "") {
        event.preventDefault();
        const prevId = idx > 0 ? items[idx - 1]?.id : null;
        if (prevId) pendingFocus.current = prevId;
        removeItem(props.containerRef, item.id);
        return;
      }
      // Up/down hop rows editor-style, keeping the caret's character column
      // (clamped to the target's length). Wrapped rows keep native caret
      // movement between their own lines; only the edge line leaves the row.
      // The DOM query spans every section, so the hop crosses day and pool
      // boundaries in visual order.
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
        const el = event.currentTarget;
        const up = event.key === "ArrowUp";
        const { line, lineCount } = caretLine(el);
        if (up ? line > 0 : line < lineCount - 1) return;
        const rows = Array.from(
          document.querySelectorAll<HTMLTextAreaElement>("textarea[data-plan-input]"),
        );
        const neighbor = rows[rows.indexOf(el) + (up ? -1 : 1)];
        if (!neighbor) return;
        event.preventDefault();
        const column = el.selectionStart ?? 0;
        const at = Math.min(column, neighbor.value.length);
        neighbor.focus();
        neighbor.setSelectionRange(at, at);
      }
    };

  // Multiline paste → one item per line. A row that already has text keeps it
  // and the lines land below; an empty row absorbs the first line.
  const rowPaste =
    (item: Item, idx: number) =>
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const text = event.clipboardData.getData("text");
      if (!text.includes("\n")) return;
      event.preventDefault();
      const lines = text
        .split("\n")
        .map((line) => line.replace(/^[-•*\s]+/, "").trim())
        .filter(Boolean);
      if (!lines.length) return;
      let rest = lines;
      if (item.text.trim() === "") {
        setItemText(item.id, lines[0]);
        rest = lines.slice(1);
      }
      if (rest.length) {
        const created = insertLines(props.containerRef, idx, rest);
        pendingFocus.current = created.at(-1)?.id ?? null;
      }
    };

  const rowBlur = (item: Item) => () => {
    if (item.text.trim() === "") {
      removeItem(props.containerRef, item.id);
    } else if (item.text !== item.text.trim()) {
      setItemText(item.id, item.text.trim());
    }
  };

  const reorder = useDragReorder({
    ids: itemIds,
    onCommit: (fromIndex, toIndex) => moveItem(props.containerRef, fromIndex, toIndex),
  });

  const textRowCount = items.filter((entry) => entry.text.trim() !== "").length;
  const active = items.filter((entry) => entry.status !== "cancelled" && entry.text.trim() !== "");
  const done = active.filter((entry) => entry.status === "done").length;

  return (
    <Block as="section" flow="0">
      <Button
        type="button"
        onPress={props.onSelect}
        grid
        cols="auto 1fr auto"
        gap="sm"
        alignItems="baseline"
        w="100%"
        px="0"
        py="xs"
        bg={props.stickyHeader ? "surface-page" : "transparent"}
        textAlign="left"
        color="text-primary"
        position={props.stickyHeader ? "sticky" : "static"}
        zIndex={props.stickyHeader ? 3 : "auto"}
        style={{ top: props.stickyHeader ? (props.stickyTop ?? "0px") : undefined }}
      >
        {/* selected = highlighter swipe across the title, unmissable at a
            glance (an underline was too quiet). Negative margins cancel the
            padding so the text never shifts when selection moves. */}
        <Text
          as="span"
          fontSize="lg"
          fontWeight={650}
          letterSpacing="-0.01em"
          color="inherit"
          bg={props.selected ? "surface-selected" : "transparent"}
          px="0.3em"
          mx="-0.3em"
          borderRadius="2px"
          transition="background-color 160ms ease"
        >
          {props.title}
        </Text>
        <Subtext fontSize="sm">{props.subtitle ?? ""}</Subtext>
        {active.length ? (
          <Numeric fontSize="sm" fontWeight={550} color="text-muted">
            {done}/{active.length}
          </Numeric>
        ) : (
          <Subtext fontSize="sm">empty</Subtext>
        )}
      </Button>

      <Block grid>
        {items.map((entry, idx) => (
          <ItemRow
            key={entry.id}
            item={entry}
            draggable={entry.text.trim() !== "" && textRowCount >= 2}
            highlighted={props.highlightItemIds.includes(entry.id)}
            motion={reorder.motionFor(entry.id)}
            inputRef={(el) => {
              if (el) inputs.current.set(entry.id, el);
              else inputs.current.delete(entry.id);
            }}
            bias={props.placeBias}
            onPick={(hit) => {
              updateItem(entry.id, {
                text: hit.label,
                place: { name: hit.label, address: hit.address, lat: hit.lat, lng: hit.lng },
              });
            }}
            onChange={(text) => setItemText(entry.id, text)}
            onPaste={rowPaste(entry, idx)}
            onToggle={() => {
              toggleItemDone(entry.id);
            }}
            onEdit={() => props.onEdit(entry, props.containerRef)}
            onBlur={rowBlur(entry)}
            onKeyDown={rowKeyDown(entry, idx)}
            onGrip={(event) => {
              event.preventDefault();
              reorder.startDrag(
                { point: event.clientY, target: event.currentTarget as HTMLElement },
                idx,
                entry.id,
              );
            }}
            onFly={() => props.onFly(entry)}
          />
        ))}
      </Block>

      {/* Ghost add row: same grid as a real row (grip spacer + square + text)
          so the plus sits exactly in the checkbox column, stroke-matched. */}
      <Button
        type="button"
        onPress={() => addAfter(items.length - 1)}
        grid
        cols="auto auto 1fr"
        gap="sm"
        alignItems="center"
        w="100%"
        px="0"
        py="xs"
        bg="transparent"
        color="text-muted"
        textAlign="left"
        _hover={{ color: "text-primary" }}
      >
        <Block as="span" w="1.5rem" h="1.5rem" aria-hidden="true" />
        <Center as="span" w="1.3rem" h="1.3rem">
          <Plus size={17} />
        </Center>
        {/* Button centers its grid items; this label hugs the plus instead. */}
        <Text as="span" fontSize="md" fontWeight={500} color="inherit" justifySelf="start">
          Add
        </Text>
      </Button>
    </Block>
  );
}
