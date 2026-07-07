import * as React from "react";
import type { Feature } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { Block, Button, CaretLeft, CaretRight, Text, X } from "atoms";
import { Cluster, IconButton } from "alloys";
import tzLookup from "tz-lookup";
import { KIND_META, type Item, type ItemKind, type RouteVia } from "entities/trips/types";
import { addRouteVia, moveRouteVia, removeRouteVia } from "entities/trips/store";
import {
  fetchRoadRoute,
  legAt,
  nearestPointOnLine,
  planDayRoute,
  type DayRoutePart,
} from "./route-plan";
import {
  curatePicks,
  fetchBusNetwork,
  fetchBusStops,
  fetchOverlayPlaces,
  fetchStopBoard,
  formatHours,
  isOpenAt,
  OverlayChips,
  OVERLAYS,
  overlayTraits,
  parseOpeningHours,
  suggestPicks,
  type BusRoute,
  type BusStopPoint,
  type OverlayKind,
  type OverlayPlace,
  type ViewBounds,
} from "./overlays";

// The map is a projection of the plan. Camera moves are deliberate: it refits
// ONLY when the scope changes (scopeKey), never because an item was edited or
// toggled (that was the "dots wiggle / zoom out on click" bug). Hovering a
// pin shows its tooltip; clicking highlights the row and gently recenters on
// the pin without changing zoom; ⌘-click zooms to street level. Far jumps
// (city to city) cut straight there instead of animating, so tiles start
// loading sooner. The style follows <html data-theme>.

const LIGHT_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

// Our own dark map theme. OpenFreeMap's "dark" is pure grayscale (asleep) and
// "fiord" is aggressively blue, so we take dark's layer structure and repaint
// it: warm near-black base matching the app's stone palette, night-teal water,
// dark-green parks, amber-cast motorways, and brighter warm labels for
// contrast. Paint overrides are keyed by layer id (checked against the style).
const DARK_PAINT: Record<string, Record<string, string>> = {
  background: { "background-color": "#171512" },
  landuse_residential: { "fill-color": "#1D1A16" },
  landcover_wood: { "fill-color": "#1F2B1C" },
  landuse_park: { "fill-color": "#223020" },
  water: { "fill-color": "#1D3038" },
  waterway: { "line-color": "#1D3038" },
  water_name: { "text-color": "#527884", "text-halo-color": "rgba(0,0,0,0.7)" },
  building: { "fill-color": "#211E1A", "fill-outline-color": "#2A2622" },
  "aeroway-taxiway": { "line-color": "#22201C" },
  "aeroway-runway-casing": { "line-color": "rgba(70,62,54,0.8)" },
  "aeroway-area": { "fill-color": "#1A1815" },
  "aeroway-runway": { "line-color": "#1A1815" },
  highway_path: { "line-color": "#2A2724" },
  highway_minor: { "line-color": "#2B2723" },
  highway_major_casing: { "line-color": "rgba(70,62,54,0.8)" },
  highway_major_inner: { "line-color": "#38332C" },
  highway_major_subtle: { "line-color": "#332E28" },
  highway_motorway_casing: { "line-color": "rgba(92,76,55,0.8)" },
  highway_motorway_inner: { "line-color": "#4A3E2D" },
  highway_motorway_subtle: { "line-color": "#2E2A24" },
  railway_transit: { "line-color": "#35302A" },
  railway_minor: { "line-color": "#35302A" },
  railway: { "line-color": "#35302A" },
  highway_name_other: { "text-color": "#6B6258", "text-halo-color": "rgba(0,0,0,0.9)" },
  highway_name_motorway: { "text-color": "#7D7367" },
  boundary_state: { "line-color": "#3A352F" },
  "boundary_country_z0-4": { "line-color": "#3A352F" },
  "boundary_country_z5-": { "line-color": "#3A352F" },
  place_other: { "text-color": "#8F857A" },
  place_suburb: { "text-color": "#8F857A" },
  place_village: { "text-color": "#8F857A" },
  place_town: { "text-color": "#A89F94" },
  place_city: { "text-color": "#A89F94" },
  place_city_large: { "text-color": "#C2B8AB" },
  place_state: { "text-color": "#8F857A" },
  place_country_other: { "text-color": "#A89F94" },
  place_country_minor: { "text-color": "#A89F94" },
  place_country_major: { "text-color": "#C2B8AB" },
};

type StyleJson = { layers: Array<{ id: string; paint?: Record<string, unknown> }> };
let darkStylePromise: Promise<StyleJson> | null = null;
const loadDarkStyle = () => {
  darkStylePromise ??= fetch(DARK_STYLE_URL)
    .then((res) => res.json() as Promise<StyleJson>)
    .then((style) => ({
      ...style,
      layers: style.layers.map((layer) =>
        DARK_PAINT[layer.id]
          ? { ...layer, paint: { ...layer.paint, ...DARK_PAINT[layer.id] } }
          : layer,
      ),
    }));
  return darkStylePromise;
};

export type MapApi = {
  // Fly to an item's place and open its popup (name + address) on arrival.
  focusItem: (itemId: string, place: { lng: number; lat: number }, zoom?: number) => void;
};

type Pin = { item: Item; lng: number; lat: number };
type MarkerEntry = {
  marker: import("maplibre-gl").Marker;
  el: HTMLDivElement;
  // Refreshed on every pin update so hover handlers read current content.
  item: Item;
};

// The marker element is a two-layer sandwich: maplibre positions the OUTER
// wrapper with an inline transform every frame, so the wrapper must never
// carry a transform transition (one there makes every pin trail the camera
// by the transition duration). The inner dot owns the hover pop and the
// opacity fade, and the wrapper doubles as a finger-friendly hit area
// larger than the visible dot.
//
// The wrapper is SHARED with maplibre: it owns the inline transform and its
// own classes on this same element. Styling here must therefore be additive
// (classList.add, individual style properties), never a className or
// cssText assignment. An assignment wipes the positioning transform and the
// maplibregl-marker class, and every pin sits stacked at the container
// origin until the next camera move re-places it. The inner dot is entirely
// ours, so cssText is fine there.
const stylePinElement = (el: HTMLDivElement, item: Item) => {
  const dim = item.status === "done";
  el.classList.add("travel-pin");
  el.style.width = "22px";
  el.style.height = "22px";
  el.style.display = "grid";
  el.style.placeItems = "center";
  el.style.cursor = "pointer";
  el.title = item.place?.name ?? item.text;
  let dot = el.firstElementChild as HTMLSpanElement | null;
  if (!dot) {
    dot = document.createElement("span");
    dot.className = "travel-pin-dot";
    el.appendChild(dot);
  }
  dot.style.cssText = `width:13px;height:13px;border-radius:50%;background:var(${KIND_META[item.kind].cssVar});box-shadow:var(--pin-dot-shadow);opacity:${dim ? 0.45 : 1};`;
};

// Via markers mirror the pin wrapper/inner split: the wrapper is the real
// hit target (clip-path clips hit-testing, so a bare diamond is nearly
// unclickable and near-misses fall through to the route hit layer), the
// inner diamond is the visual.
const viaElement = () => {
  const el = document.createElement("div");
  el.classList.add("travel-via");
  // Focusable so selecting it can move focus off whatever had it. Maplibre
  // prevents mousedown defaults over the map, so a click never blurs a
  // focused row textarea on its own, and the Delete/Backspace listener
  // (rightly) refuses to remove pins while a text field has focus.
  el.tabIndex = -1;
  el.setAttribute("role", "button");
  const diamond = document.createElement("div");
  diamond.classList.add("travel-via-diamond");
  el.appendChild(diamond);
  return el;
};

const lineFeature = (
  coordinates: number[][],
  properties: {
    kind: string;
    chain: number;
    leg: number;
    color?: string;
    name?: string;
    vehicle?: string;
    headsign?: string;
    times?: string;
    next?: string;
    live?: boolean;
  },
): Feature => ({
  type: "Feature",
  properties,
  geometry: { type: "LineString", coordinates },
});

const pointFeature = (
  coordinates: number[],
  properties: {
    kind: string;
    chain: number;
    leg: number;
    color: string;
    name: string;
    time?: string;
  },
): Feature => ({
  type: "Feature",
  properties,
  geometry: { type: "Point", coordinates },
});

// Wire instants render as the stop's own wall clock.
const clockTime = (iso: string, tz: string) =>
  Temporal.Instant.from(iso)
    .toZonedDateTimeISO(tz)
    .toPlainTime()
    .toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });

// A solid arrow reads at tooltip size where the → glyph looks spindly.
const ARROW_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px;margin-right:4px"><path d="M4 11h12.17l-5.58-5.59L12 4l8 8-8 8-1.41-1.41L16.17 13H4z"/></svg>`;

// Route widths scale with zoom: streets grow 4x per two zoom levels while
// a fixed-width line stays hairline-thin, so a route that reads fine at
// city scale visually vanishes zoomed to a doorstep. The dash pattern is
// in line-width units, so the ants scale along automatically.
const zoomWidth = (base: number, high: number) =>
  [
    "interpolate",
    ["exponential", 1.6],
    ["zoom"],
    15,
    base,
    20,
    high,
  ] as unknown as number;

// The editable walking chains in draw order; a rendered feature's `chain`
// property indexes into this list.
const walkChains = (parts: DayRoutePart[]) =>
  parts.filter((part): part is Extract<DayRoutePart, { kind: "chain" }> => part.kind === "chain");

