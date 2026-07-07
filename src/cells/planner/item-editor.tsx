import * as React from "react";
import { Block, Button, Input } from "atoms";
import { Eyebrow, FieldLabel, PrimaryButton, Subtext } from "alloys";
import { haptics } from "entities/haptics";
import { removeItem, updateItem, useDb } from "entities/trips/store";
import { KIND_META, type ContainerRef, type ItemDetails, type ItemKind } from "entities/trips/types";

// The item editor — opened by a row's pencil. Bottom sheet on mobile, centered
// modal on desktop. Everything structured lives here: kind, time, cost, link,
// note, lodging/booking details, and cancel/restore/delete. Edits write to the
// store immediately (all local), so there's no save button — just Done.
export function ItemEditor(props: {
  itemId: string;
  containerRef: ContainerRef;
  onClose: () => void;
}) {
  const db = useDb();
  const item = db.items[props.itemId];
  // Field labels within this editor are unique strings, so id = base + label
  // wires every FieldLabel to its input for screen readers.
  const fieldIdBase = React.useId();

  const closeOnEscape = React.useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") props.onClose();
  });
  React.useEffect(() => {
    const controller = new AbortController();
    window.addEventListener("keydown", closeOnEscape, {
      signal: controller.signal,
    });
    return () => controller.abort();
  }, []);

  if (!item) return null;
  const cancelled = item.status === "cancelled";
  const details = item.details ?? {};
  const setDetail = (key: keyof ItemDetails, value: string) =>
    updateItem(item.id, { details: { ...details, [key]: value || undefined } });

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder = "") => (
    <Block flow="0.1lh">
      <FieldLabel htmlFor={`${fieldIdBase}-${label}`}>{label}</FieldLabel>
      <Input
        id={`${fieldIdBase}-${label}`}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        px="sm"
        py="xs"
        fontSize="md"
        borderColor="border-muted"
        bg="surface-page"
      />
    </Block>
  );

  return (
    <>
      {/* backdrop */}
      <Block
        position="fixed"
        inset="0"
        zIndex={80}
        style={{ background: "rgba(20, 16, 14, 0.45)" }}
        onClick={props.onClose}
      />
      {/* panel: bottom sheet on mobile, centered modal on md+. Grid rows pin
          the header (title input) and footer (actions); only the body scrolls. */}
      <Block
        position="fixed"
        zIndex={81}
        bg="surface-panel"
        boxShadow="0 -8px 40px rgba(0,0,0,0.25)"
        grid
        gridTemplateRows="auto minmax(0, 1fr) auto"
        rowGap="sm"
        p="md"
        pb={{ base: "calc(1lh + env(safe-area-inset-bottom))", md: "md" }}
        css={{
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "85svh",
          borderTopLeftRadius: "0.75rem",
          borderTopRightRadius: "0.75rem",
          md: {
            left: "50%",
            right: "auto",
            bottom: "auto",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "30rem",
            maxWidth: "calc(100vw - 2rem)",
            maxHeight: "85vh",
            borderRadius: "0.75rem",
            boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
          },
        }}
      >
        {/* header — the title, unmistakably an input */}
        <Input
          value={item.text}
          aria-label="Item text"
          placeholder="What is it?"
          onChange={(event) => updateItem(item.id, { text: event.currentTarget.value })}
          borderColor="border-muted"
          bg="surface-page"
          px="sm"
          py="xs"
          fontSize="lg"
          fontWeight={650}
          textDecoration={cancelled ? "line-through" : "none"}
        />

        {/* scrollable body — padded then pulled back so focus rings at the
            edges aren't clipped by the scroll container */}
        <Block overflowY="auto" flow="md" px="0.3rem" mx="-0.3rem" py="0.3rem" my="-0.3rem">
        {/* kind picker */}
        <Block flex gap="xs" flexWrap="wrap">
          {(Object.keys(KIND_META) as ItemKind[]).map((kind) => {
            const meta = KIND_META[kind];
            const selected = item.kind === kind;
            return (
              <Button
                key={kind}
                type="button"
                onPress={() => {
                  haptics.tap();
                  updateItem(item.id, { kind });
                }}
                px="sm"
                py="0.15lh"
                borderRadius="9999px"
                fontSize="sm"
                fontWeight={550}
                borderWidth="1px"
                borderStyle="solid"
                borderColor={selected ? "border-strong" : "border-muted"}
                bg={selected ? "surface-muted" : "transparent"}
                color={selected ? "text-primary" : "text-muted"}
                start={
                  <Block
                    as="span"
                    w="0.55rem"
                    h="0.55rem"
                    borderRadius="9999px"
                    style={{ background: `var(${meta.cssVar})` }}
                  />
                }
              >
                {meta.label}
              </Button>
            );
          })}
        </Block>

        <Block grid gridTemplateColumns="1fr 1fr" gap="sm">
          {field("Time", item.time ?? "", (v) => updateItem(item.id, { time: v || undefined }), "e.g. 1–5p")}
          {field("Cost", item.cost ?? "", (v) => updateItem(item.id, { cost: v || undefined }), "e.g. €25")}
        </Block>
        {field("Link", item.url ?? "", (v) => updateItem(item.id, { url: v || undefined }), "https://…")}
        {field("Note", item.note ?? "", (v) => updateItem(item.id, { note: v || undefined }), "small print under the item")}

        {item.place ? (
          <Subtext as="p" fontSize="sm">
            📍 {item.place.name}
            {item.place.address ? ` · ${item.place.address}` : ""}
          </Subtext>
        ) : null}

        <Block flow="sm">
          <Eyebrow as="p">Details</Eyebrow>
          {field("Address", details.address ?? "", (v) => setDetail("address", v))}
          <Block grid gridTemplateColumns="1fr 1fr" gap="sm">
            {field("Dates", details.dates ?? "", (v) => setDetail("dates", v))}
            {field("Confirmation", details.code ?? "", (v) => setDetail("code", v))}
            {field("Check-in", details.checkIn ?? "", (v) => setDetail("checkIn", v))}
            {field("Check-out", details.checkOut ?? "", (v) => setDetail("checkOut", v))}
          </Block>
          {field("Phone", details.phone ?? "", (v) => setDetail("phone", v))}
        </Block>
        </Block>

        {/* footer — always visible */}
        <Block
          grid
          cols="auto auto 1fr auto"
          gap="sm"
          alignItems="center"
          pt="sm"
          borderTopWidth="1px"
          borderTopStyle="solid"
          borderTopColor="border-muted"
        >
          <Button
            type="button"
            onPress={() => {
              haptics.tap();
              updateItem(item.id, { status: cancelled ? "planned" : "cancelled" });
            }}
            px="sm"
            py="xs"
            borderRadius="sm"
            fontSize="sm"
            fontWeight={550}
            borderWidth="1px"
            borderStyle="solid"
            borderColor="border-strong"
            color={cancelled ? "text-primary" : "danger"}
          >
            {cancelled ? "↺ Restore" : "Cancel item"}
          </Button>
          <Button
            type="button"
            onPress={() => {
              removeItem(props.containerRef, item.id);
              props.onClose();
            }}
            px="sm"
            py="xs"
            fontSize="sm"
            color="danger"
            bg="transparent"
          >
            Delete
          </Button>
          <Block />
          <PrimaryButton onPress={props.onClose}>Done</PrimaryButton>
        </Block>
      </Block>
    </>
  );
}
