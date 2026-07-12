import { GhostButton } from "alloys";
import { UI_VERSIONS } from "./catalog";
import { chooseUiVersion, useUiVersion } from "./choice";

// Names the UI generation on screen and cycles to the next one on press.
// Cycling scales to the two or three living generations this app keeps;
// a menu earns its place only if the catalog ever grows past that. Every
// generation's trip shelf renders this, so a device can always climb out
// of a broken generation.
export function UiVersionPicker() {
  const active = useUiVersion();
  const flip = () => {
    const at = UI_VERSIONS.findIndex((entry) => entry.id === active.id);
    const next = UI_VERSIONS[(at + 1) % UI_VERSIONS.length];
    chooseUiVersion(next.id);
  };
  return (
    <GhostButton type="button" onPress={flip} px="sm" title={`UI generation: ${active.label}`}>
      UI {active.id}
    </GhostButton>
  );
}
