import { motion } from "framer-motion";
import { css, cx } from "panda/css";
import * as React from "react";
import { mergeProps } from "react-aria/mergeProps";
import { useButton } from "react-aria/useButton";
import { useLongPress } from "react-aria/useLongPress";

import { attachRefs } from "../attach-refs";
import { haptic as fireHaptic } from "../haptics";
import { Spinner } from "../icons";
import { splitAtomProps } from "../split-atom-props";
import type { PrimitiveProps } from "../types";
import * as _t from "./types";

export type { Props } from "./types";

// Base styles live inline so they flow through the same css() call as the
// consumer's style props and lose every per-property merge to them (see the
// cascade contract in panda-style-reuse). The base is deliberately unstyled
// chrome: real looks come from alloys and call sites.
const buttonBaseStyles = {
  // inline-grid keeps the button sized like inline content while the
  // start/end slots and loader get a stable grid layout.
  display: "inline-grid",
  gridAutoFlow: "column",
  gridAutoColumns: "max-content",
  alignItems: "center",
  justifyContent: "center",
  justifyItems: "center",
  columnGap: "sm",
  verticalAlign: "middle",
  appearance: "none",
  padding: 0,
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
  textAlign: "inherit",
  textDecoration: "none",
  userSelect: "none",
  transition: "outline-color 120ms ease, outline-offset 120ms ease",
  _focusVisible: {
    outlineColor: "focus-ring",
    outlineOffset: "2px",
    _pressed: {
      outlineOffset: "0px",
    },
  },
  _disabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
} as const;

function Component(props: PrimitiveProps) {
  const { as: El = "button", ref, ...restProps } = props;

  return <El ref={ref} {...restProps} />;
}

const MotionComponent = motion.create(Component);

export const Button = function <T extends _t.As = "button">(
  props: _t.Props<T>,
) {
  const {
    as: El,
    className,
    children,
    start,
    end,
    isLoading,
    loadingPlacement = "start",
    loadingIndicator,
    onPress,
    onLongPress,
    preservesFocus,
    haptic = "tap",
    _motion,
    ...restProps
  } = props;
  const { cssProp, styleProps, elementProps: splitElementProps, motionProps, style } =
    splitAtomProps(restProps, _motion);
  const {
    ref: consumerRef,
    disabled,
    type: buttonKind,
    href,
    ...elementProps
  } = splitElementProps as {
    ref?: React.Ref<HTMLElement>;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
    href?: string;
  } & Record<string, unknown>;
  const elementType = (El ?? "button") as _t.As;
  const isDisabled = Boolean(isLoading || disabled);
  const domRef = React.useRef<HTMLElement | null>(null);
  // useButton wraps usePress: pointer/touch/keyboard/virtual-click
  // activation with drag-off cancel, Space page-scroll suppression, and the
  // WKWebView quirks catalog. For as="a" it adds role="button" + keyboard
  // activation. It never renders anything: the element stays ours.
  const { buttonProps, isPressed } = useButton(
    {
      elementType,
      isDisabled,
      // The buzz belongs to the press itself, so it fires even for
      // buttons whose work happens elsewhere (form submits, links).
      onPress: (event) => {
        if (haptic !== false) fireHaptic(haptic);
        onPress?.(event);
      },
      href,
      preventFocusOnPress: preservesFocus,
      type: elementType === "button" ? (buttonKind ?? "button") : undefined,
    },
    domRef as React.RefObject<HTMLElement>,
  );
  // useLongPress coordinates with usePress through react-aria's internal
  // press registry: once the hold threshold fires, the release's press is
  // cancelled, so tap and hold stay mutually exclusive on one element.
  const { longPressProps } = useLongPress({
    isDisabled: isDisabled || onLongPress === undefined,
    onLongPress,
  });
  const loader = loadingIndicator ?? <Spinner />;

  return (
    <MotionComponent
      {...mergeProps(buttonProps, longPressProps, elementProps)}
      {...motionProps}
      style={style}
      as={El}
      ref={attachRefs(domRef, consumerRef)}
      aria-busy={isLoading || undefined}
      data-pressed={isPressed || undefined}
      // _disabled also matches [data-disabled], which covers as="a" where
      // the disabled attribute does not exist.
      data-disabled={isDisabled || undefined}
      className={cx(css(buttonBaseStyles, styleProps, cssProp), className)}
    >
      {isLoading && loadingPlacement === "replace" ? (
        <>
          {loader}
          {/* The label keeps the button's accessible name while the loader
              visually replaces it. */}
          <span className={css({ srOnly: true })}>{children}</span>
        </>
      ) : (
        <>
          {isLoading && loadingPlacement === "start" ? loader : start}
          {children}
          {isLoading && loadingPlacement === "end" ? loader : end}
        </>
      )}
    </MotionComponent>
  );
};
