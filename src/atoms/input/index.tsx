import { motion } from "framer-motion";
import { css, cx } from "panda/css";
import { splitCssProps } from "panda/jsx";
import * as React from "react";

import { attachRefs } from "../attach-refs";
import type * as _t from "./types";

export type { Props } from "./types";

// Base field-root styles live inline (not a pre-computed class) so they flow
// through the SAME css() call as the consumer's style props: Panda deep-merges
// the arguments with later ones winning per property, which is what lets
// <Input border="0"> actually override the base without specificity tricks.
const fieldRootStyles = {
  display: "grid",
  alignItems: "center",
  columnGap: "xs",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  paddingBlock: "sm",
  paddingInline: "sm",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "border-strong",
  borderRadius: "sm",
  boxShadow: "0 0 0 0 transparent",
  cursor: "text",
  fontFamily: "inherit",
  fontSize: "md",
  fontWeight: "inherit",
  lineHeight: "1.5",
  color: "text-primary",
  background: "surface-panel",
  transition: "border-color 120ms ease, box-shadow 120ms ease",
  // Focus = the blue system ring plus its translucent halo. :focus-within
  // (not :focus-visible): a text field always wants its ring, whether
  // reached by click or keyboard. Both tokens are theme-aware.
  _focusWithin: {
    borderColor: "focus-ring",
    boxShadow: "0 0 0 3px {colors.focus-halo}",
  },
} as const;

const inputElementStyles = {
  appearance: "none",
  width: "100%",
  minWidth: 0,
  padding: 0,
  border: 0,
  outline: "none",
  background: "transparent",
  fontFamily: "inherit",
  fontSize: "inherit",
  fontWeight: "inherit",
  lineHeight: "inherit",
  color: "inherit",
  // text-decoration does not propagate into form controls on its own, so a
  // struck-through field (a cancelled item's title) opts in via inherit.
  textDecoration: "inherit",
  letterSpacing: "inherit",
  _placeholder: {
    color: "text-muted",
  },
} as const;

export const Input = (props: _t.Props) => {
  const { ref, className, start, end, _motion, ...restProps } = props;
  const [cssProps, rawElementProps] = splitCssProps(restProps);
  const { css: cssProp, ...styleProps } = cssProps;
  // The consumer's style prop targets the field root like every other
  // atom's; only inputElementStyles reach the inner element.
  const {
    style: rootStyle,
    disabled = false,
    ...inputProps
  } = rawElementProps as React.ComponentPropsWithoutRef<"input">;
  const { style: motionStyle, ...motionProps } = _motion ?? {};
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const hasStart = start != null;
  const hasEnd = end != null;
  // Column count depends on which slots exist: a runtime value, so it rides
  // the raw style attribute (Panda only extracts static literals).
  const gridTemplateColumns = [
    hasStart ? "auto" : "",
    "minmax(0, 1fr)",
    hasEnd ? "auto" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // The whole box acts as the input's hit area: clicking padding or a slot
  // focuses the text, matching how a native field's border box behaves.
  // Interactive slot content (a clear button, a link) keeps its own press:
  // stealing focus from it would swallow the click.
  const focusFromRoot = (event: React.MouseEvent<HTMLDivElement>) => {
    const input = inputRef.current;
    if (!input || event.target === input || disabled) return;
    if (
      event.target instanceof Element &&
      event.target.closest("button, a, input, select, textarea")
    ) {
      return;
    }
    event.preventDefault();
    input.focus();
  };

  return (
    <motion.div
      {...motionProps}
      data-disabled={disabled || undefined}
      style={{ ...motionStyle, ...rootStyle, gridTemplateColumns }}
      className={cx(
        css(
          fieldRootStyles,
          disabled ? { cursor: "not-allowed", opacity: 0.55 } : {},
          styleProps,
          cssProp,
        ),
        className,
      )}
      onMouseDown={focusFromRoot}
    >
      {hasStart ? (
        <span className={css({ display: "grid", placeItems: "center", color: "inherit" })}>
          {start}
        </span>
      ) : null}
      <input
        {...inputProps}
        ref={attachRefs(inputRef, ref)}
        disabled={disabled}
        className={css(inputElementStyles)}
      />
      {hasEnd ? (
        <span className={css({ display: "grid", placeItems: "center", color: "inherit" })}>
          {end}
        </span>
      ) : null}
    </motion.div>
  );
};
