import { motion } from "framer-motion";
import { css, cx } from "panda/css";

import { splitAtomProps } from "../split-atom-props";
import type { PrimitiveProps } from "../types";
import * as _t from "./types";

const asByKind = {
  body: "p",
  heading: "h2",
  label: "label",
  span: "span",
} as const;

function Component(props: PrimitiveProps) {
  const { as: El = "p", ref, ...restProps } = props;

  return <El ref={ref} {...restProps} />;
}

const MotionComponent = motion.create(Component);

export const Text = function <T extends _t.As = "p">(props: _t.Props<T>) {
  const { as: El, className, is, _motion, ...restProps } = props;
  const kind = is ?? "body";
  const { cssProp, styleProps, elementProps, motionProps, style } =
    splitAtomProps(restProps, _motion);

  // Base + per-kind styles are inline literals in the single css() call, so
  // Panda statically extracts every branch and consumer style-props still win
  // the cascade by object-merge. No cva recipe needed.
  return (
    <MotionComponent
      {...elementProps}
      {...motionProps}
      style={style}
      as={El ?? asByKind[kind]}
      className={cx(
        css(
          { margin: 0, fontSize: "md", lineHeight: "1.5" },
          kind === "heading"
            ? { fontSize: "2xl", fontWeight: "650" }
            : kind === "label"
              ? { fontSize: "sm", fontWeight: "550" }
              : {},
          styleProps,
          cssProp,
        ),
        className,
      )}
    />
  );
};

export type { Props } from "./types";
