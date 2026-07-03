import { motion } from "framer-motion";
import { splitCssProps } from "panda/jsx";
import { css, cx } from "panda/css";

import * as _t from "./types";

export type { Props } from "./types";

const buttonBaseStyles = {
  // inline-grid keeps the button sized like inline content while giving the
  // start/end slots a stable column layout. Plain grid would go block-level.
  display: "inline-grid",
  gridAutoFlow: "column",
  gridAutoColumns: "max-content",
  alignItems: "center",
  justifyContent: "center",
  columnGap: "sm",
  verticalAlign: "middle",
  appearance: "none",
  border: 0,
  outline: "2px solid transparent",
  outlineOffset: "0px",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "inherit",
  fontWeight: "inherit",
  lineHeight: "inherit",
  textDecoration: "none",
  userSelect: "none",
  transition: "outline-color 120ms ease, outline-offset 120ms ease",
  _focusVisible: {
    outlineColor: "focus-halo",
    outlineOffset: "2px",
  },
  _disabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
} as const;

function Component(props: _t.PrimitiveProps) {
  const { as: El = "button", ref, ...restProps } = props;

  return <El ref={ref} {...restProps} />;
}

const MotionComponent = motion.create(Component);

export const Button = function <T extends _t.As = "button">(
  props: _t.Props<T>,
) {
  const { as: El, className, children, start, end, _motion, ...restProps } =
    props;
  const [cssProps, elementProps] = splitCssProps(restProps);
  const { css: cssProp, ...styleProps } = cssProps;
  const isButtonEl = El == null || El === "button";
  const type = isButtonEl
    ? ((elementProps as { type?: string }).type ?? "button")
    : undefined;

  return (
    <MotionComponent
      {...elementProps}
      {..._motion}
      as={El}
      type={type}
      className={cx(css(buttonBaseStyles, styleProps, cssProp), className)}
    >
      {start}
      {children}
      {end}
    </MotionComponent>
  );
};
