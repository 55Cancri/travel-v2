import type { MotionProps } from "framer-motion";
import type { HTMLStyledProps } from "panda/jsx";
import type * as React from "react";

import type * as _tt from "../types";

/**
 * Not polymorphic: an Input is always an <input> inside the field root.
 * Style props target the field root (the visible box); native input props
 * (value, onChange, placeholder, ...) reach the inner element.
 */
// "start" / "end" here are the SLOTS, so the same-named inset style
// shorthands are omitted (use insetInlineStart/insetInlineEnd instead).
export type Props = _tt.FastOmit<HTMLStyledProps<"input">, "as" | "ref" | "start" | "end"> & {
  ref?: React.Ref<HTMLInputElement>;
  /** Leading slot inside the field box, typically an icon. */
  start?: React.ReactNode;
  /** Trailing slot inside the field box: clear button, unit, shortcut hint. */
  end?: React.ReactNode;
  /** Motion props for the field root. */
  _motion?: MotionProps;
};
