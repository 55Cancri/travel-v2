import * as React from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { KIND_META, type Item, type RouteVia } from "entities/trips/types";
import { addRouteVia, moveRouteVia, removeRouteVia } from "entities/trips/store";
import {
  buildWaypoints,
  fetchRoadRoute,
  legAt,
  straightRoute,
  type RoadRoute,
  type RouteWaypoint,
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
  routeVias: RouteVia[] | null;
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
  const [styleTick, storeStyleTick] = React.useState(0);
  const onPinClickRef = React.useRef(props.onPinClick);
  onPinClickRef.current = props.onPinClick;

  const pins: Pin[] = props.items
    .filter((entry) => entry.place && entry.status !== "cancelled")
    .map((entry) => ({ item: entry, lng: entry.place!.lng, lat: entry.place!.lat }));
  const pinSig = pins
    .map((pin) => `${pin.item.id}:${pin.lng}:${pin.lat}:${pin.item.status}:${pin.item.kind}`)
    .join("|");
  const viaSig = (props.routeVias ?? [])
    .map((via) => `${via.id}:${via.afterItemId}:${via.lng}:${via.lat}`)
    .join("|");
  const routeSig = `${props.routeDayId ?? "-"}§${(props.routeItemIds ?? ["-"]).join(",")}§${viaSig}§${pinSig}`;
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
      // Tap-away (and click-away) dismisses the tooltip; pin clicks stop
      // propagation so they never count as away.
      map.on("click", () => closePopup());
      // Route editing: grab the line to bend the day's route. The drag
      // shows a ghost diamond and previews the re-fit (throttled so the
      // public router sees at most ~2 requests a second); release locks
      // the via into the day. A grab that never moves toggles the route
      // highlight instead.
      map.on("mouseenter", "day-route-hit", () => {
        map.getCanvas().style.cursor = "grab";
      });
      map.on("mouseleave", "day-route-hit", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mousedown", "day-route-hit", (event) => {
        const { dayId, waypoints, road } = routeEditRef.current;
        if (!dayId || waypoints.length < 2) return;
        const grabbed = legAt(road, waypoints, event.lngLat.lng, event.lngLat.lat);
        if (!grabbed) return;
        event.preventDefault();
        map.getCanvas().style.cursor = "grabbing";
        const ghost = document.createElement("div");
        ghost.classList.add("travel-via", "travel-via-ghost");
        const ghostMarker = new maplibregl.Marker({ element: ghost })
          .setLngLat(event.lngLat)
          .addTo(map);
        const startPoint = event.point;
        let moved = false;
        let lastPreview = 0;
        let previewAbort: AbortController | null = null;
        const tentativeWaypoints = (lng: number, lat: number) =>
          waypoints.toSpliced(grabbed.legIndex + 1, 0, {
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
            .then((road) => drawRoute(road.line))
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
            // A still click toggles the route highlight.
            routeHighlightedRef.current = !routeHighlightedRef.current;
            const emphatic = routeHighlightedRef.current;
            if (map.getLayer("day-route-line")) {
              map.setPaintProperty("day-route-line", "line-width", emphatic ? 4 : 2.5);
              map.setPaintProperty("day-route-line", "line-opacity", emphatic ? 1 : 0.85);
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
  // route effect: the day being edited, its waypoints, and the drawn line.
  const routeEditRef = React.useRef<{
    dayId: string | null;
    waypoints: RouteWaypoint[];
    road: RoadRoute;
  }>({ dayId: null, waypoints: [], road: { line: [], waypointVertex: [] } });
  const routeHighlightedRef = React.useRef(false);

  const drawRoute = (coordinates: number[][]) => {
    const map = mapRef.current;
    if (!map) return;
    const routeData = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates },
    };
    const source = map.getSource("day-route") as
      | import("maplibre-gl").GeoJSONSource
      | undefined;
    if (source) {
      source.setData(routeData);
      return;
    }
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
    // A wide invisible twin makes the 2.5px line grabbable without fat
    // rendering; all route pointer interactions bind to it.
    map.addLayer({
      id: "day-route-hit",
      type: "line",
      source: "day-route",
      paint: { "line-width": 18, "line-opacity": 0.001 },
    });
  };

  // Route line for the selected day, in plan order with its locked vias
  // interleaved: the straight dashed line draws immediately so scope
  // changes feel instant, then swaps to the road-following walking route
  // once the router answers.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const currentPins = pinsRef.current;
    const stops = (props.routeItemIds ?? [])
      .map((id) => currentPins.find((pin) => pin.item.id === id))
      .filter((pin): pin is Pin => pin !== undefined)
      .map((pin) => ({ itemId: pin.item.id, lng: pin.lng, lat: pin.lat }));
    const waypoints = buildWaypoints(stops, props.routeVias ?? []);
    routeEditRef.current = {
      dayId: props.routeDayId,
      waypoints,
      road: straightRoute(waypoints),
    };
    drawRoute(routeEditRef.current.road.line);
    if (waypoints.length < 2) return;
    const controller = new AbortController();
    fetchRoadRoute(waypoints, controller.signal)
      .then((road) => {
        routeEditRef.current = { dayId: props.routeDayId, waypoints, road };
        drawRoute(road.line);
      })
      .catch((error: unknown) => {
        // A scope change aborts the stale request: flow control, not a
        // failure. Anything else keeps the straight line (offline and
        // router hiccups always exist) and says so.
        if (controller.signal.aborted) return;
        console.warn("[map] road route failed, keeping straight line:", error);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, styleTick, routeSig]);

  // Locked vias render as draggable diamonds: drag moves the via (and the
  // route re-fits through it), double-click removes it.
  const viaMarkersRef = React.useRef(new Map<string, import("maplibre-gl").Marker>());
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
      const el = document.createElement("div");
      el.classList.add("travel-via");
      el.title = "Route waypoint (drag to adjust, double-click to remove)";
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
    const dashSeq = [
      [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1],
      [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3],
      [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1],
      [0, 3.5, 3, 0.5],
    ];
    let step = -1;
    let frame = 0;
    const tick = (timestamp: number) => {
      const next = Math.floor(timestamp / 70) % dashSeq.length;
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
