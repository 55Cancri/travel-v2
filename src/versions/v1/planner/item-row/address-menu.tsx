import { Block, Button, Text } from "atoms";
import { Subtext } from "alloys";
import type { AddressHit } from "entities/geocode";

// The suggestion popover riding a row: an elevated panel of geocoder hits.
// The highlight lives in the row (keyboard arrows and pointer hover both
// move it); pointerdown is prevented so picking never steals focus from
// the row's textarea mid-press.
export function AddressMenu(props: {
  hits: AddressHit[];
  highlightIdx: number;
  drop: "down" | "up";
  onPick: (hit: AddressHit) => void;
  onHighlight: (idx: number) => void;
}) {
  return (
    <Block
      position="absolute"
      left="0"
      right="0"
      zIndex={10}
      bg="surface-panel"
      borderRadius="sm"
      boxShadow="0 4px 16px rgba(0, 0, 0, 0.18)"
      py="0.25rem"
      style={props.drop === "down" ? { top: "calc(100% + 2px)" } : { bottom: "calc(100% + 2px)" }}
    >
      {props.hits.map((hit, idx) => (
        <Button
          key={`${hit.label}|${hit.address ?? ""}`}
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          onPress={() => props.onPick(hit)}
          onPointerEnter={() => props.onHighlight(idx)}
          justifyContent="start"
          w="100%"
          px="sm"
          py="0.3rem"
          textAlign="left"
          borderRadius="xs"
          bg={idx === props.highlightIdx ? "surface-muted" : "transparent"}
        >
          {/* One child: the label/address stack (the Button's own grid slots
              a spinner column, which would add phantom tracks here). */}
          <Block as="span" grid>
            <Text as="span" fontSize="sm" fontWeight={550} color="text-primary">
              {hit.label}
            </Text>
            {hit.address ? <Subtext fontSize="sm">{hit.address}</Subtext> : null}
          </Block>
        </Button>
      ))}
    </Block>
  );
}
