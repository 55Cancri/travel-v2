import type { MotionProps } from "framer-motion";

import type * as _tt from "../types";

export type Kind = "heading" | "label" | "span";

export type As = _tt.TextElement;

export type Props<T extends _tt.TextElement = "p"> = _tt.PolymorphicProps<
  T,
  {
    is?: Kind;
    unstyled?: boolean;
    _motion?: MotionProps;
  },
  "unstyled"
>;

export type PrimitiveProps = _tt.PrimitiveProps;
