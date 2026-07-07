import type * as React from "react";
import type { MotionProps } from "framer-motion";
import { Block, Button, DotsSixVertical, Pencil, Text } from "atoms";
import { Checkbox, IconButton, Subtext } from "alloys";
import { KIND_META, type Item } from "entities/trips/types";

// One plan row. The grip COLUMN is always reserved (stockpile's layout-stability
// trick) so checkboxes and text never shift as handles appear — the handle
// itself only renders when the row is draggable. Label-wrapped input, time
// chip, colored place dot (flies the map; ⌘-click a map pin does the reverse),
// and a pencil (hover on desktop, always on mobile) that opens the item editor
// — where cancel/restore, kind, time and details live. Lodging/transport items
// grow a details card.
export function ItemRow(props: {
  item: Item;
  draggable: boolean;
  highlighted: boolean;
  motion: MotionProps;
  inputRef: (el: HTMLTextAreaElement | null) => void;
  onChange: (text: string) => void;
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onToggle: () => void;
  onEdit: () => void;
  onBlur: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onGrip: (event: React.PointerEvent) => void;
  onFly: () => void;
}) {
  const { item } = props;
  const empty = item.text.trim() === "";
  const cancelled = item.status === "cancelled";
  const done = item.status === "done";
  const inputId = `ti-${item.id}`;
  const kind = KIND_META[item.kind];
  return (
    <Block
      data-item-row=""
      _motion={props.motion}
      borderRadius="xs"
      px="xs"
      mx="-0.25lh"
      bg={props.highlighted ? "accent-soft" : "transparent"}
      transition="background-color 400ms ease"
      css={{ "&:hover .row-actions": { opacity: 1 } }}
    >
      <Block
        as="label"
        htmlFor={inputId}
        grid
        cols="auto auto 1fr auto"
        gap="sm"
        alignItems="start"
      >
        {/* controls align to the FIRST line so wrapped rows read like a list */}
        {props.draggable ? (
          <Button
            type="button"
            aria-label="Drag to reorder"
            onPointerDown={props.onGrip}
            grid
            placeItems="center"
            w="1.5rem"
            h="1.5rem"
            p={0}
            mt="0.375rem"
            bg="transparent"
            color="text-muted"
            cursor="grab"
            style={{ touchAction: "none" }}
            _hover={{ color: "text-primary" }}
          >
            <DotsSixVertical size={18} />
          </Button>
        ) : (
          <Block w="1.5rem" h="1.5rem" aria-hidden="true" />
        )}
        {empty ? (
          <Block
            w="1.3rem"
            h="1.3rem"
            mt="0.475rem"
            borderRadius="xs"
            borderWidth="2px"
            borderStyle="solid"
            borderColor="border-muted"
            aria-hidden="true"
          />
        ) : (
          // grid (not a plain div) so the inline-level checkbox button doesn't
          // sit on a text baseline — that read as "checkbox lower than grip".
          <Block grid w="1.3rem" h="1.3rem" mt="0.475rem">
            <Checkbox
              checked={done}
              muted={cancelled}
              onToggle={props.onToggle}
              label={done ? "Mark not done" : "Mark done"}
            />
          </Block>
        )}
        {/* Auto-growing row text: long items WRAP onto extra lines (the row
            grows) instead of truncating. field-sizing:content sizes the
            textarea to its value; Enter never inserts a newline (the
            section's key handler spawns a row). */}
        <Block
          as="textarea"
          id={inputId}
          ref={props.inputRef}
          value={item.text}
          placeholder="Add a plan…"
          rows={1}
          onChange={(event) => props.onChange(event.currentTarget.value)}
          onPaste={props.onPaste}
          onBlur={props.onBlur}
          onKeyDown={props.onKeyDown}
          width="100%"
          border="0"
          outline="none"
          background="transparent"
          padding="0"
          paddingBlock="xs"
          margin="0"
          fontFamily="inherit"
          fontSize="md"
          fontWeight={500}
          lineHeight="1.5"
          resize="none"
          overflow="hidden"
          transition="color 200ms ease"
          _placeholder={{ color: "text-muted" }}
          color={done || cancelled ? "text-muted" : "text-primary"}
          textDecoration={done || cancelled ? "line-through" : "none"}
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <Block flex gap="xs" alignItems="center" mt="0.45rem">
          {item.time ? (
            <Text
              as="span"
              fontSize="sm"
              fontWeight={550}
              px="xs"
              py="0.05lh"
              bg="surface-muted"
              borderRadius="xs"
              color="text-muted"
              whiteSpace="nowrap"
            >
              {item.time}
            </Text>
          ) : null}
          {item.place ? (
            <IconButton
              aria-label={`Show ${item.place.name} on map`}
              title={item.place.name}
              onPress={props.onFly}
              size="1.4rem"
              borderRadius="9999px"
            >
              <Block
                as="span"
                w="0.6rem"
                h="0.6rem"
                borderRadius="9999px"
                style={{
                  background: `var(${kind.cssVar})`,
                  boxShadow: "var(--pin-dot-shadow)",
                }}
              />
            </IconButton>
          ) : null}
          <IconButton
            className="row-actions"
            aria-label="Edit item"
            title="Edit"
            onPress={props.onEdit}
            size="1.6rem"
            borderRadius="9999px"
            opacity={{ base: 1, md: 0 }}
          >
            <Pencil size={13} />
          </IconButton>
        </Block>
      </Block>

      {item.note && !empty ? (
        <Subtext
          as="p"
          fontSize="sm"
          mt="-0.15lh"
          pb="xs"
          pl="calc(1.5rem + 1.3rem + 1lh)"
          textDecoration={cancelled ? "line-through" : "none"}
        >
          {item.note}
        </Subtext>
      ) : null}

      {item.details ? (
        // Indented detail lines under the text (no card chrome): a fixed icon
        // column keeps every icon the same size and every line starting at the
        // same x — flush with the item text above.
        <Block
          pl="calc(1.5rem + 1.3rem + 1lh)"
          mb="xs"
          flow="0.15lh"
          opacity={cancelled ? 0.55 : 1}
        >
          {(
            [
              ["📍", item.details.address],
              ["🗓", item.details.dates],
              [
                "🕑",
                item.details.checkIn
                  ? `in: ${item.details.checkIn}${item.details.checkOut ? ` · out: ${item.details.checkOut}` : ""}`
                  : undefined,
              ],
              [
                "🎟",
                item.details.code
                  ? `${item.details.code}${item.details.phone ? ` · ${item.details.phone}` : ""}`
                  : undefined,
              ],
            ] as const
          ).map(([icon, value]) =>
            value ? (
              <Block key={icon} grid cols="auto 1fr" gap="sm" alignItems="baseline">
                <Text
                  as="span"
                  aria-hidden="true"
                  w="1.1rem"
                  textAlign="center"
                  style={{ fontSize: "0.8rem", lineHeight: "1.5" }}
                >
                  {icon}
                </Text>
                <Subtext fontSize="sm">{value}</Subtext>
              </Block>
            ) : null,
          )}
        </Block>
      ) : null}
    </Block>
  );
}
