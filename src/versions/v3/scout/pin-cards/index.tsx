import * as React from "react";
import { Block, Button, Text } from "atoms";

// Persistent mini cards, one per shown pin: the name and today's hours,
// floating beside the pin itself. Cards dodge each other (greedy anchor
// pick: above, right, left, below, in that order, against everything
// already placed) but always sit against their own pin with a notch
// pointing at it, so a dense block never leaves a card orphaned from its
// place.
//
// Positioning is imperative on purpose. The map pans at frame rate and
// re-rendering React per frame would churn; instead React renders the card
// list only when the DATA changes, every card carries a transform updated
// straight on the DOM node during "move", and the collision pass re-runs
// only at rest ("moveend") or when the cards change.

export type PinCardFacts = {
  id: string;
  lng: number;
  lat: number;
  color: string;
  title: string;
  hoursLine: string | null;
  closedNow: boolean;
};

type Anchor = "above" | "right" | "left" | "below";

// Offset of the card's top-left from the pin's projected ground point.
type Placement = { dx: number; dy: number };

// The pin image is 26x34, anchored bottom, so the icon occupies
// [-13, -34] to [13, 0] around its projected point.
const PIN_HALF_WIDTH = 13;
const PIN_HEIGHT = 34;
const GAP = 7;

const overlap = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const placementFor = (
  anchor: Anchor,
  w: number,
  h: number,
): { dx: number; dy: number } => {
  switch (anchor) {
    case "above":
      return { dx: -w / 2, dy: -PIN_HEIGHT - GAP - h };
    case "right":
      return { dx: PIN_HALF_WIDTH + GAP, dy: -PIN_HEIGHT / 2 - h / 2 };
    case "left":
      return { dx: -PIN_HALF_WIDTH - GAP - w, dy: -PIN_HEIGHT / 2 - h / 2 };
    case "below":
      return { dx: -w / 2, dy: GAP };
  }
};

// The notch is a chevron SVG (two stroked slants over a fill) whose base
// line lies exactly on the card's border row: the fill blanks the border
// segment it straddles and the slants rise from the border's own line,
// so the outline reads as one continuous stroke flowing around the
// arrow. The svg box is 12x8 with the base drawn at y=1 and the tip at
// y=7; rotation swings it to whichever edge faces the pin.
const chevronFor = (anchor: Anchor, w: number, h: number) => {
  switch (anchor) {
    case "above":
      return { left: w / 2 - 6, top: h - 2, rotate: 0 };
    case "below":
      return { left: w / 2 - 6, top: -6, rotate: 180 };
    case "right":
      return { left: -8, top: h / 2 - 4, rotate: 90 };
    case "left":
      return { left: w - 4, top: h / 2 - 4, rotate: -90 };
  }
};

