import { Text, type TextElement, type TextProps } from "atoms";

// The uppercase section label (the "rail" heading over a panel section).
// Pins one letter-spacing value so every section label matches. Overrides
// ride the normal style props, spread after the defaults.
export function Eyebrow<T extends TextElement = "span">(props: TextProps<T>) {
  const { as = "span" as T, ...rest } = props;
  return (
    <Text
      as={as}
      fontSize="xs"
      fontWeight="650"
      color="text-muted"
      textTransform="uppercase"
      letterSpacing="0.08em"
      {...(rest as TextProps<T>)}
    />
  );
}
