import type * as React from "react";
import type { MotionProps } from "framer-motion";
import {
  Block,
  Button,
  Calendar,
  Clock,
  DotsSixVertical,
  MapPin,
  Pencil,
  Ticket,
} from "atoms";
import { Center, Checkbox, IconButton, Subtext } from "alloys";
import { KIND_META, type Item } from "entities/trips/types";

// One plan row. The grip COLUMN is always reserved so checkboxes and text
// never shift as handles appear (the handle itself only renders when the row
// is draggable). Label-wrapped input, then the action pair: a pencil (hover
// on desktop, always on mobile) that opens the item editor, and the colored
// kind dot at the row edge (flies the map; ⌘-click a map pin does the
// reverse). Time and booking details render as indented icon lines under
// the text.
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
  const details = item.details;
  const checkInOut = details?.checkIn
    ? `in: ${details.checkIn}${details.checkOut ? ` · out: ${details.checkOut}` : ""}`
    : undefined;
  const booking = details?.code
    ? `${details.code}${details.phone ? ` · ${details.phone}` : ""}`
    : undefined;
  return (
    <Block
      data-item-row=""
      _motion={props.motion}
      borderRadius="xs"
      px="xs"
      mx="-0.25lh"
      bg={props.highlighted ? "surface-highlight" : "transparent"}
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
        {/* Actions: pencil reveals on hover ahead of the kind dot, which
            anchors the row edge. */}
        <Block flex gap="xs" alignItems="center" mt="0.45rem">
          <IconButton
            className="row-actions"
            aria-label="Edit item"
            title="Edit"
            onPress={props.onEdit}
            // The row's <label> wraps these actions; preventing the click
            // default keeps a press from also activating the label and
            // yanking focus into the textarea.
            onClick={(event) => event.preventDefault()}
            size="1.6rem"
            borderRadius="9999px"
            opacity={{ base: 1, md: 0 }}
          >
            <Pencil size={13} />
          </IconButton>
          {item.place ? (
            <IconButton
              aria-label={`Show ${item.place.name} on map`}
              title={item.place.name}
              onPress={props.onFly}
              onClick={(event) => event.preventDefault()}
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

      {item.time || details ? (
        // Indented metadata lines under the text (no card chrome): the time,
        // then any booking details. A fixed icon column keeps every line-art
        // glyph the same size and every line starting at the same x, flush
        // with the item text above.
        <Block
          pl="calc(1.5rem + 1.3rem + 1lh)"
          mb="xs"
          flow="0.15lh"
          opacity={cancelled ? 0.55 : 1}
        >
          {(
            [
              ["time", <Clock size={12} />, item.time],
              ["address", <MapPin size={12} />, details?.address],
              ["dates", <Calendar size={12} />, details?.dates],
              ["in-out", <Clock size={12} />, checkInOut],
              ["booking", <Ticket size={12} />, booking],
            ] as const
          ).map(([lineKey, icon, value]) =>
            value ? (
              <Block key={lineKey} grid cols="auto 1fr" gap="sm" alignItems="start">
                {/* fontSize sm pins this box's 1lh to the value line's box,
                    so the glyph centers on the first line even when the
                    value wraps. The box hugs the glyph width: slack here is
                    invisible padding that pushes the text away, so the
                    icon-to-text distance stays the checkbox-to-text one
                    (the column gap). */}
                <Center
                  as="span"
                  aria-hidden="true"
                  fontSize="sm"
                  w="0.8rem"
                  h="1lh"
                  color="text-muted"
                >
                  {icon}
                </Center>
                <Subtext fontSize="sm">{value}</Subtext>
              </Block>
            ) : null,
          )}
        </Block>
      ) : null}
    </Block>
  );
}
