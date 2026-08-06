import { motion } from "framer-motion";
import { Button, type ButtonProps } from "atoms";

// A real checkbox: a rounded SQUARE (not a radio circle) that fills with the
// accent and draws its check with framer's pathLength (normalized 0..1 via the
// SVG pathLength attribute, so it needs no measurement and is SSR-safe). `muted`
// grays it (e.g. an empty row not yet checkable) but it stays CLICKABLE: a
// disabled <button> swallows the tap with no press, so the caller can route a
// muted tap somewhere useful instead. Style props pass through like every
// alloy's, and the caller's win (a highlighted row lifts the border).
export function Checkbox(props: {
  checked: boolean;
  muted?: boolean;
  onToggle: () => void;
  label?: string;
  /** Toggling never moves focus here, so an editor's caret and keyboard survive the tap. */
  preservesFocus?: boolean;
} & Omit<ButtonProps<"button">, "checked" | "onToggle" | "label">) {
  const { checked, muted, onToggle, label, preservesFocus, ...rest } = props;
  return (
    <Button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onPress={onToggle}
      preservesFocus={preservesFocus}
      grid
      placeItems="center"
      w="1.3rem"
      h="1.3rem"
      p={0}
      borderRadius="xs"
      borderWidth="1.5px"
      borderStyle="solid"
      borderColor={checked ? "accent" : muted ? "border-muted" : "border-strong"}
      bg={checked ? "accent" : "transparent"}
      color="text-on-accent"
      transition="background-color 200ms ease, border-color 200ms ease"
      {...rest}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ width: "0.95rem", height: "0.95rem", display: "block" }}
      >
        {/* pathLength animates both ways: draws on check, retracts on uncheck */}
        <motion.path
          d="M5 13l4 4L19 7"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      </svg>
    </Button>
  );
}
