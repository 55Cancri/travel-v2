import { fetchPlaceSpot } from "entities/place-search";
import { updatePlace } from "entities/scout-maps";

// The saved-place hours ask, fired when a place enters a map document
// still hoursless. Fire and forget; the card shows "Loading times..."
// while hours are absent and the ask is presumed out, so EVERY ending
// writes something: a schedule, or "none" (answered empty, or failed and
// not worth a stuck loading line).
export const attachGoogleHours = (mapId: string, placeId: string, googlePlaceId: string) => {
  fetchPlaceSpot(googlePlaceId, true)
    .then((spot) => {
      updatePlace(mapId, placeId, {
        hours: spot.hours ? { kind: "google", ...spot.hours } : { kind: "none" },
      });
    })
    .catch((error: unknown) => {
      console.warn("[scout] hours fetch failed:", error);
      updatePlace(mapId, placeId, { hours: { kind: "none" } });
    });
};
