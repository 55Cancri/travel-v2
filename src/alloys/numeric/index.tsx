import { Text, type TextElement, type TextProps } from "atoms";

// Numeric readouts that must not jitter in width: timecodes, counters,
// clocks. Tabular figures are the entire point.
export function Numeric<T extends TextElement = "span">(props: TextProps<T>) {
  const { as = "span" as T, ...rest } = props;
  return <Text as={as} fontVariantNumeric="tabular-nums" {...(rest as TextProps<T>)} />;
}
