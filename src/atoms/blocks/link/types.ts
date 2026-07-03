import type { MotionProps } from "framer-motion";
import type * as React from "react";

import type * as _tt from "../types";

export type Props = _tt.NativeProps<"a", "unstyled"> & {
  _motion?: MotionProps;
  ref?: React.Ref<HTMLAnchorElement>;
};

export type PrimitiveProps = _tt.PrimitiveProps;
