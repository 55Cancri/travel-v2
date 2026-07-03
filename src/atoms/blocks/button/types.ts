import type { MotionProps } from "framer-motion";
import type * as React from "react";

import type * as _tt from "../types";

export type As = _tt.ButtonElement;

export type Props<T extends _tt.ButtonElement = "button"> =
  _tt.PolymorphicProps<
    T,
    {
      start?: React.ReactNode;
      end?: React.ReactNode;
      _motion?: MotionProps;
    },
    "unstyled"
  >;

export type PrimitiveProps = _tt.PrimitiveProps;
