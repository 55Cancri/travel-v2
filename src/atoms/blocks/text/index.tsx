import { motion } from "framer-motion";
import { css, cx } from "panda/css";
import { splitCssProps } from "panda/jsx";

import * as _t from "./types";

export type { Props } from "./types";

const asByKind = {
  body: "p",
  heading: "h2",
  label: "label",
  span: "span",
} as const;

function Component(props: _t.PrimitiveProps) {
  const { as: El = "p", ref, ...restProps } = props;

  return <El ref={ref} {...restProps} />;
}

const MotionComponent = motion.create(Component);

export const Text = function <T extends _t.As = "p">(props: _t.Props<T>) {
  const { as: El, className, is, unstyled, _motion, ...restProps } = props;
  const kind = is ?? "body";
  const [cssProps, elementProps] = splitCssProps(restProps);
  const { css: cssProp, ...styleProps } = cssProps;

  // Base + per-kind styles are inline literals in the single css() call, so
  // Panda statically extracts every branch and consumer style-props still win
  // the cascade by object-merge — no cva recipe needed.
  return (
    <MotionComponent
      {...elementProps}
      {..._motion}
      as={El ?? asByKind[kind]}
      className={cx(
        css(
          unstyled ? {} : { margin: 0, fontSize: "md", lineHeight: "1.5" },
          unstyled
            ? {}
            : kind === "heading"
              ? { fontSize: "2xl", fontWeight: "600" }
              : kind === "label"
                ? { fontSize: "sm", fontWeight: "500" }
                : {},
          styleProps,
          cssProp,
        ),
        className,
      )}
    />
  );
};
