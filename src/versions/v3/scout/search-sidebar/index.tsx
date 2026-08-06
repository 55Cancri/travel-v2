import { AnimatePresence } from "framer-motion";
import { Block, Plus, Text, X } from "atoms";
import { IconButton } from "alloys";
import type { Finding, SearchScope } from "../find-places";
import type { ScoutAction, ScoutLine } from "../lines";
import { LineStack } from "../query-panel/line-stack";

// The docked search surface: a full-height panel sliding in from the left
// edge, holding the same query lines as the floating panel. No backdrop,
// deliberately: the map stays live beside it, and pressing a result flies
// the camera while the list keeps standing. While this is open the
// floating panel unmounts (two mounted copies of the lines would run
// every search twice); the shared line state survives the swap.

export function SearchSidebar(props: {
  open: boolean;
  onClose: () => void;
  lines: ScoutLine[];
  scopeOf: () => SearchScope | null;
  dispatch: (action: ScoutAction) => void;
  onFocusFinding: (finding: Finding) => void;
  now: Temporal.Instant;
  mapReady: boolean;
  edgeCount: number;
  routeNotice: string | null;
  onClearRoute: () => void;
  onUndoEdge: () => void;
}) {
  return (
    <AnimatePresence>
      {props.open ? (
        <Block
          role="complementary"
          aria-label="Search the map"
          position="absolute"
          insetBlock="0"
          insetInlineStart="0"
          w="24rem"
          maxW="85vw"
          zIndex={25}
          grid
          rows="auto 1fr"
          bg="surface-panel"
          boxShadow="8px 0 30px rgba(0, 0, 0, 0.18)"
          _motion={{
            initial: { x: "-100%" },
            animate: { x: 0 },
            exit: { x: "-100%" },
            transition: { type: "spring", stiffness: 420, damping: 40 },
          }}
        >
          <Block grid cols="1fr auto auto" alignItems="center" gap="xs" pl="md" pr="sm" pt="sm" pb="xs">
            <Text fontSize="sm" fontWeight="550" color="text-muted">
              Search
            </Text>
            <IconButton
              type="button"
              aria-label="Add a query line"
              onPress={() => props.dispatch({ name: "added" })}
            >
              <Plus size={16} />
            </IconButton>
            <IconButton type="button" aria-label="Close the search sidebar" onPress={props.onClose}>
              <X size={16} />
            </IconButton>
          </Block>
          <Block overflowY="auto" px="md" pb="md" style={{ overscrollBehavior: "contain" }}>
            <LineStack
              lines={props.lines}
              scopeOf={props.scopeOf}
              dispatch={props.dispatch}
              onFocusFinding={props.onFocusFinding}
              now={props.now}
              mapReady={props.mapReady}
              edgeCount={props.edgeCount}
              routeNotice={props.routeNotice}
              onClearRoute={props.onClearRoute}
              onUndoEdge={props.onUndoEdge}
            />
          </Block>
        </Block>
      ) : null}
    </AnimatePresence>
  );
}
