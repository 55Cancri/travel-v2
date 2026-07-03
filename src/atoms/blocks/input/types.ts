import type { MotionProps } from "framer-motion";
import type * as React from "react";

import type * as _tt from "../types";

export type Props = _tt.NativeProps<"input", "unstyled"> & {
  _motion?: MotionProps;
  ref?: React.Ref<HTMLInputElement>;
};

export type PrimitiveProps = _tt.PrimitiveProps;
