import { Button, type ButtonElement, type ButtonProps } from "atoms";

// The quiet secondary action: no fill at rest, a muted-to-primary text shift
// and a soft surface well on hover. For cancel, dismiss, and the second
// choice beside a PrimaryButton. Both well tokens are theme-aware, so the
// well reads in both modes without a hand-swapped dark color.
export function GhostButton<T extends ButtonElement = "button">(props: ButtonProps<T>) {
  return (
    <Button
      color="text-muted"
      fontSize="sm"
      fontWeight="550"
      paddingInline="md"
      paddingBlock="xs"
      borderRadius="sm"
      transition="color 120ms ease, background-color 120ms ease"
      // Hover-capable devices only: touch screens keep :hover stuck after a tap.
      _hover={{
        "@media (hover: hover)": { color: "text-primary", bg: "surface-hover" },
      }}
      _pressed={{ bg: "surface-focus" }}
      {...props}
    />
  );
}
