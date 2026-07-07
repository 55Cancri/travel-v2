import { Text, type TextElement, type TextProps } from "atoms";

// The label beside a field or value: medium weight, muted, no uppercase
// (that louder treatment is Eyebrow's job).
export function FieldLabel<T extends TextElement = "label">(props: TextProps<T>) {
  const { as = "label" as T, ...rest } = props;
  return <Text as={as} fontSize="sm" fontWeight="550" color="text-muted" {...(rest as TextProps<T>)} />;
}
