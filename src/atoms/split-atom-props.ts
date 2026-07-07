import type { MotionProps } from "framer-motion";
import { splitCssProps } from "panda/jsx";
import type { JsxStyleProps } from "panda/types";
import type { CSSProperties } from "react";

/**
 * The prop plumbing every atom shares: split the rest props into Panda style
 * props + the css prop vs plain DOM props, and merge the plain `style` prop
 * with `_motion.style` in one object, element style winning. The merge lives
 * here so no atom can spread `_motion` after the element props and drop the
 * caller's style.
 */
export const splitAtomProps = (
  restProps: Record<string, unknown>,
  _motion: MotionProps | undefined,
) => {
  const [cssProps, rawElementProps] = splitCssProps(
    restProps as JsxStyleProps,
  );
  const { css: cssProp, ...styleProps } = cssProps;
  const { style: elementStyle, ...elementProps } = rawElementProps as {
    style?: CSSProperties;
  } & Record<string, unknown>;
  const { style: motionStyle, ...motionProps } = _motion ?? {};
  const style =
    motionStyle || elementStyle
      ? { ...motionStyle, ...elementStyle }
      : undefined;

  return { cssProp, styleProps, elementProps, motionProps, style };
};
