import * as React from "react";

// Every UI generation the app can render, oldest first. Each version is a
// self-contained folder (vN/) owning its screens; the shelf and planner
// routes render whichever entry the choice store points at. Adding a
// generation: copy the newest vN folder (or start bare), evolve it
// freely, append its entry here. Screens load lazily so dormant
// generations never weigh down the active one's bundle.
export type UiVersion = {
  id: string;
  label: string;
  // A generation still being built: the picker reaches it, but a device
  // with no stored choice never lands on it. Drop the flag to ship it.
  draft?: boolean;
  TripsShelf: React.ComponentType;
  Planner: React.ComponentType<{ tripId: string }>;
};

export const UI_VERSIONS: UiVersion[] = [
  {
    id: "v1",
    label: "Outline + map",
    TripsShelf: React.lazy(() =>
      import("./v1/trips-shelf").then((m) => ({ default: m.TripsShelf })),
    ),
    Planner: React.lazy(() => import("./v1/planner").then((m) => ({ default: m.Planner }))),
  },
  {
    id: "v2",
    label: "Blank canvas",
    draft: true,
    TripsShelf: React.lazy(() =>
      import("./v2/trips-shelf").then((m) => ({ default: m.TripsShelf })),
    ),
    Planner: React.lazy(() => import("./v2/planner").then((m) => ({ default: m.Planner }))),
  },
];

// What a fresh device (or a retired stored id) resolves to: the newest
// generation that actually shipped.
export const latestUiVersion =
  UI_VERSIONS.findLast((entry) => !entry.draft) ?? (UI_VERSIONS.at(-1) as UiVersion);
