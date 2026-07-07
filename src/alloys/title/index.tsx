import { Text, type TextElement, type TextProps } from "atoms";

// The name of a thing inside a constrained row or header: bold, primary,
// and truncation-safe. minW=0 is load-bearing: without it a grid/flex cell
// refuses to shrink and the ellipsis silently never happens.
export function Title<T extends TextElement = "span">(props: TextProps<T>) {
  const { as = "span" as T, ...rest } = props;
  return <Text as={as} fontWeight="650" color="text-primary" truncate minW={0} {...(rest as TextProps<T>)} />;
}
