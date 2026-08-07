import * as React from "react";
import { Block, DotsSixVertical, haptic, Plus, Text } from "atoms";
import { IconButton } from "alloys";
import type { Finding, SearchScope } from "../find-places";
import type { LineSet, ScoutAction } from "../lines";
import { LineStack } from "./line-stack";

// The floating frame the query lines live in: dragged by its grip row,
// resized from its bottom corner, and remembered across reloads so a scout
// who parked it out of the way finds it there next time.
//
// Position and size are runtime numbers, so they ride the raw `style`
// attribute; a Panda style prop fed a variable extracts to nothing. During a
// drag they are written straight to the element and only committed to React
// state on release, which keeps a list of results from re-rendering on every
// pointer frame.

const FRAME_KEY = "travel2:scout-panel";
const MIN_WIDTH = 300;
const MIN_HEIGHT = 180;
// However far the panel is dragged, this much of it stays catchable.
const KEEP_ON_SCREEN = 80;

type Frame = { x: number; y: number; width: number; height: number };

const openingFrame = (): Frame => ({ x: 16, y: 16, width: 380, height: 420 });

const storedFrame = (): Frame | null => {
  try {
    const raw = localStorage.getItem(FRAME_KEY);
    if (!raw) return null;
    const frame = JSON.parse(raw) as Partial<Frame>;
    const { x, y, width, height } = frame;
    if ([x, y, width, height].some((value) => typeof value !== "number")) return null;
    return frame as Frame;
  } catch (error) {
    console.warn("[scout] stored panel frame unreadable:", error);
    return null;
  }
};

const rememberFrame = (frame: Frame) => {
  try {
    localStorage.setItem(FRAME_KEY, JSON.stringify(frame));
  } catch {
    // Sealed storage: the frame holds for this session, only the
    // across-reload memory is lost.
  }
};

type Viewport = { width: number; height: number };

// Fitted to the window, never written back to the authored frame. Shrinking
// the window narrows the panel for as long as it stays narrow; widening it
// hands back the size that was actually chosen. Folding the fit into the
// stored frame instead would make every small window a permanent one.
const fitted = (frame: Frame, viewport: Viewport): Frame => {
  const width = Math.max(MIN_WIDTH, Math.min(frame.width, viewport.width));
  const height = Math.max(MIN_HEIGHT, Math.min(frame.height, viewport.height));
  return {
    width,
    height,
    x: Math.max(KEEP_ON_SCREEN - width, Math.min(frame.x, viewport.width - KEEP_ON_SCREEN)),
    y: Math.max(0, Math.min(frame.y, viewport.height - KEEP_ON_SCREEN)),
  };
};

