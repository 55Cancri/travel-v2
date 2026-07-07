import { Text, type TextElement, type TextProps } from "atoms";

// The "not set / no value yet" voice: italic and muted, distinct from
// Subtext so absence never reads as content.
export function Placeholder<T extends TextElement = "span">(props: TextProps<T>) {
  const { as = "span" as T, ...rest } = props;
  return <Text as={as} color="text-muted" fontStyle="italic" {...(rest as TextProps<T>)} />;
}