export function PinCards(props: {
  map: import("maplibre-gl").Map | null;
  cards: PinCardFacts[];
  onPress: (id: string) => void;
}) {
  const cardRefs = React.useRef(new Map<string, HTMLElement>());
  const placementsRef = React.useRef(new Map<string, Placement>());
  const cards = props.cards;
  const map = props.map;

  React.useEffect(() => {
    if (!map) return;

    const position = () => {
      for (const card of cards) {
        const node = cardRefs.current.get(card.id);
        const placement = placementsRef.current.get(card.id);
        if (!node || !placement) continue;
        const point = map.project([card.lng, card.lat]);
        node.style.transform = `translate(${Math.round(point.x + placement.dx)}px, ${Math.round(point.y + placement.dy)}px)`;
        // Born hidden (see the render below): a card is only shown once
        // it has a real position, never stacked at the origin while the
        // map is still constructing.
        node.style.visibility = "visible";
      }
    };

    // Greedy pass in list order: earlier cards (saved places first) claim
    // space, later ones route around them, every pin icon, and the edges
    // of the canvas (a card hanging past the clipped overlay would be
    // unreadable and unpressable).
    const place = () => {
      const canvas = map.getContainer();
      const bounds = { w: canvas.clientWidth, h: canvas.clientHeight };
      const taken: Array<{ x: number; y: number; w: number; h: number }> = cards.map(
        (card) => {
          const point = map.project([card.lng, card.lat]);
          return { x: point.x - PIN_HALF_WIDTH, y: point.y - PIN_HEIGHT, w: PIN_HALF_WIDTH * 2, h: PIN_HEIGHT };
        },
      );
      placementsRef.current = new Map();
      for (const card of cards) {
        const node = cardRefs.current.get(card.id);
        if (!node) continue;
        const w = node.offsetWidth;
        const h = node.offsetHeight;
        const point = map.project([card.lng, card.lat]);
        const anchors: Anchor[] = ["above", "right", "left", "below"];
        let chosen: Anchor = "above";
        for (const anchor of anchors) {
          const at = placementFor(anchor, w, h);
          const rect = { x: point.x + at.dx, y: point.y + at.dy, w, h };
          const onCanvas =
            rect.x >= 0 && rect.y >= 0 && rect.x + w <= bounds.w && rect.y + h <= bounds.h;
          if (onCanvas && !taken.some((other) => overlap(rect, other))) {
            chosen = anchor;
            break;
          }
        }
        const at = placementFor(chosen, w, h);
        taken.push({ x: point.x + at.dx, y: point.y + at.dy, w, h });
        placementsRef.current.set(card.id, { dx: at.dx, dy: at.dy });
        const notchNode = node.querySelector<HTMLElement>("[data-notch]");
        if (notchNode) {
          const notch = chevronFor(chosen, w, h);
          notchNode.style.left = `${notch.left}px`;
          notchNode.style.top = `${notch.top}px`;
          notchNode.style.transform = `rotate(${notch.rotate}deg)`;
        }
      }
      position();
    };

    // Per-frame during a pan, coalesced through rAF so a burst of move
    // events costs one layout write.
    let frame = 0;
    const onMove = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        position();
      });
    };
    place();
    map.on("move", onMove);
    map.on("moveend", place);
    map.on("zoomend", place);
    return () => {
      map.off("move", onMove);
      map.off("moveend", place);
      map.off("zoomend", place);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [map, cards]);

  return (
    <Block
      position="absolute"
      inset="0"
      overflow="hidden"
      zIndex={5}
      style={{ pointerEvents: "none" }}
      aria-hidden={cards.length === 0}
    >
      {cards.map((card) => (
        <Button
          key={card.id}
          type="button"
          ref={(node: HTMLElement | null) => {
            if (node) cardRefs.current.set(card.id, node);
            else cardRefs.current.delete(card.id);
          }}
          onPress={() => props.onPress(card.id)}
          position="absolute"
          top="0"
          left="0"
          bg="surface-panel"
          borderRadius="xs"
          borderWidth="1px"
          borderStyle="solid"
          borderColor="border-muted"
          boxShadow="0 2px 8px rgba(0, 0, 0, 0.16)"
          px="sm"
          py="0.2lh"
          maxW="14rem"
          style={{ pointerEvents: "auto", willChange: "transform", visibility: "hidden" }}
        >
          {/* The notch chevron: placed and rotated by the collision pass
              so its base line lies on the card's border row. */}
          <svg
            data-notch=""
            aria-hidden="true"
            width={12}
            height={8}
            style={{
              position: "absolute",
              zIndex: 2,
              pointerEvents: "none",
              overflow: "visible",
            }}
          >
            <path
              d="M0.5 1 L6 7 L11.5 1"
              fill="var(--colors-surface-panel)"
              stroke="var(--colors-border-muted)"
              strokeWidth={1}
            />
          </svg>
          <Block grid justifyItems="start" textAlign="start" minW={0}>
            <Block grid cols="auto 1fr" alignItems="center" gap="xs" minW={0}>
              <Block
                as="span"
                w="0.5rem"
                h="0.5rem"
                borderRadius="9999px"
                flexShrink={0}
                style={{ background: card.color }}
              />
              <Text
                fontSize="sm"
                fontWeight="600"
                color="text-primary"
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
              >
                {card.title}
              </Text>
            </Block>
            {card.hoursLine ? (
              <Text
                fontSize="xs"
                fontWeight="550"
                color={card.closedNow ? "danger" : "text-muted"}
                whiteSpace="nowrap"
              >
                {card.hoursLine}
              </Text>
            ) : null}
          </Block>
        </Button>
      ))}
    </Block>
  );
}
