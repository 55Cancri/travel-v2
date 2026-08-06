import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Block } from "atoms";

// The bottom sheet every scout drawer rides in: backdrop, spring up from
// the bottom edge, drag the handle down (or tap the backdrop, or press
// Escape) to dismiss. One primitive so search, place, edge, and maps all
// move identically.

const CLOSE_DRAG_PX = 90;
const CLOSE_VELOCITY = 500;

export function Sheet(props: {
  open: boolean;
  onClose: () => void;
  label: string;
  // How much of the screen the sheet claims. "tall" is a FIXED height:
  // the search sheet must stand at full size before any results exist
  // and hold still while they stream in, never resize under a thumb.
  // "half" hugs its content up to a ceiling, for the small editors.
  size?: "half" | "tall";
  children: React.ReactNode;
}) {
  const onCloseRef = React.useRef(props.onClose);
  onCloseRef.current = props.onClose;

  React.useEffect(() => {
    if (!props.open) return;
    const controller = new AbortController();
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") onCloseRef.current();
      },
      { signal: controller.signal },
    );
    return () => controller.abort();
  }, [props.open]);

  return (
    <AnimatePresence>
      {props.open ? (
        <Block position="fixed" inset="0" zIndex={30}>
          <Block
            position="absolute"
            inset="0"
            onClick={props.onClose}
            style={{ background: "rgba(20, 16, 12, 0.4)" }}
            _motion={{
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              exit: { opacity: 0 },
              transition: { duration: 0.2 },
            }}
          />
          <Block
            role="dialog"
            aria-modal="true"
            aria-label={props.label}
            position="absolute"
            insetInline="0"
            insetBlockEnd="0"
            h={props.size === "half" ? "auto" : "85dvh"}
            maxH={props.size === "half" ? "55dvh" : "85dvh"}
            grid
            rows="auto 1fr"
            bg="surface-shell"
            borderTopRadius="md"
            boxShadow="0 -8px 30px rgba(0, 0, 0, 0.25)"
            _motion={{
              initial: { y: "100%" },
              animate: { y: 0 },
              exit: { y: "100%" },
              transition: { type: "spring", stiffness: 420, damping: 40 },
              drag: "y",
              dragConstraints: { top: 0, bottom: 0 },
              dragElastic: { top: 0, bottom: 0.6 },
              onDragEnd: (_event, info) => {
                if (info.offset.y > CLOSE_DRAG_PX || info.velocity.y > CLOSE_VELOCITY) {
                  onCloseRef.current();
                }
              },
            }}
          >
            {/* The grab handle: the sheet's one drag affordance, with real
                clearance from the top edge so a thumb finds it. */}
            <Block grid placeItems="center" pt="sm" pb="xs" cursor="grab" touchAction="none">
              <Block
                w="2.5rem"
                h="0.3rem"
                borderRadius="9999px"
                bg="border-strong"
                aria-hidden="true"
              />
            </Block>
            <Block overflowY="auto" px="md" pb="md" style={{ overscrollBehavior: "contain" }}>
              {props.children}
            </Block>
          </Block>
        </Block>
      ) : null}
    </AnimatePresence>
  );
}
