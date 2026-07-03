import type { MotionProps } from "framer-motion";

import type * as _tt from "../types";

export type As = _tt.BlockElement;

export type Props<T extends _tt.BlockElement = "div"> = _tt.PolymorphicProps<
  T,
  { _motion?: MotionProps },
  "unstyled"
>;

export type PrimitiveProps = _tt.PrimitiveProps;
