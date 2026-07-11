import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMounted } from "entities/trips/store";
import { UiVersionRescue, useUiVersion } from "versions";

export const Route = createFileRoute("/")({ component: TripsScreen });

function TripsScreen() {
  // Mount gate: the store hydrates from localStorage on the client, so we skip
  // SSR-rendering trip content to avoid a hydration mismatch.
  const mounted = useMounted();
  const ui = useUiVersion();
  if (!mounted) return null;
  // Keyed by generation so flipping away from a crashed one clears the
  // rescue screen along with the crash it caught.
  return (
    <UiVersionRescue key={ui.id}>
      <React.Suspense fallback={null}>
        <ui.TripsShelf />
      </React.Suspense>
    </UiVersionRescue>
  );
}
