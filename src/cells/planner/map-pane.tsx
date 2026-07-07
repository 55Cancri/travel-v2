import * as React from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { KIND_META, type Item } from "entities/trips/types";

// The map is a projection of the plan. Camera moves are deliberate: it refits
// ONLY when the scope changes (scopeKey), never because an item was edited or
// toggled — that was the "dots wiggle / zoom out on click" bug. Pin clicks
// highlight the row; ⌘-click zooms to street level. Far jumps (city → city)
// cut straight there instead of animating, so tiles start loading sooner.
// The style follows <html data-theme> (OpenFreeMap liberty ↔ dark).

const LIGHT_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

// Our own dark map theme. OpenFreeMap's "dark" is pure grayscale (asleep) and
// "fiord" is aggressively blue — so we take dark's layer structure and repaint
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
};

// The marker element is a two-layer sandwich: maplibre positions the OUTER
// wrapper with an inline transform every frame, so the wrapper must never
// carry a transform transition (one there makes every pin trail the camera
// by the transition duration). The inner dot owns the hover pop and the
// opacity fade, and the wrapper doubles as a finger-friendly hit area
// larger than the visible dot.
const stylePinElement = (el: HTMLDivElement, item: Item) => {
  const dim = item.status === "done";
  el.className = "travel-pin";
  el.style.cssText =
    "width:22px;height:22px;display:grid;place-items:center;cursor:pointer;";
  el.title = item.place?.name ?? item.text;
  let dot = el.firstElementChild as HTMLSpanElement | null;
  if (!dot) {
    dot = document.createElement("span");
    dot.className = "travel-pin-dot";
    el.appendChild(dot);
  }
  dot.style.cssText = `width:13px;height:13px;border-radius:50%;background:var(${KIND_META[item.kind].cssVar});box-shadow:var(--pin-dot-shadow);opacity:${dim ? 0.45 : 1};`;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const popupHtml = (item: Item) => {
  const name = escapeHtml(item.place?.name ?? item.text);
  const address = item.place?.address ? escapeHtml(item.place.address) : "";
  return `<div style="font-weight:600">${name}</div>${
    address
      ? `<div style="font-size:0.85em;opacity:0.7;margin-top:2px">${address}</div>`
      : ""
  }`;
};

export function MapPane(props: {
  items: Item[];
  routeItemIds: string[] | null;
  scopeKey: string;
  onPinClick: (itemId: string, zoom: boolean) => void;
  apiRef: React.RefObject<MapApi | null>;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = React.useRef(new Map<string, MarkerEntry>());
  const libRef = React.useRef<typeof import("maplibre-gl") | null>(null);
  const [ready, storeReady] = React.useState(false);
  const [styleTick, storeStyleTick] = React.useState(0);
  const onPinClickRef = React.useRef(props.onPinClick);
  onPinClickRef.current = props.onPinClick;

  const pins: Pin[] = props.items
    .filter((entry) => entry.place && entry.status !== "cancelled")
    .map((entry) => ({ item: entry, lng: entry.place!.lng, lat: entry.place!.lat }));
  const pinSig = pins
    .map((pin) => `${pin.item.id}:${pin.lng}:${pin.lat}:${pin.item.status}:${pin.item.kind}`)
    .join("|");
  const routeSig = `${(props.routeItemIds ?? ["-"]).join(",")}§${pinSig}`;
  const pinsRef = React.useRef(pins);
  pinsRef.current = pins;

  React.useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;
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
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
      if (import.meta.env.DEV) (window as { __map?: unknown }).__map = map;
      map.on("error", (event) => console.error("[map]", event.error?.message ?? event));
      map.on("load", () => {
        if (!disposed) storeReady(true);
      });
      // Divider drags fire resize continuously; coalescing to one canvas
      // resize per frame keeps the map from flashing mid-drag.
      let resizeFrame = 0;
      const resizeObserver = new ResizeObserver(() => {
        if (resizeFrame) return;
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = 0;
          map.resize();
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
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    props.apiRef.current = {
      focusItem: (itemId, place, zoom = 16) => {
        const map = mapRef.current;
        if (!map) return;
        map.flyTo({ center: [place.lng, place.lat], zoom, duration: 1200 });
        // Open the marker's popup if it's in the current scope; close the
        // previous one so tooltips don't pile up.
        const entry = markersRef.current.get(itemId);
        if (entry) {
          for (const [, other] of markersRef.current) {
            const popup = other.marker.getPopup();
            if (popup?.isOpen() && other !== entry) other.marker.togglePopup();
          }
          const popup = entry.marker.getPopup();
          if (popup && !popup.isOpen()) entry.marker.togglePopup();
        }
      },
    };
  });

  // Pins: create/update/remove by id — never touches the camera.
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
        stylePinElement(existing.el, pin.item);
        continue;
      }
      const el = document.createElement("div");
      stylePinElement(el, pin.item);
      el.addEventListener("click", (event) =>
        onPinClickRef.current(pin.item.id, event.metaKey || event.ctrlKey),
      );
      const marker = new maplibregl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]);
      marker.setPopup(
        new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(popupHtml(pin.item)),
      );
      marker.addTo(map);
      markersRef.current.set(pin.item.id, { marker, el });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, styleTick, pinSig]);

  // Route line for the selected day, in plan order.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const currentPins = pinsRef.current;
    const routeCoords = (props.routeItemIds ?? [])
      .map((id) => currentPins.find((pin) => pin.item.id === id))
      .filter((pin): pin is Pin => pin !== undefined)
      .map((pin) => [pin.lng, pin.lat]);
    const routeData = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: routeCoords },
    };
    const source = map.getSource("day-route") as import("maplibre-gl").GeoJSONSource | undefined;
    if (source) {
      source.setData(routeData);
    } else {
      map.addSource("day-route", { type: "geojson", data: routeData });
      map.addLayer({
        id: "day-route-line",
        type: "line",
        source: "day-route",
        paint: {
          "line-color": "#C05B3F",
          "line-width": 2.5,
          "line-dasharray": [2, 1.6],
          "line-opacity": 0.85,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, styleTick, routeSig]);

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
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        background: "var(--colors-surface-muted)",
      }}
    />
  );
}
