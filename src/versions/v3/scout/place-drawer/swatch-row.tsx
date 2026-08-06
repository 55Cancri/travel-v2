import { Block, Button } from "atoms";
import { PIN_COLORS } from "entities/scout-maps";

// The pin color picker: one row of the shared palette, the active swatch
// wearing a ring in its own color.
export function SwatchRow(props: { color: string; onColor: (color: string) => void }) {
  return (
    <Block flex gap="sm" alignItems="center">
      {PIN_COLORS.map((color) => {
        const active = color === props.color;
        return (
          <Button
            key={color}
            type="button"
            aria-label={`Pin color ${color}`}
            aria-pressed={active}
            onPress={() => props.onColor(color)}
            grid
            placeItems="center"
            w="1.9rem"
            h="1.9rem"
            borderRadius="9999px"
            borderWidth="2px"
            borderStyle="solid"
            style={{ borderColor: active ? color : "transparent" }}
          >
            <Block
              as="span"
              w="1.15rem"
              h="1.15rem"
              borderRadius="9999px"
              style={{ background: color }}
            />
          </Button>
        );
      })}
    </Block>
  );
}
