import type { MotionProps } from "framer-motion";

import type * as _tt from "../types";

export type As = _tt.BlockElement;

// rows/cols are redeclared over the styled props because they carry two
// meanings: grid-track shorthand strings anywhere, and native numeric sizing
// attributes on a textarea (the component routes numbers to the element).
// A conditional type keyed on T would distribute over every BlockElement and
// stall the typechecker, so the widening is unconditional.
export type Props<T extends _tt.BlockElement = "div"> = _tt.PolymorphicProps<
  T,
  { _motion?: MotionProps; rows?: number | string; cols?: number | string },
  "rows" | "cols"
>;
