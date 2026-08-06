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

// Offset of the card's top-left from the pin's projected ground point,
// plus where the notch sits on the card's edge.
type Placement = {
  dx: number;
  dy: number;
  notchLeft: number;
  notchTop: number;
};

// The pin image is 26x34, anchored bottom, so the icon occupies
// [-13, -34] to [13, 0] around its projected point.
const PIN_HALF_WIDTH = 13;
const PIN_HEIGHT = 34;
const GAP = 7;
const NOTCH = 8;

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

// The notch is a rotated square peeking out of the edge that faces the
// pin, centered on the pin's position along that edge (clamped into the
// card so a corner anchor never pushes it off the end).
const notchFor = (anchor: Anchor, w: number, h: number) => {
  const half = NOTCH / 2;
  switch (anchor) {
    case "above":
      return { left: w / 2 - half, top: h - half };
    case "right":
      return { left: -half, top: h / 2 + (PIN_HEIGHT / 2 - half) - h / 2 };
    case "left":
      return { left: w - half, top: h / 2 + (PIN_HEIGHT / 2 - half) - h / 2 };
    case "below":
      return { left: w / 2 - half, top: -half };
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
      }
    };

    // Greedy pass in list order: earlier cards (saved places first) claim
    // space, later ones route around them and every pin icon.
    const place = () => {
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
          if (!taken.some((other) => overlap(rect, other))) {
            chosen = anchor;
            break;
          }
        }
        const at = placementFor(chosen, w, h);
        taken.push({ x: point.x + at.dx, y: point.y + at.dy, w, h });
        const notch = notchFor(chosen, w, h);
        placementsRef.current.set(card.id, {
          dx: at.dx,
          dy: at.dy,
          notchLeft: notch.left,
          notchTop: notch.top,
        });
        const notchNode = node.querySelector<HTMLElement>("[data-notch]");
        if (notchNode) {
          notchNode.style.left = `${notch.left}px`;
          notchNode.style.top = `${notch.top}px`;
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
          borderRadius="sm"
          borderWidth="1px"
          borderStyle="solid"
          borderColor="border-muted"
          boxShadow="0 2px 8px rgba(0, 0, 0, 0.16)"
          px="sm"
          py="0.2lh"
          maxW="14rem"
          style={{ pointerEvents: "auto", willChange: "transform" }}
        >
          {/* The notch: a rotated square tucked under the card's edge,
              placed imperatively with the collision pass. */}
          <Block
            as="span"
            data-notch=""
            aria-hidden="true"
            position="absolute"
            w="8px"
            h="8px"
            bg="surface-panel"
            style={{ transform: "rotate(45deg)", zIndex: -1 }}
          />
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
