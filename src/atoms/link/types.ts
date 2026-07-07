import type { MotionProps } from "framer-motion";
import type * as React from "react";

import type * as _tt from "../types";

export type Props = _tt.NativeProps<"a"> & {
  _motion?: MotionProps;
  ref?: React.Ref<HTMLAnchorElement>;
};
