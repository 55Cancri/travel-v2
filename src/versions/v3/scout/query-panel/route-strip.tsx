import { Block, Text, X } from "atoms";
import { IconButton } from "alloys";

// What the Cmd-clicked route amounts to, and the way out of it. It sits
// above the query lines because the route is about the map as a whole,
// while a line is about one question asked of it.
//
// It also carries the routing notice. A leg the routers could not answer is
// drawn as a straight line, and a straight line that says nothing would
// read as a real path.
export function RouteStrip(props: {
  count: number;
  notice: string | null;
  onClear: () => void;
  onUndo: () => void;
}) {
  return (
    <Block pt="xs" pb="sm">
      <Block grid cols="1fr auto auto" alignItems="center" gap="xs">
        <Text fontSize="xs" fontWeight="550" color="text-muted">
          Route · {props.count} {props.count === 1 ? "point" : "points"}
        </Text>
        <IconButton type="button" aria-label="Remove the last route point" onPress={props.onUndo}>
          <Text fontSize="xs" fontWeight="550">
            Undo
          </Text>
        </IconButton>
        <IconButton type="button" aria-label="Clear the route" onPress={props.onClear}>
          <X size={16} />
        </IconButton>
      </Block>
      {props.count === 1 ? (
        <Text as="p" fontSize="xs" color="text-muted" pt="xs">
          Cmd-click the map again to draw a route from here.
        </Text>
      ) : null}
      {props.notice ? (
        <Text as="p" fontSize="xs" color="danger" pt="xs">
          {props.notice}
        </Text>
      ) : null}
    </Block>
  );
}
