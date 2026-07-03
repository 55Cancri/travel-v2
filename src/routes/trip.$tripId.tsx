import { createFileRoute } from "@tanstack/react-router";
import { Planner } from "cells/planner";
import { useMounted } from "entities/trips/store";

export const Route = createFileRoute("/trip/$tripId")({ component: TripScreen });

function TripScreen() {
  const { tripId } = Route.useParams();
  // Mount gate: the store hydrates from localStorage on the client, so we skip
  // SSR-rendering plan content to avoid a hydration mismatch.
  const mounted = useMounted();
  if (!mounted) return null;
  return <Planner tripId={tripId} />;
}
