import type * as React from "react";
import type { HTMLStyledProps } from "panda/jsx";

/**
 * Constrained element unions for the polymorphic atoms. Replacing the unbounded
 * `React.ElementType` with these small unions keeps `tsc` fast — TypeScript only
 * instantiates props for the members listed here, not every intrinsic element.
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
  | "ul"
  | "ol"
  | "li"
  | "label"
  | "span";

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
  | "blockquote"
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
