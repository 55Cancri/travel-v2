import { Text, type TextElement, type TextProps } from "atoms";

// The quiet secondary voice: metadata, counts, helper copy, empty-state
// lines. Size stays a call-site choice: xs in dense menus, sm in rows, md
// in empty states.
export function Subtext<T extends TextElement = "span">(props: TextProps<T>) {
  const { as = "span" as T, ...rest } = props;
  return <Text as={as} color="text-muted" {...(rest as TextProps<T>)} />;
}
