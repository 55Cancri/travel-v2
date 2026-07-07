import { Button, type ButtonElement, type ButtonProps } from "atoms";

// A square, icon-only control for toolbars and row actions. The hover/press
// well lives on a ::before pseudo so the glyph never shifts: a caller that
// overrides _hover drops the well with no extra prop. isolation pins the
// pseudo (at zIndex -1) between the button background and the glyph so it
// cannot escape behind an ancestor surface. willChange keeps the pseudo on
// its own layer, so the press-scale animation mutates an existing layer
// instead of re-rasterizing the glyph a sub-pixel off each press.
export function IconButton<T extends ButtonElement = "button">(props: ButtonProps<T>) {
  return (
    <Button
      color="text-muted"
      // rlh keeps the hitbox on the vertical rhythm while staying pinned to
      // the ROOT line-height: element-relative lh would inflate the target
      // with the glyph's font size. Callers size up (2rlh+) for primary
      // touch surfaces.
      size="1.5rlh"
      borderRadius="xs"
      position="relative"
      isolation="isolate"
      transition="color 140ms ease"
      // Hover styles apply only on devices that can hover: on a touch screen
      // :hover sticks after the tap and leaves the well stranded on the glyph.
      _hover={{
        "@media (hover: hover)": { color: "text-primary", _before: { bg: "surface-hover" } },
      }}
      _pressed={{ _before: { bg: "surface-focus", transform: "scale(0.88)" } }}
      _before={{
        content: '""',
        position: "absolute",
        inset: "0",
        borderRadius: "inherit",
        zIndex: -1,
        willChange: "transform",
        transition: "background-color 140ms ease, transform 90ms ease",
      }}
      {...props}
    />
  );
}
