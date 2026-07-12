import { motion } from "framer-motion";
import { type LinkComponent, createLink } from "@tanstack/react-router";
import { css, cx } from "panda/css";
import type * as React from "react";

import { haptic as fireHaptic } from "../haptics";
import { splitAtomProps } from "../split-atom-props";
import type { PrimitiveProps } from "../types";
import * as _t from "./types";

export type { Props } from "./types";

// Wrap a plain <a> (not motion.a) so framer's strict intrinsic typing doesn't
// collide with the DOM event handlers Panda's anchor props carry: the same
// trick Block/Button use via motion.create.
function Component(props: PrimitiveProps) {
  const { as: El = "a", ref, ...restProps } = props;

  return <El ref={ref} {...restProps} />;
}

const MotionAnchor = motion.create(Component);

// A router-aware <a> styled with Panda props and animatable via _motion, so
// links share the atom prop API. splitAtomProps peels style props into a
// class and merges _motion.style with the element style; the href, onClick,
// and active/inactive props the router injects land on <a>.
const Anchor = function (props: _t.Props & { className?: string }) {
  const { ref, className, _motion, haptic = "tap", onClick, ...rest } = props;
  const { cssProp, styleProps, elementProps, motionProps, style } =
    splitAtomProps(rest, _motion);
  // Links carry no press wiring, so the tactile cue rides the click the
  // router already composed (its navigation handler arrives as onClick).
  const click = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (haptic !== false) fireHaptic(haptic);
    onClick?.(event);
  };

  return (
    <MotionAnchor
      ref={ref}
      {...elementProps}
      {...motionProps}
      onClick={click}
      style={style}
      className={cx(css(styleProps, cssProp), className)}
    />
  );
};

// createLink keeps TanStack's type-safe navigation (to, params, search,
// preload) while delegating render to the styled Anchor. preload="intent"
// warms the route on hover; callers can override it.
const RouterLink = createLink(Anchor);

export const Link: LinkComponent<typeof Anchor> = (props) => (
  <RouterLink preload="intent" {...props} />
);
