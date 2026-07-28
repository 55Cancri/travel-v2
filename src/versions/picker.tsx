import * as React from "react";
import { Block, Button, Text } from "atoms";
import { GhostButton } from "alloys";
import { UI_VERSIONS } from "./catalog";
import { chooseUiVersion, useUiVersion } from "./choice";

// Names the UI generation on screen and opens the full list on press. Every
// generation's trip shelf renders this, so a device can always climb out of
// a broken generation. The menu is placed by its relative wrapper rather
// than by CSS anchor positioning, which browsers have not caught up on.
export function UiVersionPicker() {
  const active = useUiVersion();
  const [isOpen, storeOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  // One controller for both dismissals, so closing (or unmounting) drops
  // the pair together.
  React.useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (!rootRef.current?.contains(event.target as Node)) storeOpen(false);
      },
      { signal: controller.signal },
    );
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") storeOpen(false);
      },
      { signal: controller.signal },
    );
    return () => controller.abort();
  }, [isOpen]);

  return (
    <Block ref={rootRef} position="relative">
      <GhostButton
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onPress={() => storeOpen((wasOpen) => !wasOpen)}
        px="sm"
        title={`UI generation: ${active.label}`}
      >
        UI {active.id}
      </GhostButton>
      {isOpen ? (
        <Block
          role="menu"
          position="absolute"
          insetInlineEnd="0"
          top="calc(100% + 0.25lh)"
          zIndex={30}
          minW="13rem"
          p="xs"
          borderRadius="sm"
          borderWidth="1px"
          borderStyle="solid"
          borderColor="border-muted"
          bg="surface-panel"
          boxShadow="0 8px 24px rgba(0, 0, 0, 0.18)"
        >
          {UI_VERSIONS.map((entry) => (
            <Button
              key={entry.id}
              type="button"
              role="menuitemradio"
              aria-checked={entry.id === active.id}
              onPress={() => {
                chooseUiVersion(entry.id);
                storeOpen(false);
              }}
              grid
              cols="1fr auto"
              alignItems="center"
              gap="sm"
              w="100%"
              minH="xl"
              px="sm"
              borderRadius="xs"
              textAlign="start"
              fontSize="sm"
              fontWeight="550"
              color={entry.id === active.id ? "text-primary" : "text-muted"}
              bg={entry.id === active.id ? "surface-selected" : "transparent"}
              _hover={{ "@media (hover: hover)": { bg: "surface-hover" } }}
              _pressed={{ bg: "surface-focus" }}
            >
              {entry.label}
              <Text fontSize="xs" fontWeight="450" color="text-muted">
                {entry.draft ? `${entry.id} · draft` : entry.id}
              </Text>
            </Button>
          ))}
        </Block>
      ) : null}
    </Block>
  );
}
