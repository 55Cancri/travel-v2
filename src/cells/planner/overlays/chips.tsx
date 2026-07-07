// The overlay toggles, floated on the map: one pill per overlay with its
// color dot, name, and a live hint (count, loading, or a zoom-in nudge).
// Any combination can be on at once.

import { Block, Button, Text } from "atoms";
import { OVERLAYS, type OverlayKind } from "./catalog";

type Props = {
  active: OverlayKind[];
  hints: Partial<Record<OverlayKind, string>>;
  onToggle: (kind: OverlayKind) => void;
};

export function OverlayChips(props: Props) {
  return (
    <Block grid gap="0.25rem" justifyItems="start">
      {OVERLAYS.map((overlay) => {
        const on = props.active.includes(overlay.kind);
        const hint = props.hints[overlay.kind];
        return (
          <Button
            key={overlay.kind}
            type="button"
            onPress={() => props.onToggle(overlay.kind)}
            px="sm"
            py="0.12lh"
            gap="0.35rem"
            borderRadius="9999px"
            fontSize="xs"
            fontWeight={550}
            boxShadow="0 2px 10px rgba(0, 0, 0, 0.25)"
            bg={on ? "surface-strong" : "surface-panel"}
            color={on ? "text-on-strong" : "text-muted"}
            _hover={{
              "@media (hover: hover)": {
                bg: on ? "surface-strong" : "surface-panel",
                color: on ? "text-on-strong" : "text-body",
              },
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "9999px",
                background: overlay.color,
                opacity: on ? 1 : 0.55,
              }}
            />
            {overlay.label}
            {on && hint ? (
              <Text as="span" fontSize="xs" color="inherit" opacity={0.6}>
                {hint}
              </Text>
            ) : null}
          </Button>
        );
      })}
    </Block>
  );
}
