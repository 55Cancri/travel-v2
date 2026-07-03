import { motion } from "framer-motion";
import { type LinkComponent, createLink } from "@tanstack/react-router";
import { splitCssProps } from "panda/jsx";
import { css, cx } from "panda/css";

import * as _t from "./types";

export type { Props } from "./types";

// Wrap a plain <a> (not motion.a) so framer's strict intrinsic typing doesn't
// collide with the DOM event handlers Panda's anchor props carry — the same
// trick Block/Button use via motion.create.
function Component(props: _t.PrimitiveProps) {
  const { as: El = "a", ref, ...restProps } = props;

  return <El ref={ref} {...restProps} />;
}

const MotionAnchor = motion.create(Component);

// A router-aware <a> styled with Panda props and animatable via _motion, so
// links share the atom prop API. splitCssProps peels style props into a class;
// the href, onClick, and active/inactive props the router injects land on <a>.
const Anchor = function (props: _t.Props & { className?: string }) {
  const { ref, className, _motion, ...rest } = props;
  const [cssProps, elementProps] = splitCssProps(rest);
  const { css: cssProp, ...styleProps } = cssProps;

  return (
    <MotionAnchor
      ref={ref}
      {...elementProps}
      {..._motion}
      className={cx(css(styleProps, cssProp), className)}
    />
  );
};

// createLink keeps TanStack's type-safe navigation (to, params, search,
// preload) while delegating render to the styled Anchor. preload="intent" warms
// the route on hover; callers can override it.
const RouterLink = createLink(Anchor);

export const Link: LinkComponent<typeof Anchor> = (props) => (
  <RouterLink preload="intent" {...props} />
);
