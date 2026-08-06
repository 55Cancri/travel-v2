import { Block, Button, Command, KeyReturn, Plus, Text } from "atoms";

// The list's growing edge: a ghost row under the last query line that
// appends a fresh one, with the keycap hint for the same move from the
// keyboard (Cmd+Enter inside any query input). The plus stands in the
// checkbox column and the label lands flush with the row text above it,
// so the ghost reads as the next entry rather than a control.
export function AddPlaceRow(props: { onAdd: () => void }) {
  return (
    <Button
      type="button"
      onPress={props.onAdd}
      w="100%"
      minW={0}
      grid
      cols="auto 1fr auto"
      gap="calc(1lh + 1px - 0.7rem)"
      alignItems="center"
      justifyContent="start"
      gridAutoColumns="unset"
      py="sm"
      px="1lh"
      mx="-1lh"
      borderRadius="0"
      color="text-muted"
      _hover={{ "@media (hover: hover)": { bg: "surface-muted", color: "text-primary" } }}
    >
      <Block as="span" w="1.3rem" display="grid" placeItems="center">
        <Plus size={16} />
      </Block>
      <Text as="span" fontSize="sm" fontWeight="550" textAlign="start">
        Add place
      </Text>
      <Block as="span" grid cols="auto auto" gap="0.15lh" alignItems="center">
        {/* Keycaps, not buttons: the shortcut spelled in hardware. */}
        <Block
          as="span"
          grid
          placeItems="center"
          w="1.3rem"
          h="1.3rem"
          borderRadius="xs"
          borderWidth="1px"
          borderStyle="solid"
          borderColor="border-muted"
        >
          <Command size={12} />
        </Block>
        <Block
          as="span"
          grid
          placeItems="center"
          w="1.3rem"
          h="1.3rem"
          borderRadius="xs"
          borderWidth="1px"
          borderStyle="solid"
          borderColor="border-muted"
        >
          <KeyReturn size={12} />
        </Block>
      </Block>
    </Button>
  );
}
