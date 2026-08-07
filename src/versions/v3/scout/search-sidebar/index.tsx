import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Block, Plus, Text, X } from "atoms";
import { IconButton } from "alloys";
import type { Finding, SearchScope } from "../find-places";
import type { LineSet, ScoutAction } from "../lines";
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
  view: LineSet;
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
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  // Opening the sidebar is a request to type: the first query input takes
  // focus the moment the panel mounts.
  React.useEffect(() => {
    if (props.open) rootRef.current?.querySelector("input")?.focus();
  }, [props.open]);

  return (
    <AnimatePresence>
      {props.open ? (
        <Block
          ref={rootRef}
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
          bg="surface-shell"
          boxShadow="8px 0 30px rgba(0, 0, 0, 0.18)"
          _motion={{
            initial: { x: "-100%" },
            animate: { x: 0 },
            exit: { x: "-100%" },
            // A tween on the same curve as the map's left-edge push, so
            // the sidebar and the map move as one seam; a spring here
            // would let the map lag its own wall.
            transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] },
          }}
        >
          {/* One type treatment across the header (md, 550) and glyphs at
              one size; the close button's own inset is margined away so
              its glyph lines up with the input's right edge below. */}
          <Block grid cols="1fr auto auto" alignItems="center" gap="xs" px="md" pt="sm" pb="xs">
            <Text fontSize="md" fontWeight="550" color="text-muted">
              Search
            </Text>
            <IconButton
              type="button"
              aria-label="Add a query line"
              onPress={() => props.dispatch({ name: "added" })}
            >
              <Plus size={18} />
            </IconButton>
            <IconButton
              type="button"
              aria-label="Close the search sidebar"
              onPress={props.onClose}
              mr="calc((18px - 1.5rlh) / 2)"
            >
              <X size={18} />
            </IconButton>
          </Block>
          <Block overflowY="auto" px="md" pb="md" style={{ overscrollBehavior: "contain" }}>
            <LineStack
              view={props.view}
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
