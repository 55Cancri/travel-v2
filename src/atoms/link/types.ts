import type { MotionProps } from "framer-motion";
import type * as React from "react";

import type { HapticName } from "../haptics";
import type * as _tt from "../types";

export type Props = _tt.NativeProps<"a"> & {
  _motion?: MotionProps;
  ref?: React.Ref<HTMLAnchorElement>;
  /**
   * The tactile cue a click fires. Every click taps unless a call site
   * names a different cue or silences it with false.
   */
  haptic?: HapticName | false;
};
