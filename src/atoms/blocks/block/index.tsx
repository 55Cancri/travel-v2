import { motion } from "framer-motion";
import { splitCssProps } from "panda/jsx";
import { css, cx } from "panda/css";

import * as _t from "./types";

export type { Props } from "./types";

function Component(props: _t.PrimitiveProps) {
  const { as: El = "div", ref, ...restProps } = props;

  return <El ref={ref} {...restProps} />;
}

const MotionComponent = motion.create(Component);

export const Block = function <T extends _t.As = "div">(props: _t.Props<T>) {
  const { as: El, className, _motion, ...restProps } = props;
  const [cssProps, elementProps] = splitCssProps(restProps);
  const { css: cssProp, ...styleProps } = cssProps;

  return (
    <MotionComponent
      {...elementProps}
      {..._motion}
      as={El}
      className={cx(css(styleProps, cssProp), className)}
    />
  );
};
