import * as React from "react";

// Whether the window is wide enough for the floating query panel (the
// same 768px line as the style system's md breakpoint). A HOOK rather
// than a display:none wrapper because the panel's query lines own live
// search effects: a CSS-hidden panel still mounts them, and on a phone
// that ran every search twice behind the drawer's back.

const WIDE_QUERY = "(min-width: 768px)";

const subscribe = (onChange: () => void) => {
  const watcher = window.matchMedia(WIDE_QUERY);
  watcher.addEventListener("change", onChange);
  return () => watcher.removeEventListener("change", onChange);
};

const isWide = () => window.matchMedia(WIDE_QUERY).matches;

export function useWideWindow() {
  // The server guesses wide; a phone corrects itself on hydration.
  return React.useSyncExternalStore(subscribe, isWide, () => true);
}
