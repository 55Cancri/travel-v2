import { Text, type TextElement, type TextProps } from "atoms";

// The error voice under an action or field: support-size danger text.
// Pinned as an alloy so error messages cannot drift in size or weight
// between screens.
export function ErrorNote<T extends TextElement = "p">(props: TextProps<T>) {
  const { as = "p" as T, ...rest } = props;
  return <Text as={as} fontSize="sm" color="danger" {...(rest as TextProps<T>)} />;
}
