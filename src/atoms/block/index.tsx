import { motion } from "framer-motion";
import { css, cx } from "panda/css";

import { splitAtomProps } from "../split-atom-props";
import type { PrimitiveProps } from "../types";
import * as _t from "./types";

export type { Props } from "./types";

function Component(props: PrimitiveProps) {
  const { as: El = "div", ref, ...restProps } = props;

  return <El ref={ref} {...restProps} />;
}

const MotionComponent = motion.create(Component);

export const Block = function <T extends _t.As = "div">(props: _t.Props<T>) {
  const { as: El, className, _motion, ...restProps } = props;

  // A textarea's numeric rows/cols are the native sizing attributes, not the
  // grid-track utilities: the utilities only ever take track strings, so a
  // number routes to the element before the style split can swallow it.
  const nativeSizing: { rows?: number; cols?: number } = {};
  if (El === "textarea") {
    const sizing = restProps as { rows?: unknown; cols?: unknown };
    if (typeof sizing.rows === "number") {
      nativeSizing.rows = sizing.rows;
      delete sizing.rows;
    }
    if (typeof sizing.cols === "number") {
      nativeSizing.cols = sizing.cols;
      delete sizing.cols;
    }
  }

  const { cssProp, styleProps, elementProps, motionProps, style } =
    splitAtomProps(restProps, _motion);

  return (
    <MotionComponent
      {...elementProps}
      {...nativeSizing}
      {...motionProps}
      style={style}
      as={El}
      className={cx(css(styleProps, cssProp), className)}
    />
  );
};
