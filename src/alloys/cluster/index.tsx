import { Block, type BlockElement, type BlockProps } from "atoms";

// The single-row horizontal grouping: icon+label rows, title+count pairs,
// toolbar clusters. Grid with column auto-flow, never flex, centered
// cross-axis by default.
export function Cluster<T extends BlockElement = "div">(props: BlockProps<T>) {
  return <Block grid gridAutoFlow="column" alignItems="center" gap="sm" {...props} />;
}
