// Ambient map overlays: what they are (catalog), where the points come
// from (Overpass), the bus network and its live boards (Overpass +
// Transitous), and the floating toggles. The Overpass client and the
// opening_hours grammar they lean on live in `entities/osm`.

export { OVERLAYS, overlayTraits, type OverlayKind, type OverlayTraits } from "./catalog";
export { OverlayChips } from "./chips";
export { fetchBusNetwork, type BusRoute } from "./fetch-bus-network";
export {
  fetchOverlayPlaces,
  type OverlayPlace,
  type ViewBounds,
} from "./fetch-places";
export {
  fetchBusStops,
  fetchStopBoard,
  type BoardEntry,
  type BusStopPoint,
} from "./fetch-stop-board";
export { curatePicks, suggestPicks } from "./suggest";