export function QueryPanel(props: {
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
  // Mount with the opening frame and adopt the stored one on the client:
  // localStorage and window are both out of reach while this renders on the
  // server, and a mismatch here would be a hydration error. The viewport is
  // measured rather than read at use time, so nothing fits itself against a
  // window that has not been laid out yet (which would pin the panel to its
  // minimum size in a corner, permanently).
  const [frame, storeFrame] = React.useState(openingFrame);
  const [viewport, storeViewport] = React.useState<Viewport | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const stored = storedFrame();
    if (stored) storeFrame(stored);
    const measure = () => {
      const { innerWidth, innerHeight } = window;
      if (innerWidth > 0 && innerHeight > 0) storeViewport({ width: innerWidth, height: innerHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const shown = viewport ? fitted(frame, viewport) : frame;
  // The live frame follows the rendered one EXCEPT during a gesture, when
  // the pointer owns it. Results arriving (or the minute clock ticking)
  // re-render mid-drag, and syncing then would hand pointerup the geometry
  // from before the drag started.
  const gesturingRef = React.useRef(false);
  const liveRef = React.useRef(shown);
  if (!gesturingRef.current) liveRef.current = shown;

  const startGesture = (event: React.PointerEvent<HTMLElement>, gesture: "move" | "size") => {
    if (event.button !== 0) return;
    // The grip row carries a control of its own. Claiming the gesture here
    // would preventDefault the press that control was waiting for, so a
    // press that starts on a button is never a drag.
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const grip = event.currentTarget;
    // Moving carries the AUTHORED size along, never the fitted one: nudging
    // the panel in a narrow window must not quietly adopt the shrunken
    // width as the size the user chose. Resizing does author what is
    // grabbed, because that is the size being set.
    const startFrame =
      gesture === "move" ? { ...frame, x: liveRef.current.x, y: liveRef.current.y } : liveRef.current;
    const origin = { x: event.clientX, y: event.clientY, frame: startFrame, viewport };
    gesturingRef.current = true;
    grip.setPointerCapture(event.pointerId);
    haptic("grab");
    const gestureListeners = new AbortController();
    grip.addEventListener(
      "pointermove",
      (move: PointerEvent) => {
        const dx = move.clientX - origin.x;
        const dy = move.clientY - origin.y;
        const moved =
          gesture === "move"
            ? { ...origin.frame, x: origin.frame.x + dx, y: origin.frame.y + dy }
            : {
                ...origin.frame,
                width: origin.frame.width + dx,
                height: origin.frame.height + dy,
              };
        const next = origin.viewport ? fitted(moved, origin.viewport) : moved;
        liveRef.current = next;
        const panel = panelRef.current;
        if (!panel) return;
        panel.style.left = `${next.x}px`;
        panel.style.top = `${next.y}px`;
        panel.style.width = `${next.width}px`;
        panel.style.height = `${next.height}px`;
      },
      { signal: gestureListeners.signal },
    );
    const settle = () => {
      gestureListeners.abort();
      gesturingRef.current = false;
      storeFrame(liveRef.current);
      rememberFrame(liveRef.current);
    };
    grip.addEventListener("pointerup", settle, { signal: gestureListeners.signal });
    grip.addEventListener("pointercancel", settle, { signal: gestureListeners.signal });
  };

  return (
    <Block
      ref={panelRef}
      position="absolute"
      zIndex={10}
      grid
      rows="auto 1fr"
      borderRadius="sm"
      borderWidth="1px"
      borderStyle="solid"
      borderColor="border-muted"
      bg="surface-shell"
      boxShadow="0 10px 30px rgba(0, 0, 0, 0.22)"
      overflow="hidden"
      style={{ left: shown.x, top: shown.y, width: shown.width, height: shown.height }}
    >
      <Block
        grid
        cols="auto 1fr auto"
        alignItems="center"
        gap="xs"
        pl="sm"
        pr="xs"
        py="xs"
        cursor="grab"
        _active={{ cursor: "grabbing" }}
        // A drag that starts here never scrolls or selects instead.
        touchAction="none"
        userSelect="none"
        onPointerDown={(event) => startGesture(event, "move")}
      >
        <Block color="text-muted" display="grid" placeItems="center">
          <DotsSixVertical size={16} />
        </Block>
        <Text fontSize="sm" fontWeight="550" color="text-muted">
          Scout
        </Text>
        <IconButton
          type="button"
          aria-label="Add a query line"
          onPress={() => props.dispatch({ name: "added" })}
        >
          <Plus size={16} />
        </IconButton>
      </Block>
      {/* md gutters like the sheet and sidebar: the result rows' edge to
          edge highlight bleeds exactly one md and must not overshoot. */}
      <Block overflowY="auto" px="md" pb="sm">
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
      <Block
        position="absolute"
        insetInlineEnd="0"
        insetBlockEnd="0"
        w="1.75rem"
        h="1.75rem"
        cursor="nwse-resize"
        touchAction="none"
        aria-hidden="true"
        onPointerDown={(event) => startGesture(event, "size")}
        // Two short rules in the corner: the standard resize grip, drawn
        // rather than shipped as an icon because it is pure affordance.
        _before={{
          content: '""',
          position: "absolute",
          insetInlineEnd: "5px",
          insetBlockEnd: "5px",
          w: "9px",
          h: "9px",
          borderInlineEndWidth: "2px",
          borderBlockEndWidth: "2px",
          borderStyle: "solid",
          borderColor: "border-strong",
          borderStartStartRadius: "1px",
        }}
      />
    </Block>
  );
}
