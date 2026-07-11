import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMounted } from "entities/trips/store";
import { useUiVersion } from "versions";

export const Route = createFileRoute("/trip/$tripId")({ component: TripScreen });

function TripScreen() {
  const { tripId } = Route.useParams();
  // Mount gate: the store hydrates from localStorage on the client, so we skip
  // SSR-rendering plan content to avoid a hydration mismatch.
  const mounted = useMounted();
  const ui = useUiVersion();
  if (!mounted) return null;
  return (
    <React.Suspense fallback={null}>
      <ui.Planner tripId={tripId} />
    </React.Suspense>
  );
}
