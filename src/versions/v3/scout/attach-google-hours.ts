import { fetchPlaceSpot } from "entities/place-search";
import { updatePlace } from "entities/scout-maps";

// The one moment hours are worth a call on the priciest tier: a place
// entering a map document. Fire and forget; the card simply gains its
// hours line when the answer lands, and a miss only means the card stays
// hoursless (the place itself is already saved).
export const attachGoogleHours = (mapId: string, placeId: string, googlePlaceId: string) => {
  fetchPlaceSpot(googlePlaceId, true)
    .then((spot) => {
      if (spot.hours) updatePlace(mapId, placeId, { hours: { kind: "google", ...spot.hours } });
    })
    .catch((error: unknown) => {
      console.warn("[scout] hours fetch failed:", error);
    });
};
