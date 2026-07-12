import * as React from "react";
import { Block, CaretLeft, CaretRight } from "atoms";
import { GhostButton } from "alloys";

type Props = {
  onOutdent: () => void;
  onIndent: () => void;
};

// The editing controls that ride above the mobile keyboard. Fixed to the
// bottom of the LAYOUT viewport, then lifted by however much the keyboard
// shrinks the VISUAL viewport (Android Chrome keeps fixed elements under
// the keyboard by default). Buttons preserve focus so pressing them never
// closes the keyboard.
export function EditBar(props: Props) {
  const [lift, setLift] = React.useState(0);
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const abort = new AbortController();
    const track = () => setLift(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    track();
    vv.addEventListener("resize", track, { signal: abort.signal });
    vv.addEventListener("scroll", track, { signal: abort.signal });
    return () => abort.abort();
  }, []);
  return (
    <Block
      position="fixed"
      bottom="0"
      left="0"
      right="0"
      grid
      gridAutoFlow="column"
      justifyContent="start"
      gap="xs"
      px="md"
      py="xs"
      bg="surface-panel"
      borderTopWidth="1px"
      borderTopStyle="solid"
      borderTopColor="border-muted"
      boxShadow="0 -1px 8px rgba(28, 25, 23, 0.06)"
      style={{ transform: `translateY(-${lift}px)` }}
    >
      {/* py="sm" lifts these to fingertip height: they are the primary
          controls while the phone keyboard is up. */}
      <GhostButton
        type="button"
        preservesFocus
        onPress={props.onOutdent}
        py="sm"
        start={<CaretLeft />}
      >
        Outdent
      </GhostButton>
      <GhostButton type="button" preservesFocus onPress={props.onIndent} py="sm" end={<CaretRight />}>
        Indent
      </GhostButton>
    </Block>
  );
}
