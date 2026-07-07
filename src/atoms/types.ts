import type * as React from "react";
import type { HTMLStyledProps } from "panda/jsx";

/**
 * Constrained element unions for polymorphic components. Replacing the
 * unbounded `React.ElementType` with these small unions eliminates the
 * massive distributive type expansion that made typechecking slow:
 * TypeScript only instantiates `ComponentPropsWithRef` for the members
 * listed here instead of for every intrinsic HTML element.
 *
 * To allow a new element, add it to the appropriate union.
 */
export type BlockElement =
  | "div"
  | "form"
  | "main"
  | "header"
  | "aside"
  | "section"
  | "article"
  | "nav"
  | "footer"
  | "fieldset"
  | "figure"
  | "label"
  | "ul"
  | "ol"
  | "li"
  | "span"
  | "dialog"
  | "details"
  | "summary"
  | "img"
  | "canvas"
  | "textarea"
  | "table"
  | "thead"
  | "tbody"
  | "tr"
  | "th"
  | "td";

export type TextElement =
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "span"
  | "label"
  | "legend"
  | "figcaption"
  | "blockquote"
  | "cite"
  | "code"
  | "a";

export type ButtonElement = "button" | "a";

export type FastOmit<T, TOmittedKey extends PropertyKey> = {
  [TKey in keyof T as TKey extends TOmittedKey ? never : TKey]: T[TKey];
};

export type NativeProps<
  T extends React.ElementType,
  TOmittedKey extends PropertyKey = never,
> = FastOmit<HTMLStyledProps<T>, TOmittedKey | "as" | "ref">;

export type PolymorphicProps<
  T extends React.ElementType,
  TOwnProps = {},
  TOmittedKey extends PropertyKey = never,
> = NativeProps<T, TOmittedKey> &
  TOwnProps & {
    as?: T;
    ref?: React.ComponentPropsWithRef<T>["ref"];
  };

export interface PrimitiveProps {
  ref?: React.Ref<unknown>;
  children?: React.ReactNode;
  as?: React.ElementType;
  className?: string;
  [key: string]: unknown;
}
