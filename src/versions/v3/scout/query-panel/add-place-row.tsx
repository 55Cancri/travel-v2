import { css } from "panda/css";
import { Block, Button, Command, KeyReturn, Plus, Text } from "atoms";

// The compact affordance under the input (inside its sticky strip, above
// the results): press it, or Cmd+Enter from the input, to append a fresh
// query line. Its geometry mirrors the INPUT's interior, not the result
// rows: the plus centers under the input's color dot, the label sits
// flush with the input text, and the keycap hints end flush with the
// input's right edge.

// A raised key: thin sides, a thick bottom edge, and a whisper of drop,
// the way a keycap catches light.
const keycapCss = css({
  display: "grid",
  placeItems: "center",
  width: "1.4rem",
  height: "1.4rem",
  borderRadius: "xs",
  borderWidth: "1px",
  borderBottomWidth: "3px",
  borderStyle: "solid",
  borderColor: "border-muted",
  background: "surface-panel",
  boxShadow: "0 1px 1px rgba(0, 0, 0, 0.18)",
});

export function AddPlaceRow(props: { onAdd: () => void }) {
  return (
    <Button
      type="button"
      onPress={props.onAdd}
      w="100%"
      minW={0}
      grid
      cols="auto 1fr auto"
      gridAutoColumns="unset"
      gap="xs"
      alignItems="center"
      justifyContent="start"
      // The button atom centers its slot items; this row's label must
      // hug its cell's left edge to sit flush with the input text.
      justifyItems="start"
      // The plus slot's center lands on the input dot's center: the
      // input's border + pad + half a dot, minus half this slot. The
      // keycaps end at the input's inner right edge (its pad), not the
      // outer one.
      pl="calc(0.5lh + 1px - 0.35rem)"
      pr="calc(0.5lh + 1px)"
      pt="sm"
      pb="0.1lh"
      color="text-muted"
      borderRadius="xs"
      _hover={{ "@media (hover: hover)": { color: "text-primary" } }}
    >
      <Block as="span" w="1.3rem" display="grid" placeItems="center">
        <Plus size={18} />
      </Block>
      <Text as="span" fontSize="sm" fontWeight="550" textAlign="start">
        Add place
      </Text>
      <Block as="span" flex gap="0.15lh" alignItems="center">
        <Block as="span" className={keycapCss}>
          <Command size={12} />
        </Block>
        <Text as="span" fontSize="xs" fontWeight="550">
          +
        </Text>
        <Block as="span" className={keycapCss}>
          <KeyReturn size={12} />
        </Block>
      </Block>
    </Button>
  );
}
