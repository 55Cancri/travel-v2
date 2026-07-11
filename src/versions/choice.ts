import * as React from "react";
import { UI_VERSIONS, latestUiVersion } from "./catalog";

// Which UI generation this device renders. A per-device preference, so it
// lives in localStorage (never in trip data): the owner compares
// generations by flipping one device while another stays put.
export const UI_VERSION_KEY = "travel2:ui-version";

const watchers = new Set<() => void>();
let chosenId: string | null = null;

const storedId = () => {
  try {
    return localStorage.getItem(UI_VERSION_KEY);
  } catch {
    // Storage can be sealed (Safari lockdown/private mode throws even on
    // reads). No stored choice is the same as a fresh device: latest.
    return null;
  }
};

const subscribe = (onFlip: () => void) => {
  watchers.add(onFlip);
  return () => watchers.delete(onFlip);
};

const activeId = () => chosenId ?? storedId() ?? latestUiVersion.id;

export const chooseUiVersion = (id: string) => {
  chosenId = id;
  try {
    localStorage.setItem(UI_VERSION_KEY, id);
  } catch {
    // Sealed storage again: the flip still applies for this session,
    // only reload persistence is lost.
  }
  for (const onFlip of watchers) onFlip();
};

// A stored id that no longer exists in the catalog (a retired
// generation) resolves to the latest one.
export function useUiVersion() {
  const id = React.useSyncExternalStore(subscribe, activeId, () => latestUiVersion.id);
  return UI_VERSIONS.find((entry) => entry.id === id) ?? latestUiVersion;
}
