import * as React from "react";
import type { Feature } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { Block, Text } from "atoms";
import { KIND_META, type Item, type RouteVia } from "entities/trips/types";
import { addRouteVia, moveRouteVia, removeRouteVia } from "entities/trips/store";
import {
  fetchRoadRoute,
  legAt,
  nearestPointOnLine,
  planDayRoute,
  type DayRoutePart,
} from "./route-plan";

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
  properties: { kind: string; chain: number; color?: string },
): Feature => ({
  type: "Feature",
  properties,
  geometry: { type: "LineString", coordinates },
});

// The editable walking chains in draw order; a rendered feature's `chain`
// property indexes into this list.
const walkChains = (parts: DayRoutePart[]) =>
  parts.filter((part): part is Extract<DayRoutePart, { kind: "chain" }> => part.kind === "chain");

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
  routeDayId: string | null;
  // The day's ISO date: transit rides are planned against its schedules.
  routeDate: string | null;
  routeVias: RouteVia[] | null;
  paneResizing: boolean;
  scopeKey: string;
  onPinClick: (itemId: string, zoom: boolean) => void;
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
      mapRef.current = map;
      if (import.meta.env.DEV) (window as { __map?: unknown }).__map = map;
      map.on("error", (event) => console.error("[map]", event.error?.message ?? event));
      // Tap-away (and click-away) dismisses the tooltip; pin clicks stop
      // propagation so they never count as away.
      map.on("click", () => {
        closePopup();
        if (selectedViaIdRef.current) {
          selectedViaIdRef.current = null;
          syncViaSelection();
        }
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
              drawRoute(parts.map((part) => (part === chain ? { ...part, road } : part))),
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
              map.setPaintProperty("day-route-line", "line-width", emphatic ? 4 : 2.5);
              map.setPaintProperty("day-route-line", "line-opacity", emphatic ? 1 : 0.85);
            }
            if (map.getLayer("day-route-ride")) {
              map.setPaintProperty("day-route-ride", "line-width", emphatic ? 4.5 : 3);
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

  const drawRoute = (parts: DayRoutePart[]) => {
    const map = mapRef.current;
    if (!map) return;
    // Rides without a brand color get the transport steel blue, picked per
    // theme here because layer paint can't read CSS variables (the theme
    // swap re-runs the route effect, so this stays in sync).
    const rideFallback =
      document.documentElement.dataset.theme === "dark" ? "#6B93BF" : "#3A6EA5";
    const features: Feature[] = [];
    let chainIdx = 0;
    for (const part of parts) {
      if (part.kind === "chain") {
        features.push(lineFeature(part.road.line, { kind: "walk", chain: chainIdx++ }));
      } else {
        for (const leg of part.legs) {
          features.push(
            leg.mode === "walk"
              ? lineFeature(leg.line, { kind: "walk", chain: -1 })
              : lineFeature(leg.line, {
                  kind: "ride",
                  chain: -1,
                  color: leg.color ?? rideFallback,
                }),
          );
        }
      }
    }
    const collection = { type: "FeatureCollection" as const, features };
    const source = map.getSource("day-route") as
      | import("maplibre-gl").GeoJSONSource
      | undefined;
    if (source) {
      source.setData(collection);
      return;
    }
    map.addSource("day-route", { type: "geojson", data: collection });
    // Rides render under the walking ants, solid in the line's own color.
    map.addLayer({
      id: "day-route-ride",
      type: "line",
      source: "day-route",
      filter: ["==", ["get", "kind"], "ride"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3,
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
        "line-width": 2.5,
        "line-dasharray": [0.5, 2.7],
        "line-opacity": 0.85,
      },
    });
    // A wide invisible twin makes the thin lines grabbable without fat
    // rendering; all route pointer interactions bind to it. Only editable
    // chains (chain >= 0) join in: rides and their station walks cannot
    // hold a via.
    map.addLayer({
      id: "day-route-hit",
      type: "line",
      source: "day-route",
      filter: [">=", ["get", "chain"], 0],
      paint: { "line-width": 18, "line-opacity": 0.001 },
    });
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
    // Mid-morning UTC keeps the schedule query in normal service hours
    // across European and American timezones alike; the drawn line barely
    // depends on the exact departure.
    const depart = `${props.routeDate ?? "2026-01-01"}T09:00:00Z`;
    const controller = new AbortController();
    planDayRoute(
      stops,
      props.routeVias ?? [],
      depart,
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
    const vias = dayId ? (props.routeVias ?? []) : [];
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
    // Small dashes and fine 0.1-unit phase steps: the coarse classic table
    // reads as a strobe, this reads as a crawl. Dash units multiply by the
    // line width, so DASH 1.4 is a ~3.5px dot at the 2.5px line.
    const DASH = 0.5;
    const GAP = 2.7;
    const PHASE_STEP = 0.1;
    const dashSeq: number[][] = [];
    for (let x = 0; x < DASH; x += PHASE_STEP) dashSeq.push([x, GAP, DASH - x]);
    for (let y = 0; y < GAP; y += PHASE_STEP) dashSeq.push([0, y, DASH, GAP - y]);
    let step = -1;
    let frame = 0;
    const tick = (timestamp: number) => {
      const next = Math.floor(timestamp / 35) % dashSeq.length;
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
    </Block>
  );
}
