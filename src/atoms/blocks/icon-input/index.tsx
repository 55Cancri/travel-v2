import type * as React from "react";

import { Block } from "../block";
import { Input, type Props as InputProps } from "../input";

export type Props = InputProps & { icon: React.ReactNode };

// An input with a leading icon, laid out as a clean two-column grid: the icon
// sits in its own `auto` column and the text flows in the `1fr` column, so there
// is no padding guesswork to clear the icon (the gap is just one token). The
// WRAPPER carries the field chrome (border, radius, surface, focus ring) and the
// inner input is stripped bare, so the whole control reads as a single field.
export function IconInput(props: Props) {
  const { icon, ...inputProps } = props;
  return (
    <Block
      grid
      cols="auto 1fr"
      alignItems="center"
      gap="xs"
      pl="sm"
      borderWidth="1px"
      borderStyle="solid"
      borderColor="border-strong"
      borderRadius="sm"
      bg="surface-panel"
      transition="border-color 120ms ease"
      _focusWithin={{ borderColor: "accent" }}
    >
      <Block display="grid" color="text-muted" pointerEvents="none">
        {icon}
      </Block>
      <Input
        {...inputProps}
        borderWidth="0"
        borderRadius="0"
        bg="transparent"
        pl="0"
        pr="sm"
        outline="none"
        _focusVisible={{ outlineColor: "transparent" }}
      />
    </Block>
  );
}