// Transit brand colours assume a white timetable; the bright ones (yellows,
// limes) wash out on the pale map canvas. In light mode, cap the colour's
// lightness so every line keeps contrast; the dark canvas takes brand
// colours as-is.
const groundedLineColor = (hex: string | undefined, dark: boolean) => {
  if (!hex || dark) return hex;
  const match = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return hex;
  const digits =
    match[1].length === 3
      ? Array.from(match[1], (ch) => ch + ch).join("")
      : match[1];
  const value = parseInt(digits, 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  if (light <= 0.42) return hex.startsWith("#") ? hex : `#${digits}`;
  const delta = max - min;
  const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
  const hue =
    delta === 0
      ? 0
      : max === r
        ? (((g - b) / delta) % 6) * 60
        : max === g
          ? ((b - r) / delta + 2) * 60
          : ((r - g) / delta + 4) * 60;
  const capped = 0.42;
  const chroma = (1 - Math.abs(2 * capped - 1)) * sat;
  const second = chroma * (1 - Math.abs(((((hue + 360) % 360) / 60) % 2) - 1));
  const base = capped - chroma / 2;
  const sector = Math.floor(((hue + 360) % 360) / 60);
  const [cr, cg, cb] = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ][sector % 6];
  const channel = (part: number) =>
    Math.round((part + base) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(cr)}${channel(cg)}${channel(cb)}`;
};

const lineBounds = (lines: number[][][]) => {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const line of lines) {
    for (const [lng, lat] of line) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
  }
  if (minLng > maxLng) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ] as [[number, number], [number, number]];
};

const fitToLines = (map: import("maplibre-gl").Map, lines: number[][][]) => {
  const bounds = lineBounds(lines);
  if (!bounds) return;
  map.fitBounds(bounds, { padding: 80, duration: 550, maxZoom: 16.5 });
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// Overlay data is fetched for a view padded past the screen, so small pans
// re-render from cache; a refetch happens only when the visible view exits
// the covered one.
const paddedView = (map: import("maplibre-gl").Map): ViewBounds => {
  const bounds = map.getBounds();
  const latPad = (bounds.getNorth() - bounds.getSouth()) * 0.25;
  const lngPad = (bounds.getEast() - bounds.getWest()) * 0.25;
  return {
    south: bounds.getSouth() - latPad,
    west: bounds.getWest() - lngPad,
    north: bounds.getNorth() + latPad,
    east: bounds.getEast() + lngPad,
  };
};

const visibleView = (map: import("maplibre-gl").Map): ViewBounds => {
  const bounds = map.getBounds();
  return {
    south: bounds.getSouth(),
    west: bounds.getWest(),
    north: bounds.getNorth(),
    east: bounds.getEast(),
  };
};

const containsView = (outer: ViewBounds, inner: ViewBounds) =>
  outer.south <= inner.south &&
  outer.west <= inner.west &&
  outer.north >= inner.north &&
  outer.east >= inner.east;

// A red no-entry badge (ring plus slash) drawn once onto a canvas; place
// features whose hours say "closed at the relevant time" wear it over
// their dot.
const closedBadgeImage = () => {
  const size = 30;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new ImageData(size, size);
  ctx.strokeStyle = "#DC2626";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  const mid = size / 2;
  const radius = mid - 3;
  ctx.beginPath();
  ctx.arc(mid, mid, radius, 0, Math.PI * 2);
  ctx.stroke();
  const reach = radius / Math.SQRT2;
  ctx.beginPath();
  ctx.moveTo(mid - reach, mid - reach);
  ctx.lineTo(mid + reach, mid + reach);
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
};

// Item times are free text ("10:30a", "4p", "4–5:30p"); the first
// hour[:minutes] plus meridiem run is the start, in minutes from
// midnight. Null when nothing parses.
const parseItemTime = (value: string | undefined) => {
  const match = value?.match(/(\d{1,2})(?::(\d{2}))?\s*(a|p)/i);
  if (!match) return null;
  const hour = (Number(match[1]) % 12) + (match[3].toLowerCase() === "p" ? 12 : 0);
  return hour * 60 + Number(match[2] ?? 0);
};

// Overlay sources and layers, recreated after every style swap. They slot
// under the day-route layers when those exist: the plan outranks ambient
// context. Bus stops only render at street zoom, where a departure board
// is a meaningful hover target.
const ensureOverlayLayers = (map: import("maplibre-gl").Map) => {
  if (!map.hasImage("overlay-closed-badge")) {
    map.addImage("overlay-closed-badge", closedBadgeImage(), { pixelRatio: 2 });
  }
  if (map.getSource("overlay-places")) return;
  const empty = { type: "FeatureCollection" as const, features: [] };
  const beforeId = map.getLayer("day-route-ride") ? "day-route-ride" : undefined;
  map.addSource("bus-network", { type: "geojson", data: empty, maxzoom: 24 });
  map.addSource("bus-stops", { type: "geojson", data: empty, maxzoom: 24 });
  map.addSource("overlay-places", { type: "geojson", data: empty, maxzoom: 24 });
  // Zoom floors on the visible layers keep cached data from another city
  // from littering a country-level view while its chip says "zoom in".
  map.addLayer(
    {
      id: "bus-network-line",
      type: "line",
      source: "bus-network",
      minzoom: 10,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["coalesce", ["get", "color"], "#D97706"] as unknown as string,
        "line-width": zoomWidth(1.6, 7),
        "line-opacity": 0.5,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "bus-network-hit",
      type: "line",
      source: "bus-network",
      minzoom: 10,
      // 0.001, not 0: maplibre culls fully transparent lines from
      // rendering, and culled geometry is unhoverable.
      paint: { "line-width": zoomWidth(12, 26), "line-opacity": 0.001 },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "bus-stops-dot",
      type: "circle",
      source: "bus-stops",
      minzoom: 13,
      paint: {
        "circle-radius": zoomWidth(3, 7),
        "circle-color": "#D97706",
        "circle-stroke-color": "#FFFFFF",
        "circle-stroke-width": 1.25,
        "circle-opacity": 0.9,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "bus-stops-hit",
      type: "circle",
      source: "bus-stops",
      minzoom: 13,
      paint: { "circle-radius": zoomWidth(9, 18), "circle-opacity": 0.001 },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "overlay-places-dot",
      type: "circle",
      source: "overlay-places",
      minzoom: 10,
      paint: {
        "circle-radius": zoomWidth(5, 10),
        "circle-color": ["get", "color"] as unknown as string,
        "circle-stroke-color": "#FFFFFF",
        "circle-stroke-width": 1.5,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "overlay-places-closed",
      type: "symbol",
      source: "overlay-places",
      minzoom: 10,
      filter: ["==", ["get", "closed"], true],
      layout: {
        "icon-image": "overlay-closed-badge",
        "icon-size": zoomWidth(0.9, 1.8),
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "overlay-places-hit",
      type: "circle",
      source: "overlay-places",
      minzoom: 10,
      paint: { "circle-radius": zoomWidth(12, 22), "circle-opacity": 0.001 },
    },
    beforeId,
  );
};

// The pinned place card: what the hover tooltip grows into on click. Real
// DOM (not an HTML string) so the links and the add button carry
// listeners. Colors are literal because the popup skin is the same
// inverted dark surface in both themes.
const placeCard = (place: Record<string, unknown>, onAdd: (() => void) | null) => {
  const root = document.createElement("div");
  // The popup lives outside Panda, so the app's lh rhythm tokens don't
  // reach it; spacing rides a 4px sub-grid instead, consistently.
  root.style.cssText = "display:grid;gap:4px;min-width:190px;max-width:260px";
  const line = (text: string, style: string) => {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = style;
    root.appendChild(el);
  };
  if (place.label) line(String(place.label), "font-size:0.8em;color:var(--tooltip-faint)");
  line(String(place.name ?? ""), "font-weight:600;font-size:1.05em");
  if (place.closed === true) {
    line("Closed at this time", "color:#F87171;font-size:0.85em;font-weight:550");
  } else if (place.open === true) {
    line("Open", "color:#4ADE80;font-size:0.85em;font-weight:550");
  }
  if (place.hoursDisplay) line(String(place.hoursDisplay), "font-size:0.85em;color:var(--tooltip-subtext)");
  for (const note of String(place.notes ?? "")
    .split("\n")
    .filter(Boolean)) {
    line(note, "font-size:0.85em;color:var(--tooltip-subtext)");
  }
  if (place.address) line(String(place.address), "font-size:0.85em;color:var(--tooltip-subtext)");
  const links = document.createElement("div");
  links.style.cssText = "display:flex;gap:10px;margin-top:4px;flex-wrap:wrap";
  const link = (label: string, href: string) => {
    const anchor = document.createElement("a");
    anchor.textContent = label;
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.style.cssText = "color:#7DB3E8;font-size:0.85em;text-decoration:underline";
    links.appendChild(anchor);
  };
  if (place.website) link("Website", String(place.website));
  if (place.menu) link("Menu", String(place.menu));
  if (place.phone) link(String(place.phone), `tel:${String(place.phone).replace(/\s+/g, "")}`);
  if (links.childElementCount) root.appendChild(links);
  if (onAdd) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Add to plan";
    button.style.cssText =
      "margin-top:8px;width:100%;padding:5px 10px;border-radius:9999px;border:none;" +
      "background:var(--colors-accent);color:#FFFFFF;" +
      "font-size:0.85em;font-weight:550;cursor:pointer";
    button.addEventListener("click", () => {
      onAdd();
      button.textContent = "Added ✓";
      button.disabled = true;
      button.style.opacity = "0.7";
      button.style.cursor = "default";
    });
    root.appendChild(button);
  }
  return root;
};

const popupHtml = (item: Item) => {
  const name = escapeHtml(item.place?.name ?? item.text);
  const address = item.place?.address ? escapeHtml(item.place.address) : "";
  return `<div style="font-weight:600">${name}</div>${
    address
      ? `<div style="font-size:0.85em;color:var(--tooltip-subtext);margin-top:2px">${address}</div>`
      : ""
  }`;
};

export function MapPane(props: {
  items: Item[];
  routeItemIds: string[] | null;
  routeDayId: string | null;
  // The day's ISO date: transit rides are planned against its schedules.
  routeDate: string | null;
  routeVias: RouteVia[] | null;
  paneResizing: boolean;
  scopeKey: string;
  // The leg being stepped through (null = step mode off). The planner owns
  // it so the list can follow along.
  stepLeg: number | null;
  onStep: (leg: number | null) => void;
  onPinClick: (itemId: string, zoom: boolean) => void;
  // A pinned place card's "Add to plan": the planner owns where it lands
  // (the segment's idea pool).
  onAddPlace: (place: { name: string; lng: number; lat: number; address?: string }, kind: ItemKind) => void;
  apiRef: React.RefObject<MapApi | null>;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = React.useRef(new Map<string, MarkerEntry>());
  // One popup for the whole map, opened on pin hover (and on focusItem).
  // A single instance means tooltips can never pile up.
  const popupRef = React.useRef<import("maplibre-gl").Popup | null>(null);
  const libRef = React.useRef<typeof import("maplibre-gl") | null>(null);
  const [ready, storeReady] = React.useState(false);
  // Routing failures surface here instead of dying in the console: the pane
  // wears a chip naming why the line is straight.
  const [routeNotice, storeRouteNotice] = React.useState<string | null>(null);
  const [styleTick, storeStyleTick] = React.useState(0);
  const onPinClickRef = React.useRef(props.onPinClick);
  onPinClickRef.current = props.onPinClick;
  const onAddPlaceRef = React.useRef(props.onAddPlace);
  onAddPlaceRef.current = props.onAddPlace;
  const paneResizingRef = React.useRef(props.paneResizing);
  paneResizingRef.current = props.paneResizing;

  // One clean canvas resize when the divider settles; the observer skips
  // frames while the drag is live (the canvas stretches with the pane,
  // stable, instead of repaint-flashing every frame).
  React.useEffect(() => {
    if (!props.paneResizing) mapRef.current?.resize();
  }, [props.paneResizing]);

  const pins: Pin[] = props.items
    .filter((entry) => entry.place && entry.status !== "cancelled")
    .map((entry) => ({ item: entry, lng: entry.place!.lng, lat: entry.place!.lat }));
  const pinSig = pins
    .map((pin) => `${pin.item.id}:${pin.lng}:${pin.lat}:${pin.item.status}:${pin.item.kind}`)
    .join("|");
  const viaSig = (props.routeVias ?? [])
    .map((via) => `${via.id}:${via.afterItemId}:${via.lng}:${via.lat}`)
    .join("|");
  const routeSig = `${props.routeDayId ?? "-"}§${props.routeDate ?? "-"}§${(props.routeItemIds ?? ["-"]).join(",")}§${viaSig}§${pinSig}`;
  // The day's stops in checklist order (the same filter the pins use), for
  // the step pill's count and labels.
  const stepStops = (props.routeItemIds ?? [])
    .map((id) => props.items.find((entry) => entry.id === id))
    .filter(
      (entry): entry is Item =>
        entry !== undefined && entry.place !== undefined && entry.status !== "cancelled",
    );
  const pinsRef = React.useRef(pins);
  pinsRef.current = pins;

  React.useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;
    const pageListeners = new AbortController();
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (disposed || !containerRef.current) return;
      libRef.current = maplibregl;
      const isDark = document.documentElement.dataset.theme === "dark";
      const initialStyle = isDark ? await loadDarkStyle() : LIGHT_STYLE;
      if (disposed || !containerRef.current) return;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: initialStyle as never,
        center: [4.89, 52.37],
        zoom: 11,
        attributionControl: { compact: true },
        // Maplibre's own ResizeObserver would repaint on every frame of a
        // divider drag; the observer below owns resizing instead (rAF
        // coalesced, held during drags, one clean resize on release).
        trackResize: false,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      // Maplibre's compact attribution expands itself the moment the tile
      // source's credit arrives (a sourcedata event, not mount), and the
      // expanded bar crowds the bottom edge where the step pill lives.
      // Collapse it once with the same class/attribute flip its own toggle
      // performs; it stays collapsed after that, and the circle still opens
      // on click, which keeps the OSM credit reachable as the tile policy
      // requires. Listening AFTER the control registers its handlers means
      // this runs after the expansion on the same event.
      const collapseAttribution = () => {
        const attrib = containerRef.current?.querySelector(".maplibregl-ctrl-attrib");
        if (!attrib?.classList.contains("maplibregl-compact-show")) return;
        attrib.classList.remove("maplibregl-compact-show");
        attrib.setAttribute("open", "");
        map.off("sourcedata", collapseAttribution);
        map.off("styledata", collapseAttribution);
      };
      map.on("sourcedata", collapseAttribution);
      map.on("styledata", collapseAttribution);
      mapRef.current = map;
      if (import.meta.env.DEV) (window as { __map?: unknown }).__map = map;
      map.on("error", (event) => console.error("[map]", event.error?.message ?? event));
      // Tap-away (and click-away) dismisses the tooltip; pin clicks stop
      // propagation so they never count as away. This general handler runs
      // before the delegated layer handlers (registration order), so a
      // click on a place dot closes the previous pinned card here and the
      // layer handler below opens the new one.
      let pinnedPlacePopup: import("maplibre-gl").Popup | null = null;
      map.on("click", () => {
        closePopup();
        pinnedPlacePopup?.remove();
        pinnedPlacePopup = null;
        if (selectedViaIdRef.current) {
          selectedViaIdRef.current = null;
          syncViaSelection();
        }
      });
      // A user gesture during step mode claims the camera. originalEvent
      // separates real input from our own easeTo/fitBounds moves; wheel and
      // dragstart also catch gestures that interrupt an in-flight ease
      // (movestart won't re-fire while the camera is already moving).
      const claimCamera = (event: { originalEvent?: Event }) => {
        if (event.originalEvent && stepLegRef.current !== null) cameraClaimedRef.current = true;
      };
      map.on("movestart", claimCamera);
      map.on("wheel", claimCamera);
      map.on("dragstart", claimCamera);
      // Overlay fetches re-run when the camera settles somewhere new; the
      // delay coalesces a burst of small moves into one tick.
      let viewSettleTimer = 0;
      map.on("moveend", () => {
        window.clearTimeout(viewSettleTimer);
        viewSettleTimer = window.setTimeout(() => storeViewTick((tick) => tick + 1), 350);
      });
      // Delete / Backspace removes the selected via, unless focus is in a
      // text field (list rows are textareas; typing must never nuke pins).
      window.addEventListener(
        "keydown",
        (event) => {
          if (event.key !== "Delete" && event.key !== "Backspace") return;
          const viaId = selectedViaIdRef.current;
          const dayId = routeEditRef.current.dayId;
          if (!viaId || !dayId) return;
          const target = event.target as HTMLElement | null;
          if (
            target &&
            (target.tagName === "INPUT" ||
              target.tagName === "TEXTAREA" ||
              target.isContentEditable)
          ) {
            return;
          }
          event.preventDefault();
          selectedViaIdRef.current = null;
          removeRouteVia(dayId, viaId);
        },
        { signal: pageListeners.signal },
      );
      // Ride hover: name what the colored line IS ("Bus 80 → Zandvoort",
      // scheduled times, a live badge when the feed is real-time), in the
      // same inverted tooltip the pins use. Stop dots get their own
      // name-and-time tooltip and win over the line underneath them. The
      // shared popup follows the cursor; content only re-renders when the
      // feature under it changes.
      const ridePopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10,
      });
      let rideShownHtml = "";
      const followCursor = (html: string, lngLat: import("maplibre-gl").LngLat) => {
        if (html !== rideShownHtml) {
          ridePopup.setHTML(html);
          rideShownHtml = html;
        }
        ridePopup.setLngLat(lngLat);
        if (!ridePopup.isOpen()) ridePopup.addTo(map);
      };
      map.on("mousemove", "day-route-ride-hit", (event) => {
        // The stop handler owns the popup while a dot is under the cursor.
        if (map.queryRenderedFeatures(event.point, { layers: ["day-route-stops-hit"] }).length) {
          return;
        }
        const ride = event.features?.[0]?.properties ?? {};
        const title = [ride.vehicle, ride.name].filter(Boolean).join(" ") || "Transit ride";
        const liveBadge =
          ride.live === true
            ? `<span style="color:#4ADE80;font-size:0.8em;margin-left:6px">● live</span>`
            : "";
        const headsign = ride.headsign
          ? `<div style="font-size:0.85em;color:var(--tooltip-subtext);margin-top:2px">${ARROW_SVG}${escapeHtml(ride.headsign)}</div>`
          : "";
        const times = ride.times
          ? `<div style="font-size:0.85em;color:var(--tooltip-subtext);margin-top:2px">${escapeHtml(ride.times)}</div>`
          : "";
        const next = ride.next
          ? `<div style="font-size:0.85em;color:var(--tooltip-subtext);margin-top:2px">Next ${escapeHtml(ride.next)}</div>`
          : "";
        followCursor(
          `<div style="font-weight:600">${escapeHtml(title)}${liveBadge}</div>${headsign}${times}${next}`,
          event.lngLat,
        );
      });
      map.on("mouseleave", "day-route-ride-hit", (event) => {
        // Leaving the line onto one of its stops hands the popup over
        // instead of blinking it away (the leave fires after the sibling
        // layer's move on the same pointer event).
        if (map.queryRenderedFeatures(event.point, { layers: ["day-route-stops-hit"] }).length) {
          return;
        }
        ridePopup.remove();
        rideShownHtml = "";
      });
      map.on("mousemove", "day-route-stops-hit", (event) => {
        const stop = event.features?.[0]?.properties ?? {};
        if (!stop.name) return;
        const time = stop.time
          ? `<div style="font-size:0.85em;color:var(--tooltip-subtext);margin-top:2px">${escapeHtml(stop.time)}</div>`
          : "";
        followCursor(
          `<div style="font-weight:600">${escapeHtml(stop.name)}</div>${time}`,
          event.lngLat,
        );
      });
      map.on("mouseleave", "day-route-stops-hit", (event) => {
        if (map.queryRenderedFeatures(event.point, { layers: ["day-route-ride-hit"] }).length) {
          rideShownHtml = "";
          return;
        }
        ridePopup.remove();
        rideShownHtml = "";
      });
      // Overlay hovers share the same cursor popup. Precedence runs from
      // the plan down to ambient context (day route, then places, then bus
      // stops, then bus lines): a handler yields when a higher layer also
      // sits under the cursor, and a leave hands over instead of blinking
      // when the pointer lands on a sibling.
      const overlayHoverBlockers = (point: import("maplibre-gl").PointLike, ids: string[]) => {
        const layers = ids.filter((id) => map.getLayer(id) !== undefined);
        return layers.length > 0 && map.queryRenderedFeatures(point, { layers }).length > 0;
      };
      const noteLine = (text: string) =>
        `<div style="font-size:0.85em;color:var(--tooltip-subtext);margin-top:2px">${escapeHtml(text)}</div>`;
      map.on("mousemove", "overlay-places-hit", (event) => {
        // A pinned card owns the interaction; the hover tooltip stays away.
        if (pinnedPlacePopup?.isOpen()) return;
        if (overlayHoverBlockers(event.point, ["day-route-stops-hit", "day-route-ride-hit"])) {
          return;
        }
        const place = event.features?.[0]?.properties ?? {};
        if (!place.name) return;
        const status =
          place.closed === true
            ? `<div style="color:#F87171;font-size:0.85em;margin-top:2px">Closed at this time</div>`
            : "";
        const hoursLine = place.hoursDisplay ? noteLine(String(place.hoursDisplay)) : "";
        const notes = String(place.notes ?? "")
          .split("\n")
          .filter(Boolean)
          .map(noteLine)
          .join("");
        followCursor(
          `<div style="font-size:0.8em;color:var(--tooltip-faint)">${escapeHtml(String(place.label ?? ""))}</div>` +
            `<div style="font-weight:600">${escapeHtml(String(place.name))}</div>` +
            `${status}${notes}${hoursLine}` +
            noteLine("Click for details"),
          event.lngLat,
        );
      });
      // Clicking a place pins its card open: a real popover the cursor can
      // enter, with links out (website, menu, phone) and an add-to-plan
      // button. The general click handler above already dismissed any
      // previous card.
      map.on("click", "overlay-places-hit", (event) => {
        const feature = event.features?.[0];
        const place = feature?.properties;
        if (!feature || !place?.name) return;
        ridePopup.remove();
        rideShownHtml = "";
        const at =
          feature.geometry.type === "Point"
            ? (feature.geometry.coordinates as [number, number])
            : ([event.lngLat.lng, event.lngLat.lat] as [number, number]);
        const itemKind: ItemKind =
          place.kind === "vegan" || place.kind === "vegetarian" ? "food" : "activity";
        const popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: false,
          offset: 10,
          maxWidth: "300px",
        });
        const card = placeCard(place, () =>
          onAddPlaceRef.current(
            {
              name: String(place.name),
              lng: at[0],
              lat: at[1],
              address: place.address ? String(place.address) : undefined,
            },
            itemKind,
          ),
        );
        popup.setDOMContent(card);
        popup.setLngLat(at).addTo(map);
        const ratingAbort = new AbortController();
        popup.on("close", () => {
          ratingAbort.abort();
          if (pinnedPlacePopup === popup) pinnedPlacePopup = null;
        });
        pinnedPlacePopup = popup;
        // The Google rating fills in when the server answers; a place
        // Google doesn't know (or a spent monthly budget) just shows no
        // rating line. Food cards also hunt the reviews for a vegan
        // mention: firsthand crowd evidence, quoted with its date.
        const query = new URLSearchParams({
          lat: String(at[1]),
          lng: String(at[0]),
          name: String(place.name),
        });
        if (place.kind === "vegan") query.set("mention", "vegan");
        fetch(`/api/places?${query}`, { signal: ratingAbort.signal })
          .then((res) =>
            res.ok ? res.json() : Promise.reject(new Error(`places responded ${res.status}`)),
          )
          .then(
            (answer: {
              rating: number | null;
              count?: number;
              mapsUri?: string;
              mention?: { snippet: string; dateIso?: string };
            }) => {
              if (answer.rating === null || !card.isConnected) return;
              const anchorButton = card.querySelector("button");
              const line = document.createElement(answer.mapsUri ? "a" : "div");
              line.textContent = `★ ${answer.rating.toFixed(1)}${
                answer.count ? ` (${answer.count.toLocaleString("en-US")})` : ""
              } · Google`;
              line.style.cssText = "font-size:0.85em;color:var(--tooltip-subtext)";
              if (line instanceof HTMLAnchorElement && answer.mapsUri) {
                line.href = answer.mapsUri;
                line.target = "_blank";
                line.rel = "noreferrer";
                line.style.textDecoration = "underline";
              }
              card.insertBefore(line, anchorButton);
              if (answer.mention) {
                const quote = document.createElement("div");
                const when = answer.mention.dateIso
                  ? ` · ${Temporal.Instant.from(answer.mention.dateIso)
                      .toZonedDateTimeISO("UTC")
                      .toPlainDate()
                      .toLocaleString("en-US", { month: "short", year: "numeric" })}`
                  : "";
                quote.textContent = `“${answer.mention.snippet}”${when}`;
                quote.style.cssText =
                  "font-size:0.8em;color:var(--tooltip-subtext);font-style:italic;margin-top:2px";
                card.insertBefore(quote, anchorButton);
              }
            },
          )
          .catch((error) => {
            if (ratingAbort.signal.aborted) return;
            console.warn("[overlays] rating lookup failed:", error);
          });
      });
      map.on("mouseleave", "overlay-places-hit", (event) => {
        if (
          overlayHoverBlockers(event.point, [
            "day-route-stops-hit",
            "day-route-ride-hit",
            "bus-stops-hit",
            "bus-network-hit",
          ])
        ) {
          rideShownHtml = "";
          return;
        }
        ridePopup.remove();
        rideShownHtml = "";
      });
      // A bus stop's departure board loads on hover: the popup opens with
      // the stop name at once and the next departures fill in when the
      // feed answers, unless the cursor has moved on. The fetch waits out
      // a short settle (sweeping across a dense cluster must not fire one
      // request per stop crossed) and boards cache briefly, so re-hovering
      // the same stop is free.
      let boardStopId: string | null = null;
      let boardAbort: AbortController | null = null;
      let boardTimer = 0;
      const boardCache = new Map<string, { atMs: number; rows: string }>();
      const BOARD_TTL_MS = 60_000;
      // A feed can have service gaps (seasonal timetables); MOTIS then
      // answers with the next KNOWN departures, weeks out. Any departure
      // not on today's date wears its date so "8:19 AM" can't read as
      // this morning.
      const boardRows = (
        entries: Awaited<ReturnType<typeof fetchStopBoard>>,
        tz: string,
      ) => {
        const today = Temporal.Now.instant().toZonedDateTimeISO(tz).toPlainDate();
        return entries
          .slice(0, 6)
          .map((entry) => {
            const departDate = Temporal.Instant.from(entry.departIso)
              .toZonedDateTimeISO(tz)
              .toPlainDate();
            const dayTag = departDate.equals(today)
              ? ""
              : `${departDate.toLocaleString("en-US", { month: "short", day: "numeric" })} · `;
            return (
              `<div style="font-size:0.85em;color:var(--tooltip-subtext);margin-top:2px">` +
              `<span style="font-weight:600">${escapeHtml(entry.line)}</span> ` +
              `${ARROW_SVG}${escapeHtml(entry.headsign)} · ${dayTag}${clockTime(entry.departIso, tz)}` +
              `${entry.live ? ` <span style="color:#4ADE80">●</span>` : ""}</div>`
            );
          })
          .join("");
      };
      map.on("mousemove", "bus-stops-hit", (event) => {
        if (
          overlayHoverBlockers(event.point, [
            "day-route-stops-hit",
            "day-route-ride-hit",
            "overlay-places-hit",
          ])
        ) {
          return;
        }
        const stop = event.features?.[0]?.properties ?? {};
        const stopId = String(stop.stopId ?? "");
        if (!stopId) return;
        if (stopId === boardStopId) {
          ridePopup.setLngLat(event.lngLat);
          if (!ridePopup.isOpen()) ridePopup.addTo(map);
          return;
        }
        boardStopId = stopId;
        boardAbort?.abort();
        window.clearTimeout(boardTimer);
        const title = `<div style="font-weight:600">${escapeHtml(String(stop.name ?? "Stop"))}</div>`;
        const tz = String(stop.tz ?? "UTC");
        const cached = boardCache.get(stopId);
        if (cached && Temporal.Now.instant().epochMilliseconds - cached.atMs < BOARD_TTL_MS) {
          followCursor(`${title}${cached.rows}`, event.lngLat);
          return;
        }
        followCursor(`${title}${noteLine("Loading times…")}`, event.lngLat);
        boardTimer = window.setTimeout(() => {
          if (boardStopId !== stopId) return;
          const controller = new AbortController();
          boardAbort = controller;
          fetchStopBoard(stopId, controller.signal)
            .then((entries) => {
              if (controller.signal.aborted) return;
              const rows = boardRows(entries, tz) || noteLine("No departures found");
              boardCache.set(stopId, {
                atMs: Temporal.Now.instant().epochMilliseconds,
                rows,
              });
              if (boardStopId !== stopId) return;
              const html = `${title}${rows}`;
              rideShownHtml = html;
              if (ridePopup.isOpen()) ridePopup.setHTML(html);
            })
            .catch((error) => {
              if (controller.signal.aborted) return;
              console.warn("[overlays] stop board failed:", error);
              if (boardStopId !== stopId) return;
              const html = `${title}${noteLine("Times unavailable")}`;
              rideShownHtml = html;
              if (ridePopup.isOpen()) ridePopup.setHTML(html);
            });
        }, 180);
      });
      map.on("mouseleave", "bus-stops-hit", (event) => {
        boardStopId = null;
        boardAbort?.abort();
        window.clearTimeout(boardTimer);
        if (
          overlayHoverBlockers(event.point, [
            "day-route-stops-hit",
            "day-route-ride-hit",
            "overlay-places-hit",
            "bus-network-hit",
          ])
        ) {
          rideShownHtml = "";
          return;
        }
        ridePopup.remove();
        rideShownHtml = "";
      });
      map.on("mousemove", "bus-network-hit", (event) => {
        if (
          overlayHoverBlockers(event.point, [
            "day-route-stops-hit",
            "day-route-ride-hit",
            "overlay-places-hit",
            "bus-stops-hit",
          ])
        ) {
          return;
        }
        // Several lines often share a street; list every distinct route
        // under the cursor instead of only the topmost.
        const lines = new Map<string, string>();
        for (const feature of event.features ?? []) {
          const route = feature.properties ?? {};
          const ref = String(route.ref ?? "");
          const detail = String(route.name ?? "").replace(/^Bus\s+\S+:\s*/, "");
          if (!ref && !detail) continue;
          lines.set(`${ref}|${detail}`, ref ? `<span style="font-weight:600">${escapeHtml(ref)}</span> ${escapeHtml(detail)}` : escapeHtml(detail));
        }
        if (!lines.size) return;
        const shown = Array.from(lines.values()).slice(0, 6);
        const extra = lines.size - shown.length;
        followCursor(
          `<div style="font-size:0.8em;color:var(--tooltip-faint)">Bus lines</div>` +
            shown.map((row) => `<div style="font-size:0.85em;margin-top:2px">${row}</div>`).join("") +
            (extra > 0 ? noteLine(`and ${extra} more`) : ""),
          event.lngLat,
        );
      });
      map.on("mouseleave", "bus-network-hit", (event) => {
        if (
          overlayHoverBlockers(event.point, [
            "day-route-stops-hit",
            "day-route-ride-hit",
            "overlay-places-hit",
            "bus-stops-hit",
          ])
        ) {
          rideShownHtml = "";
          return;
        }
        ridePopup.remove();
        rideShownHtml = "";
      });
      // Route editing: grab the line to bend the day's route. The drag
      // shows a ghost diamond and previews the re-fit (throttled so the
      // public router sees at most ~2 requests a second); release locks
      // the via into the day. A grab that never moves toggles the route
      // highlight instead.
      map.on("mouseenter", "day-route-hit", () => {
        map.getCanvas().style.cursor = "grab";
      });
      // The grab affordance: a handle dot rides the line under the cursor
      // (snapped onto the route, not floating beside it).
      const handleEl = document.createElement("div");
      handleEl.classList.add("travel-route-handle");
      const handleMarker = new maplibregl.Marker({ element: handleEl });
      let handleShown = false;
      const hideHandle = () => {
        if (!handleShown) return;
        handleMarker.remove();
        handleShown = false;
      };
      map.on("mousemove", "day-route-hit", (event) => {
        const chainIdx = Number(event.features?.[0]?.properties?.chain ?? -1);
        const chain = walkChains(routeEditRef.current.parts)[chainIdx];
        if (!chain) return;
        const snapped = nearestPointOnLine(chain.road.line, event.lngLat.lng, event.lngLat.lat);
        if (!snapped) return;
        // Position before the first addTo: adding an unpositioned marker
        // throws inside maplibre and strands the element at the origin.
        handleMarker.setLngLat(snapped);
        if (!handleShown) {
          handleMarker.addTo(map);
          handleShown = true;
        }
      });
      map.on("mouseleave", "day-route-hit", () => {
        map.getCanvas().style.cursor = "";
        hideHandle();
      });
      map.on("mousedown", "day-route-hit", (event) => {
        hideHandle();
        const { dayId, parts } = routeEditRef.current;
        const chainIdx = Number(event.features?.[0]?.properties?.chain ?? -1);
        const chain = walkChains(parts)[chainIdx];
        if (!dayId || !chain || chain.waypoints.length < 2) return;
        // By index, not identity: a chain's own road fetch can land
        // mid-drag and replace the object in `parts`.
        const partIdx = parts.indexOf(chain);
        const grabbed = legAt(chain.road, chain.waypoints, event.lngLat.lng, event.lngLat.lat);
        if (!grabbed) return;
        event.preventDefault();
        map.getCanvas().style.cursor = "grabbing";
        const ghost = viaElement();
        ghost.classList.add("travel-via-ghost");
        const ghostMarker = new maplibregl.Marker({ element: ghost })
          .setLngLat(event.lngLat)
          .addTo(map);
        const startPoint = event.point;
        let moved = false;
        let lastPreview = 0;
        let previewAbort: AbortController | null = null;
        const tentativeWaypoints = (lng: number, lat: number) =>
          chain.waypoints.toSpliced(grabbed.legIndex + 1, 0, {
            kind: "via",
            via: { id: "ghost", afterItemId: grabbed.afterItemId, lng, lat },
          });
        const onMove = (move: import("maplibre-gl").MapMouseEvent) => {
          if (
            Math.abs(move.point.x - startPoint.x) > 3 ||
            Math.abs(move.point.y - startPoint.y) > 3
          ) {
            moved = true;
          }
          ghostMarker.setLngLat(move.lngLat);
          const now = performance.now();
          if (!moved || now - lastPreview < 400) return;
          lastPreview = now;
          previewAbort?.abort();
          previewAbort = new AbortController();
          fetchRoadRoute(tentativeWaypoints(move.lngLat.lng, move.lngLat.lat), previewAbort.signal)
            .then((road) =>
              drawRoute(parts.map((part, i) => (i === partIdx ? { ...chain, road } : part))),
            )
            .catch((error: unknown) => {
              // Aborted previews are just the next drag frame taking over.
              if (previewAbort?.signal.aborted) return;
              console.warn("[map] route preview failed:", error);
            });
        };
        map.on("mousemove", onMove);
        map.once("mouseup", (up) => {
          map.off("mousemove", onMove);
          previewAbort?.abort();
          ghostMarker.remove();
          map.getCanvas().style.cursor = "grab";
          if (!moved) {
            // A still click toggles the route highlight, walks and rides
            // together.
            routeHighlightedRef.current = !routeHighlightedRef.current;
            const emphatic = routeHighlightedRef.current;
            if (map.getLayer("day-route-line")) {
              map.setPaintProperty(
                "day-route-line",
                "line-width",
                emphatic ? zoomWidth(4, 16) : zoomWidth(2.5, 10),
              );
              map.setPaintProperty("day-route-line", "line-opacity", emphatic ? 1 : 0.85);
            }
            if (map.getLayer("day-route-ride")) {
              map.setPaintProperty(
                "day-route-ride",
                "line-width",
                emphatic ? zoomWidth(4.5, 18) : zoomWidth(3, 12),
              );
              map.setPaintProperty("day-route-ride", "line-opacity", emphatic ? 1 : 0.8);
            }
            return;
          }
          // The store change flows back as new routeVias props, and the
          // route effect refits through the locked via.
          addRouteVia(
            dayId,
            { afterItemId: grabbed.afterItemId, lng: up.lngLat.lng, lat: up.lngLat.lat },
            grabbed.insertAfterViaId,
          );
        });
      });
      map.on("load", () => {
        if (!disposed) storeReady(true);
      });
      // Divider drags fire resize continuously; coalescing to one canvas
      // resize per frame keeps the map from flashing mid-drag.
      let resizeFrame = 0;
      const resizeObserver = new ResizeObserver(() => {
        if (paneResizingRef.current || resizeFrame) return;
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = 0;
          if (!paneResizingRef.current) map.resize();
        });
      });
      resizeObserver.observe(containerRef.current);
      map.once("remove", () => {
        if (resizeFrame) cancelAnimationFrame(resizeFrame);
        resizeObserver.disconnect();
      });
      // Follow <html data-theme>: swap style, then re-add our layers once the
      // new style is in (styleTick re-runs the pin/route effects).
      observer = new MutationObserver(async () => {
        const dark = document.documentElement.dataset.theme === "dark";
        const style = dark ? await loadDarkStyle() : LIGHT_STYLE;
        if (disposed) return;
        map.setStyle(style as never);
        map.once("style.load", () => {
          if (!disposed) storeStyleTick((tick) => tick + 1);
        });
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
    })();
    return () => {
      disposed = true;
      pageListeners.abort();
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const popupLeaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPopupFor = (itemId: string) => {
    const map = mapRef.current;
    const maplibregl = libRef.current;
    const entry = markersRef.current.get(itemId);
    if (!map || !maplibregl || !entry) return;
    // A pending leave would remove the popup we are about to show.
    if (popupLeaveTimer.current) {
      clearTimeout(popupLeaveTimer.current);
      popupLeaveTimer.current = null;
    }
    popupRef.current ??= new maplibregl.Popup({
      offset: 14,
      closeButton: false,
      closeOnClick: false,
    });
    // Re-adding builds fresh popup DOM, so the settle animation replays
    // even when hover moves straight from one pin to the next.
    if (popupRef.current.isOpen()) popupRef.current.remove();
    popupRef.current
      .setLngLat(entry.marker.getLngLat())
      .setHTML(popupHtml(entry.item))
      .addTo(map);
  };

  const closePopup = () => {
    const popup = popupRef.current;
    if (!popup || !popup.isOpen() || popupLeaveTimer.current) return;
    const el = popup.getElement();
    if (!el) {
      popup.remove();
      return;
    }
    el.classList.add("popup-leave");
    // Outlives the popup-shuffle-out animation by a hair, so the card is
    // fully gone before the element is torn down.
    popupLeaveTimer.current = setTimeout(() => {
      popupLeaveTimer.current = null;
      popup.remove();
    }, 210);
  };

  React.useEffect(() => {
    props.apiRef.current = {
      focusItem: (itemId, place, zoom = 16) => {
        const map = mapRef.current;
        if (!map) return;
        map.flyTo({ center: [place.lng, place.lat], zoom, duration: 1200 });
        openPopupFor(itemId);
      },
    };
  });

  // Pins: create/update/remove by id, never touching the camera.
  React.useEffect(() => {
    const map = mapRef.current;
    const maplibregl = libRef.current;
    if (!ready || !map || !maplibregl) return;

    const keep = new Set(pinsRef.current.map((pin) => pin.item.id));
    for (const [id, entry] of markersRef.current) {
      if (!keep.has(id)) {
        entry.marker.remove();
        markersRef.current.delete(id);
      }
    }
    for (const pin of pinsRef.current) {
      const existing = markersRef.current.get(pin.item.id);
      if (existing) {
        existing.marker.setLngLat([pin.lng, pin.lat]);
        existing.item = pin.item;
        stylePinElement(existing.el, pin.item);
        continue;
      }
      const el = document.createElement("div");
      stylePinElement(el, pin.item);
      // Hover shows the tooltip; leaving hides it. Click is reserved for
      // the row jump: highlight + scroll, plus a gentle recenter on the pin
      // at the current zoom (⌘-click flies in via focusItem instead, so it
      // skips the recenter to avoid two competing camera moves).
      el.addEventListener("mouseenter", () => openPopupFor(pin.item.id));
      el.addEventListener("mouseleave", () => closePopup());
      // Touch has no hover: a still ~450ms press opens the tooltip instead,
      // and swallows the click that follows so it doesn't also jump the
      // row. Drifting more than a few pixels reads as a pan and cancels.
      let pressTimer: ReturnType<typeof setTimeout> | null = null;
      let longPressed = false;
      el.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "touch") return;
        const startX = event.clientX;
        const startY = event.clientY;
        longPressed = false;
        pressTimer = setTimeout(() => {
          pressTimer = null;
          longPressed = true;
          openPopupFor(pin.item.id);
        }, 450);
        const press = new AbortController();
        const settle = () => {
          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
          press.abort();
        };
        window.addEventListener(
          "pointermove",
          (move) => {
            if (Math.abs(move.clientX - startX) > 8 || Math.abs(move.clientY - startY) > 8) {
              settle();
            }
          },
          { signal: press.signal },
        );
        window.addEventListener("pointerup", settle, { signal: press.signal });
        window.addEventListener("pointercancel", settle, { signal: press.signal });
      });
      // iOS would otherwise pop its own callout over a held pin.
      el.addEventListener("contextmenu", (event) => event.preventDefault());
      el.addEventListener("click", (event) => {
        // Marker clicks bubble into the map's own click (which closes the
        // tooltip for tap-away); a pin press is not a tap-away.
        event.stopPropagation();
        if (longPressed) {
          longPressed = false;
          return;
        }
        const zoom = event.metaKey || event.ctrlKey;
        if (!zoom) {
          const at = markersRef.current.get(pin.item.id)?.marker.getLngLat();
          if (at) map.easeTo({ center: at, duration: 500 });
        }
        onPinClickRef.current(pin.item.id, zoom);
      });
      const marker = new maplibregl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]);
      marker.addTo(map);
      markersRef.current.set(pin.item.id, { marker, el, item: pin.item });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, styleTick, pinSig]);

  // What the drag handlers need about the current route, refreshed by the
  // route effect: the day being edited and its drawn parts. Chains are
  // addressed by the `chain` property carried on their rendered features.
  const routeEditRef = React.useRef<{ dayId: string | null; parts: DayRoutePart[] }>({
    dayId: null,
    parts: [],
  });
  const routeHighlightedRef = React.useRef(false);
  // The drawn geometry per leg (a leg can span several lines: station
  // walks plus the ride), for the step-mode camera.
  const legLinesRef = React.useRef<number[][][][]>([]);
  const stepLegRef = React.useRef<number | null>(null);
  stepLegRef.current = props.stepLeg;
  // Once the user zooms or pans mid-step, the camera is theirs: further
  // steps pan each leg into view at their zoom instead of re-fitting, and
  // exiting step mode leaves the view alone. Entering step mode afresh
  // hands the camera back.
  const cameraClaimedRef = React.useRef(false);
  // Ambient overlays: which are on, plus a hint per chip (count, loading,
  // or a zoom-in nudge). Fetched results cache with the padded view they
  // covered; viewTick advances when the camera settles somewhere new.
  const [overlayKinds, storeOverlayKinds] = React.useState<OverlayKind[]>([]);
  const [overlayHints, storeOverlayHints] = React.useState<
    Partial<Record<OverlayKind, string>>
  >({});
  const [viewTick, storeViewTick] = React.useState(0);
  const overlayPlacesRef = React.useRef(
    new Map<OverlayKind, { view: ViewBounds; places: OverlayPlace[] }>(),
  );
  const busNetworkRef = React.useRef<{ view: ViewBounds; routes: BusRoute[] } | null>(null);
  const busStopsRef = React.useRef<{ view: ViewBounds; stops: BusStopPoint[] } | null>(null);
  // The sights-view + plan combination the model already curated, so
  // repaint-only effect runs don't re-ask it.
  const curatedKeyRef = React.useRef("");
  const toggleOverlay = (kind: OverlayKind) =>
    storeOverlayKinds((active) =>
      active.includes(kind) ? active.filter((entry) => entry !== kind) : active.concat(kind),
    );

  const drawRoute = (parts: DayRoutePart[]) => {
    const map = mapRef.current;
    if (!map) return;
    // Rides without a brand color get the transport steel blue, picked per
    // theme here because layer paint can't read CSS variables (the theme
    // swap re-runs the route effect, so this stays in sync).
    const dark = document.documentElement.dataset.theme === "dark";
    const rideFallback = dark ? "#6B93BF" : "#3A6EA5";
    const rideColor = (brand: string | undefined) =>
      groundedLineColor(brand, dark) ?? rideFallback;
    const features: Feature[] = [];
    // Legs are consecutive stop pairs in checklist order; every feature
    // carries its leg index so step mode can spotlight one pair. A chain
    // slices at its stops' snapped vertices (vias stay inside their leg);
    // a ride is one leg, station walks included.
    const legLines: number[][][][] = [];
    let chainIdx = 0;
    for (const part of parts) {
      if (part.kind === "chain") {
        const chain = chainIdx++;
        const stopVertices = part.waypoints.flatMap((waypoint, idx) =>
          waypoint.kind === "stop" ? [part.road.waypointVertex[idx]] : [],
        );
        for (let i = 0; i < stopVertices.length - 1; i++) {
          const slice = part.road.line.slice(stopVertices[i], stopVertices[i + 1] + 1);
          const leg = legLines.length;
          legLines.push([slice.length >= 2 ? slice : part.road.line]);
          if (slice.length >= 2) {
            features.push(lineFeature(slice, { kind: "walk", chain, leg }));
          }
        }
      } else {
        const leg = legLines.length;
        legLines.push(part.legs.map((rideLeg) => rideLeg.line));
        for (const rideLeg of part.legs) {
          if (rideLeg.mode === "walk") {
            features.push(lineFeature(rideLeg.line, { kind: "walk", chain: -1, leg }));
            continue;
          }
          const tz = rideLeg.tz ?? "UTC";
          const times =
            rideLeg.departIso && rideLeg.arriveIso
              ? `${clockTime(rideLeg.departIso, tz)} – ${clockTime(rideLeg.arriveIso, tz)} · ${Math.round(
                  (Temporal.Instant.from(rideLeg.arriveIso).epochMilliseconds -
                    Temporal.Instant.from(rideLeg.departIso).epochMilliseconds) /
                    60000,
                )} min`
              : undefined;
          features.push(
            lineFeature(rideLeg.line, {
              kind: "ride",
              chain: -1,
              leg,
              color: rideColor(rideLeg.color),
              name: rideLeg.name,
              vehicle: rideLeg.vehicle,
              headsign: rideLeg.headsign,
              times,
              next: rideLeg.nextDeparts?.length
                ? rideLeg.nextDeparts.map((iso) => clockTime(iso, tz)).join(", ")
                : undefined,
              live: rideLeg.live,
            }),
          );
          for (const stop of rideLeg.stops ?? []) {
            features.push(
              pointFeature([stop.lng, stop.lat], {
                kind: "stop",
                chain: -1,
                leg,
                color: rideColor(rideLeg.color),
                name: stop.name,
                time: stop.timeIso ? clockTime(stop.timeIso, tz) : undefined,
              }),
            );
          }
        }
      }
    }
    legLinesRef.current = legLines;
    const collection = { type: "FeatureCollection" as const, features };
    const source = map.getSource("day-route") as
      | import("maplibre-gl").GeoJSONSource
      | undefined;
    if (source) {
      source.setData(collection);
      stepPaint();
      return;
    }
    // maxzoom 24: geojson sources tile internally and default to 18, past
    // which overzoomed lines clip away and the whole route vanishes.
    map.addSource("day-route", { type: "geojson", data: collection, maxzoom: 24 });
    // Rides render under the walking ants, solid in the line's own color.
    map.addLayer({
      id: "day-route-ride",
      type: "line",
      source: "day-route",
      filter: ["==", ["get", "kind"], "ride"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": zoomWidth(3, 12),
        "line-opacity": 0.8,
      },
    });
    map.addLayer({
      id: "day-route-line",
      type: "line",
      source: "day-route",
      filter: ["==", ["get", "kind"], "walk"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#C05B3F",
        "line-width": zoomWidth(2.5, 10),
        "line-dasharray": [0.5, 2.7],
        "line-opacity": 0.85,
      },
    });
    // Every stop the rides call at, page-colored dots ringed in the leg's
    // line color, sitting on the ride lines.
    map.addLayer({
      id: "day-route-stops",
      type: "circle",
      source: "day-route",
      filter: ["==", ["get", "kind"], "stop"],
      paint: {
        "circle-radius": zoomWidth(3.5, 9),
        "circle-color":
          document.documentElement.dataset.theme === "dark" ? "#171512" : "#FFFFFF",
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-width": zoomWidth(1.75, 4),
      },
    });
    map.addLayer({
      id: "day-route-stops-hit",
      type: "circle",
      source: "day-route",
      filter: ["==", ["get", "kind"], "stop"],
      paint: { "circle-radius": zoomWidth(10, 20), "circle-opacity": 0.001 },
    });
    // Wide invisible twins make the thin lines hoverable without fat
    // rendering. Editable chains (chain >= 0) get the drag surface; rides
    // get their own twin for the what-line-is-this tooltip (they cannot
    // hold a via).
    map.addLayer({
      id: "day-route-ride-hit",
      type: "line",
      source: "day-route",
      filter: ["==", ["get", "kind"], "ride"],
      paint: { "line-width": zoomWidth(18, 36), "line-opacity": 0.001 },
    });
    map.addLayer({
      id: "day-route-hit",
      type: "line",
      source: "day-route",
      filter: [">=", ["get", "chain"], 0],
      paint: { "line-width": zoomWidth(18, 36), "line-opacity": 0.001 },
    });
    stepPaint();
  };

  // Step mode paint: the active leg keeps its full colors, every other leg
  // (and its transit stops) drops to a dim neutral. Applied after every
  // redraw and on every step so layer rebuilds never lose the focus.
  const stepPaint = () => {
    const map = mapRef.current;
    if (!map || !map.getLayer("day-route-line")) return;
    const leg = stepLegRef.current;
    const dark = document.documentElement.dataset.theme === "dark";
    const dim = dark ? "#4E4842" : "#CFC9C1";
    if (leg === null) {
      map.setPaintProperty("day-route-line", "line-color", "#C05B3F");
      map.setPaintProperty("day-route-line", "line-opacity", 0.85);
      map.setPaintProperty("day-route-ride", "line-color", ["get", "color"] as never);
      map.setPaintProperty("day-route-ride", "line-opacity", 0.8);
      map.setPaintProperty("day-route-stops", "circle-stroke-color", ["get", "color"] as never);
      map.setPaintProperty("day-route-stops", "circle-opacity", 1);
      map.setPaintProperty("day-route-stops", "circle-stroke-opacity", 1);
      return;
    }
    const active = ["==", ["get", "leg"], leg];
    map.setPaintProperty("day-route-line", "line-color", ["case", active, "#C05B3F", dim] as never);
    map.setPaintProperty("day-route-line", "line-opacity", ["case", active, 1, 0.5] as never);
    map.setPaintProperty(
      "day-route-ride",
      "line-color",
      ["case", active, ["get", "color"], dim] as never,
    );
    map.setPaintProperty("day-route-ride", "line-opacity", ["case", active, 1, 0.45] as never);
    map.setPaintProperty(
      "day-route-stops",
      "circle-stroke-color",
      ["case", active, ["get", "color"], dim] as never,
    );
    map.setPaintProperty("day-route-stops", "circle-opacity", ["case", active, 1, 0.5] as never);
    map.setPaintProperty(
      "day-route-stops",
      "circle-stroke-opacity",
      ["case", active, 1, 0.5] as never,
    );
  };

  // Route for the selected day, in plan order with its locked vias
  // interleaved: straight placeholder lines draw immediately so scope
  // changes feel instant, then each part swaps in as its router answers
  // (walking chains from OSRM, transit rides from Transitous).
  React.useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const currentPins = pinsRef.current;
    const stops = (props.routeItemIds ?? [])
      .map((id) => currentPins.find((pin) => pin.item.id === id))
      .filter((pin): pin is Pin => pin !== undefined)
      .map((pin) => ({ itemId: pin.item.id, lng: pin.lng, lat: pin.lat }));
    const dayId = props.routeDayId;
    const controller = new AbortController();
    planDayRoute(
      stops,
      props.routeVias ?? [],
      // No day means no stops, so the empty date never reaches a request.
      props.routeDate ?? "",
      controller.signal,
      (parts, settled, failed) => {
        routeEditRef.current = { dayId, parts };
        drawRoute(parts);
        if (settled) {
          storeRouteNotice(failed ? "Routing unreachable · showing straight lines" : null);
        }
      },
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, styleTick, routeSig]);

  // Checklist order rendered onto the pins: when a day is selected, each
  // placed stop's dot grows a numeral (1-based day order). In step mode
  // the two endpoints of the active leg stay full strength and the rest
  // fade. Runs after the pin effect (which rebuilds dot styles) because
  // routeSig contains pinSig.
  const numberPins = () => {
    const leg = stepLegRef.current;
    const orderIds = (props.routeItemIds ?? []).filter((id) => markersRef.current.has(id));
    for (const [id, entry] of markersRef.current) {
      const dot = entry.el.firstElementChild as HTMLSpanElement | null;
      if (!dot) continue;
      const statusOpacity = entry.item.status === "done" ? "0.45" : "1";
      const order = orderIds.indexOf(id);
      if (order < 0) {
        dot.textContent = "";
        dot.style.opacity = statusOpacity;
        continue;
      }
      dot.textContent = String(order + 1);
      dot.style.width = "17px";
      dot.style.height = "17px";
      dot.style.display = "grid";
      dot.style.placeItems = "center";
      dot.style.fontSize = "10px";
      // The map container's 20px line-height overflows the dot and shoves
      // the digit off center; a tight line box lets the grid truly center it.
      dot.style.lineHeight = "1";
      // Digits use none of the font's descent, so a geometrically centered
      // line box still reads half a pixel low. The padding lifts the ink to
      // the optical center (measured against canvas font metrics).
      dot.style.paddingBottom = "1px";
      dot.style.fontWeight = "650";
      dot.style.color = "#FFFFFF";
      const endpoint = leg !== null && (order === leg || order === leg + 1);
      dot.style.opacity = leg === null || endpoint ? statusOpacity : "0.3";
    }
  };

  // Step mode: spotlight one leg, ease the camera onto it, and restore
  // the whole-route view on exit.
  const prevStepLegRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    numberPins();
    stepPaint();
    const leg = props.stepLeg;
    if (leg !== null) {
      if (prevStepLegRef.current === null) cameraClaimedRef.current = false;
      const lines = legLinesRef.current[leg];
      if (lines?.length) {
        const bounds = lineBounds(lines);
        if (cameraClaimedRef.current) {
          if (bounds) {
            map.easeTo({
              center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2],
              duration: 550,
            });
          }
        } else {
          fitToLines(map, lines);
        }
      }
    } else if (prevStepLegRef.current !== null && !cameraClaimedRef.current) {
      const all = legLinesRef.current.flat();
      if (all.length) fitToLines(map, all);
    }
    prevStepLegRef.current = leg;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, styleTick, routeSig, props.stepLeg]);

  // Ambient overlays: paint whatever the caches hold for the enabled
  // toggles, then refresh any cache the current view has escaped. Points
  // dedupe across overlays in catalog order, so a place tagged both vegan
  // and vegetarian shows once, on the stricter overlay.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    ensureOverlayLayers(map);
    const controller = new AbortController();
    const setHint = (kind: OverlayKind, hint: string | undefined) => {
      if (controller.signal.aborted) return;
      storeOverlayHints((hints) => ({ ...hints, [kind]: hint }));
    };
    const setSource = (id: string, features: Feature[]) => {
      const source = map.getSource(id) as import("maplibre-gl").GeoJSONSource | undefined;
      source?.setData({ type: "FeatureCollection", features });
    };
    // The moment hours are judged against: mid-step with a timed target
    // stop, the planned visit ("will it be open when I'm there"); any
    // other time, now. Both in the place's own zone.
    const stepTimeMinutes = (() => {
      const leg = stepLegRef.current;
      if (leg === null || !props.routeDate) return null;
      return parseItemTime(stepStops[leg + 1]?.time) ?? parseItemTime(stepStops[leg]?.time);
    })();
    const momentByZone = new Map<string, Temporal.ZonedDateTime>();
    const momentAt = (lng: number, lat: number) => {
      let zone = "UTC";
      try {
        zone = tzLookup(lat, lng);
      } catch (error) {
        console.warn("[overlays] timezone lookup failed:", error);
      }
      let moment = momentByZone.get(zone);
      if (!moment) {
        moment =
          stepTimeMinutes !== null && props.routeDate
            ? Temporal.PlainDate.from(props.routeDate).toZonedDateTime({
                timeZone: zone,
                plainTime: new Temporal.PlainTime(
                  Math.floor(stepTimeMinutes / 60),
                  stepTimeMinutes % 60,
                ),
              })
            : Temporal.Now.instant().toZonedDateTimeISO(zone);
        momentByZone.set(zone, moment);
      }
      return moment;
    };
    const paintPlaces = () => {
      const features: Feature[] = [];
      const seen = new Set<string>();
      for (const overlay of OVERLAYS) {
        if (!overlayKinds.includes(overlay.kind)) continue;
        const cached = overlayPlacesRef.current.get(overlay.kind);
        for (const place of cached?.places ?? []) {
          if (seen.has(place.id)) continue;
          seen.add(place.id);
          const rules = place.hours ? parseOpeningHours(place.hours) : null;
          const open = rules ? isOpenAt(rules, momentAt(place.lng, place.lat)) : undefined;
          features.push({
            type: "Feature",
            properties: {
              kind: place.kind,
              label: overlay.label,
              color: overlay.color,
              name: place.name,
              notes: place.notes.join("\n"),
              hoursDisplay: place.hours ? formatHours(place.hours) : undefined,
              open: open === true,
              closed: open === false,
              website: place.website,
              menu: place.menu,
              phone: place.phone,
              address: place.address,
            },
            geometry: { type: "Point", coordinates: [place.lng, place.lat] },
          });
        }
      }
      setSource("overlay-places", features);
    };
    // Suggested derives from the sights data (fetched even when the
    // Sights chip itself is off) plus what the plan already talks about.
    // The heuristic paints immediately; the server's model then upgrades
    // the same cache when it answers, keyed so each sights view and plan
    // combination asks the model once.
    const planTexts = props.items.map((entry) => entry.text);
    const refreshPicks = () => {
      if (!overlayKinds.includes("picks")) return;
      const sightsCache = overlayPlacesRef.current.get("sights");
      if (!sightsCache) return;
      const view = sightsCache.view;
      const curateKey = `${view.south},${view.west},${view.north},${view.east}#${planTexts.join("|")}`;
      if (curatedKeyRef.current === curateKey) {
        // This combination already curated (or is in flight); repainting
        // with the heuristic would clobber the model's answer.
        setHint("picks", String(overlayPlacesRef.current.get("picks")?.places.length ?? 0));
        return;
      }
      const picks = suggestPicks(sightsCache.places, planTexts);
      overlayPlacesRef.current.set("picks", { view, places: picks });
      setHint("picks", String(picks.length));
      curatedKeyRef.current = curateKey;
      curatePicks(sightsCache.places, planTexts, controller.signal)
        .then((curated) => {
          // The answer stays valid for this key even if the effect re-ran;
          // only the painting belongs to the live effect.
          overlayPlacesRef.current.set("picks", { view, places: curated });
          if (controller.signal.aborted) return;
          setHint("picks", String(curated.length));
          paintPlaces();
        })
        .catch((error) => {
          // An abort just means the effect re-ran; let the next run retry.
          if (controller.signal.aborted) {
            curatedKeyRef.current = "";
            return;
          }
          console.warn("[overlays] curation fell back to the heuristic:", error);
        });
    };
    const paintBuses = () => {
      const on = overlayKinds.includes("buses");
      const dark = document.documentElement.dataset.theme === "dark";
      setSource(
        "bus-network",
        on
          ? (busNetworkRef.current?.routes ?? []).map((route) => ({
              type: "Feature" as const,
              properties: {
                ref: route.ref,
                name: route.name,
                color: groundedLineColor(route.color, dark),
                operator: route.operator,
              },
              geometry: { type: "MultiLineString" as const, coordinates: route.lines },
            }))
          : [],
      );
      setSource(
        "bus-stops",
        on
          ? (busStopsRef.current?.stops ?? []).map((stop) => ({
              type: "Feature" as const,
              properties: { stopId: stop.id, name: stop.name, tz: stop.tz },
              geometry: { type: "Point" as const, coordinates: [stop.lng, stop.lat] },
            }))
          : [],
      );
    };
    refreshPicks();
    paintPlaces();
    paintBuses();
    const zoom = map.getZoom();
    const view = visibleView(map);
    const fetchView = paddedView(map);
    // Picks carry no selectors of their own: they ride the sights data,
    // which joins the fetch set whenever Suggested is on.
    const pointKinds = overlayKinds.filter((kind) => kind !== "buses" && kind !== "picks");
    const neededKinds =
      overlayKinds.includes("picks") && !pointKinds.includes("sights")
        ? pointKinds.concat("sights")
        : pointKinds;
    const staleKinds = neededKinds.filter((kind) => {
      const cached = overlayPlacesRef.current.get(kind);
      return !cached || !containsView(cached.view, view);
    });
    for (const kind of pointKinds) {
      if (!staleKinds.includes(kind)) {
        setHint(kind, String(overlayPlacesRef.current.get(kind)?.places.length ?? 0));
      }
    }
    const fetchKinds = staleKinds.filter((kind) => zoom >= overlayTraits(kind).minZoom);
    for (const kind of staleKinds) {
      const hint = fetchKinds.includes(kind) ? "loading" : "zoom in";
      if (kind !== "sights" || overlayKinds.includes("sights")) setHint(kind, hint);
      if (kind === "sights" && overlayKinds.includes("picks")) setHint("picks", hint);
    }
    if (fetchKinds.length) {
      fetchOverlayPlaces(fetchKinds, fetchView, controller.signal)
        .then((places) => {
          for (const kind of fetchKinds) {
            const own = places.filter((place) => place.kind === kind);
            overlayPlacesRef.current.set(kind, { view: fetchView, places: own });
            if (kind !== "sights" || overlayKinds.includes("sights")) {
              setHint(kind, String(own.length));
            }
          }
          refreshPicks();
          paintPlaces();
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          console.warn("[overlays] places fetch failed:", error);
          for (const kind of fetchKinds) {
            if (kind !== "sights" || overlayKinds.includes("sights")) setHint(kind, "failed");
            if (kind === "sights" && overlayKinds.includes("picks")) setHint("picks", "failed");
          }
        });
    }
    if (overlayKinds.includes("buses")) {
      const network = busNetworkRef.current;
      const networkFresh = network !== null && containsView(network.view, view);
      if (networkFresh) {
        setHint("buses", `${network.routes.length} lines`);
      } else if (zoom < overlayTraits("buses").minZoom) {
        setHint("buses", "zoom in");
      } else {
        setHint("buses", "loading");
        fetchBusNetwork(fetchView, controller.signal)
          .then((routes) => {
            busNetworkRef.current = { view: fetchView, routes };
            setHint("buses", `${routes.length} lines`);
            paintBuses();
          })
          .catch((error) => {
            if (controller.signal.aborted) return;
            console.warn("[overlays] bus network fetch failed:", error);
            setHint("buses", "failed");
          });
      }
      // Stops (and their boards) only matter at street zoom, matching the
      // layer's own minzoom.
      const stops = busStopsRef.current;
      if (zoom >= 13 && (!stops || !containsView(stops.view, view))) {
        fetchBusStops(fetchView, controller.signal)
          .then((fetched) => {
            busStopsRef.current = { view: fetchView, stops: fetched };
            paintBuses();
          })
          .catch((error) => {
            if (controller.signal.aborted) return;
            console.warn("[overlays] bus stops fetch failed:", error);
          });
      }
    }
    return () => controller.abort();
    // routeSig covers the items whose texts steer Suggested and whose
    // times anchor the closed-at-this-time judgment; stepLeg re-anchors it
    // as the user steps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, styleTick, overlayKinds, viewTick, routeSig, props.stepLeg]);

  // Locked vias render as draggable diamonds: drag moves the via (and the
  // route re-fits through it), double-click removes it.
  const viaMarkersRef = React.useRef(new Map<string, import("maplibre-gl").Marker>());
  const selectedViaIdRef = React.useRef<string | null>(null);
  const syncViaSelection = () => {
    for (const [id, marker] of viaMarkersRef.current) {
      marker
        .getElement()
        .classList.toggle("travel-via-selected", id === selectedViaIdRef.current);
    }
  };
  React.useEffect(() => {
    const map = mapRef.current;
    const maplibregl = libRef.current;
    if (!ready || !map || !maplibregl) return;
    const dayId = props.routeDayId;
    // Only vias that survived the chain split get a diamond: a via whose
    // leg turned into a ride keeps its record (it comes back if the leg
    // walks again) but showing it would offer a drag that bends nothing.
    // The route effect above runs first and planDayRoute seeds parts
    // synchronously, so this reads the fresh split.
    const activeViaIds = new Set(
      walkChains(routeEditRef.current.parts).flatMap((chain) =>
        chain.waypoints.flatMap((waypoint) =>
          waypoint.kind === "via" ? [waypoint.via.id] : [],
        ),
      ),
    );
    const vias = dayId
      ? (props.routeVias ?? []).filter((via) => activeViaIds.has(via.id))
      : [];
    const keep = new Set(vias.map((via) => via.id));
    for (const [id, marker] of viaMarkersRef.current) {
      if (!keep.has(id)) {
        marker.remove();
        viaMarkersRef.current.delete(id);
        if (selectedViaIdRef.current === id) selectedViaIdRef.current = null;
      }
    }
    for (const via of vias) {
      const existing = viaMarkersRef.current.get(via.id);
      if (existing) {
        // Skip while the owner is mid-drag; setLngLat would yank it back.
        if (!existing.isDraggable() || existing.getLngLat().lng !== via.lng) {
          existing.setLngLat([via.lng, via.lat]);
        }
        continue;
      }
      const el = viaElement();
      el.title =
        "Route waypoint (drag to adjust, click to select, Delete or double-click to remove)";
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        const selecting = selectedViaIdRef.current !== via.id;
        selectedViaIdRef.current = selecting ? via.id : null;
        syncViaSelection();
        // Take focus so the next Delete/Backspace unambiguously targets
        // this via, not a row textarea the focus was parked in.
        if (selecting) el.focus({ preventScroll: true });
      });
      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([via.lng, via.lat])
        .addTo(map);
      marker.on("dragend", () => {
        if (!dayId) return;
        const at = marker.getLngLat();
        moveRouteVia(dayId, via.id, at.lng, at.lat);
      });
      el.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        if (dayId) removeRouteVia(dayId, via.id);
      });
      viaMarkersRef.current.set(via.id, marker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, styleTick, routeSig]);

  // Marching ants: the classic dasharray walk, skipped for reduced motion
  // (the static dashes remain).
  React.useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Small dashes walking in 0.25-unit phase steps. The step size is a
    // renderer budget, not just taste: every distinct round-cap dasharray
    // occupies a tall SDF strip in maplibre's fixed-size LineAtlas forever
    // (no eviction), and a finer 0.1 step's 32 patterns overflow it
    // ("LineAtlas out of space"), after which dashed lines stop rendering
    // at all. 13 patterns fit alongside the basemap's dashes; the slower
    // tick keeps the same crawl speed. Dash units multiply by the line
    // width, so the dots scale with the zoom-interpolated width.
    const DASH = 0.5;
    const GAP = 2.7;
    const PHASE_STEP = 0.25;
    const dashSeq: number[][] = [];
    for (let x = 0; x < DASH; x += PHASE_STEP) dashSeq.push([x, GAP, DASH - x]);
    for (let y = 0; y < GAP; y += PHASE_STEP) dashSeq.push([0, y, DASH, GAP - y]);
    let step = -1;
    let frame = 0;
    const tick = (timestamp: number) => {
      const next = Math.floor(timestamp / 88) % dashSeq.length;
      if (next !== step && map.getLayer("day-route-line")) {
        step = next;
        map.setPaintProperty("day-route-line", "line-dasharray", dashSeq[next]);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, styleTick]);

  // Camera: fit ONLY when the scope changes. City-to-city jumps go instantly.
  React.useEffect(() => {
    const map = mapRef.current;
    const maplibregl = libRef.current;
    if (!ready || !map || !maplibregl) return;
    const currentPins = pinsRef.current;
    if (!currentPins.length) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const pin of currentPins) bounds.extend([pin.lng, pin.lat]);
    const center = map.getCenter();
    const target = bounds.getCenter();
    const far =
      Math.abs(center.lng - target.lng) > 0.5 || Math.abs(center.lat - target.lat) > 0.5;
    // Gentle for nearby moves; far city-to-city jumps stay quick (a full
    // animated flight would just stream unused tiles) but not a hard cut.
    const duration = far ? 500 : 1100;
    if (currentPins.length === 1) {
      map.flyTo({
        center: [currentPins[0].lng, currentPins[0].lat],
        zoom: 13,
        duration,
      });
    } else {
      map.fitBounds(bounds, { padding: 72, maxZoom: 14.5, duration });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.scopeKey]);

  return (
    <Block grid w="100%" h="100%">
      <div
        ref={containerRef}
        style={{
          gridArea: "1 / 1",
          width: "100%",
          height: "100%",
          background: "var(--colors-surface-muted)",
          // While a divider drag holds the canvas at its old size, the
          // overflowing edge clips instead of spilling into the outline.
          overflow: "hidden",
        }}
      />
      <Block gridArea="1 / 1" placeSelf="start start" zIndex={5} m="sm">
        <OverlayChips active={overlayKinds} hints={overlayHints} onToggle={toggleOverlay} />
      </Block>
      {routeNotice ? (
        <Text
          as="span"
          gridArea="1 / 1"
          placeSelf="end start"
          zIndex={5}
          m="sm"
          px="sm"
          py="0.15lh"
          borderRadius="9999px"
          bg="surface-strong"
          color="text-on-strong"
          fontSize="xs"
          fontWeight={550}
          pointerEvents="none"
        >
          {routeNotice}
        </Text>
      ) : null}
      {props.routeDayId && stepStops.length >= 2 ? (
        <Block gridArea="1 / 1" placeSelf="end center" zIndex={5} mb="md">
          {props.stepLeg === null ? (
            <Button
              type="button"
              onPress={() => props.onStep(0)}
              px="sm"
              py="0.15lh"
              gap="0.3rem"
              borderRadius="9999px"
              bg="surface-strong"
              color="text-on-strong"
              fontSize="xs"
              fontWeight={550}
              boxShadow="0 2px 10px rgba(0, 0, 0, 0.3)"
            >
              Step route
              <CaretRight size={11} />
            </Button>
          ) : (
            <Cluster
              gap="0.1rem"
              px="0.25rem"
              py="0.15rem"
              borderRadius="9999px"
              bg="surface-strong"
              color="text-on-strong"
              boxShadow="0 2px 10px rgba(0, 0, 0, 0.3)"
            >
              <IconButton
                aria-label="Previous leg"
                onPress={() => props.onStep(Math.max(0, (props.stepLeg ?? 1) - 1))}
                disabled={props.stepLeg === 0}
                size="1.5rem"
                borderRadius="9999px"
                color="text-on-strong"
                opacity={props.stepLeg === 0 ? 0.4 : 1}
                _hover={{
                  "@media (hover: hover)": {
                    color: "text-on-strong",
                    _before: { bg: "rgba(255, 255, 255, 0.16)" },
                  },
                }}
              >
                <CaretLeft size={12} />
              </IconButton>
              <Text
                as="span"
                fontSize="xs"
                fontWeight={550}
                color="inherit"
                whiteSpace="nowrap"
                maxW="24rem"
                overflow="hidden"
                textOverflow="ellipsis"
                px="0.3rem"
              >
                Leg {props.stepLeg + 1} of {stepStops.length - 1} ·{" "}
                {stopName(stepStops[props.stepLeg])} → {stopName(stepStops[props.stepLeg + 1])}
              </Text>
              <IconButton
                aria-label="Next leg"
                onPress={() =>
                  props.onStep(Math.min(stepStops.length - 2, (props.stepLeg ?? 0) + 1))
                }
                disabled={props.stepLeg >= stepStops.length - 2}
                size="1.5rem"
                borderRadius="9999px"
                color="text-on-strong"
                opacity={props.stepLeg >= stepStops.length - 2 ? 0.4 : 1}
                _hover={{
                  "@media (hover: hover)": {
                    color: "text-on-strong",
                    _before: { bg: "rgba(255, 255, 255, 0.16)" },
                  },
                }}
              >
                <CaretRight size={12} />
              </IconButton>
              <IconButton
                aria-label="Exit step mode"
                onPress={() => props.onStep(null)}
                size="1.5rem"
                borderRadius="9999px"
                color="text-on-strong"
                _hover={{
                  "@media (hover: hover)": {
                    color: "text-on-strong",
                    _before: { bg: "rgba(255, 255, 255, 0.16)" },
                  },
                }}
              >
                <X size={11} />
              </IconButton>
            </Cluster>
          )}
        </Block>
      ) : null}
    </Block>
  );
}

const stopName = (item: Item | undefined) => item?.place?.name ?? item?.text ?? "";
