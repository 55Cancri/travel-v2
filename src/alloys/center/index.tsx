import { Block, type BlockElement, type BlockProps } from "atoms";

// The centering well: grid + placeItems center, for small icon-in-square
// wells and full-panel empty/loading states alike. Size and padding stay
// call-site choices.
export function Center<T extends BlockElement = "div">(props: BlockProps<T>) {
  return <Block grid placeItems="center" {...props} />;
}
