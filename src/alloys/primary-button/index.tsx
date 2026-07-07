import { Button, type ButtonElement, type ButtonProps } from "atoms";

// The one filled call-to-action in a view: accent fill, on-accent text, and
// the accent-strong step on hover. The press shrink rides _pressed (Button's
// react-aria press state) rather than :active, so it also fires for keyboard
// Space and cancels on drag-off. Every visual is a semantic token, so the
// button re-themes with the palette and needs no _dark overrides.
export function PrimaryButton<T extends ButtonElement = "button">(props: ButtonProps<T>) {
  return (
    <Button
      bg="accent"
      color="text-on-accent"
      fontSize="sm"
      fontWeight="550"
      paddingInline="md"
      paddingBlock="xs"
      borderRadius="sm"
      transition="background-color 120ms ease, transform 90ms ease"
      // Hover-capable devices only: touch screens keep :hover stuck after a tap.
      _hover={{ "@media (hover: hover)": { bg: "accent-strong" } }}
      _pressed={{ transform: "scale(0.97)" }}
      {...props}
    />
  );
}
