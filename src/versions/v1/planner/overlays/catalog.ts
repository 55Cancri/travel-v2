// The map's ambient overlays: things a traveler scouts for around the
// plan. Food overlays classify by OSM diet tags, luggage means staffed
// left-luggage and locker points (not self-storage warehouses), bikes are
// rental locations, and buses draws the area's whole bus network. Any set
// of overlays can be on at once.

export type OverlayKind = "vegan" | "luggage" | "bikes" | "picks" | "sights" | "buses";

export type OverlayTraits = {
  kind: OverlayKind;
  label: string;
  color: string;
  // Overlays load per viewport. Below this zoom the bounding box grows
  // past what the source API's fair-use budget (and the reader's eye)
  // can take, so the chip asks for a closer view instead of fetching.
  minZoom: number;
};

// Order is meaningful twice over: it is the chip order, and when one
// place qualifies for several overlays the earliest enabled kind claims
// it (so Suggested outranks Sights).
export const OVERLAYS: OverlayTraits[] = [
  { kind: "vegan", label: "Vegan", color: "#16A34A", minZoom: 12 },
  { kind: "luggage", label: "Luggage", color: "#8B5CF6", minZoom: 11 },
  { kind: "bikes", label: "Bikes", color: "#0EA5E9", minZoom: 12 },
  { kind: "picks", label: "Suggested", color: "#E11D48", minZoom: 13 },
  { kind: "sights", label: "Sights", color: "#0D9488", minZoom: 13 },
  { kind: "buses", label: "Buses", color: "#F59E0B", minZoom: 11 },
];

export const overlayTraits = (kind: OverlayKind) =>
  OVERLAYS.find((entry) => entry.kind === kind) ?? OVERLAYS[0];
