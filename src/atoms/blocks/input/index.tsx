import { motion } from "framer-motion";
import { splitCssProps } from "panda/jsx";
import { css, cx } from "panda/css";

import * as _t from "./types";

export type { Props } from "./types";

const inputBaseStyles = {
  width: "100%",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "border-strong",
  borderRadius: "sm",
  background: "surface-panel",
  color: "text-primary",
  paddingInline: "sm",
  paddingBlock: "sm",
  fontFamily: "inherit",
  fontSize: "md",
  outline: "2px solid transparent",
  outlineOffset: "0px",
  transition: "outline-color 120ms ease, border-color 120ms ease",
  _placeholder: { color: "text-muted" },
  // :focus (not :focus-visible): a text field always wants its ring, whether
  // reached by click or keyboard.
  _focus: {
    outlineColor: "focus-halo",
    borderColor: "focus-ring",
  },
  _disabled: { opacity: 0.55, cursor: "not-allowed" },
} as const;

function Component(props: _t.PrimitiveProps) {
  const { as: El = "input", ref, ...restProps } = props;

  return <El ref={ref} {...restProps} />;
}

const MotionComponent = motion.create(Component);

export const Input = function (props: _t.Props) {
  const { className, _motion, ...restProps } = props;
  const [cssProps, elementProps] = splitCssProps(restProps);
  const { css: cssProp, ...styleProps } = cssProps;

  return (
    <MotionComponent
      {...elementProps}
      {..._motion}
      as="input"
      className={cx(css(inputBaseStyles, styleProps, cssProp), className)}
    />
  );
};
