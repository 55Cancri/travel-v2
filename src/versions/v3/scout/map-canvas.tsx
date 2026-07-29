import * as React from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { mapStyle } from "entities/map-style";
import type { ViewBounds } from "./find-places";
import { pinImage, pinImageId, type PinPhase } from "./pin-icons";
import type { RouteLeg, Waypoint } from "./route";

// The whole screen, with the query panel floating over it. The camera is the
// user's: nothing here moves it on its own, and the panel asks for a move
// only in answer to a press. Where the map is looking survives a reload,
// because a scout who panned to their neighbourhood should not have to pan
// back after every visit.

export type ScoutPin = {
  id: string;
  lng: number;
  lat: number;
  // The color of the query line that found it.
  color: string;
  phase: PinPhase;
  name: string;
  // The line under the pin, when today's hours are worth saying out loud.
  tag: string | null;
  // Popup body, in reading order.
  notes: string[];
  website?: string;
};

export type ScoutMapApi = {
  view: () => ViewBounds | null;
  center: () => { lng: number; lat: number } | null;
  zoom: () => number;
  flyTo: (target: { lng: number; lat: number }, zoom?: number) => void;
};

const CAMERA_KEY = "travel2:scout-camera";
const PIN_LAYER = "scout-pins";
const ROUTE_LAYER = "scout-route";
const WAYPOINT_LAYER = "scout-waypoints";

type Camera = { lng: number; lat: number; zoom: number };

const storedCamera = (): Camera | null => {
  try {
    const raw = localStorage.getItem(CAMERA_KEY);
    if (!raw) return null;
    const camera = JSON.parse(raw) as Partial<Camera>;
    const { lng, lat, zoom } = camera;
    if (typeof lng !== "number" || typeof lat !== "number" || typeof zoom !== "number") {
      return null;
    }
    return { lng, lat, zoom };
  } catch (error) {
    // Sealed storage (Safari lockdown throws even on reads) or a value some
    // other build wrote. Either way the map opens at home instead.
    console.warn("[scout] stored camera unreadable:", error);
    return null;
  }
};

const rememberCamera = (map: import("maplibre-gl").Map) => {
  const center = map.getCenter();
  try {
    localStorage.setItem(
      CAMERA_KEY,
      JSON.stringify({ lng: center.lng, lat: center.lat, zoom: map.getZoom() }),
    );
  } catch {
    // Sealed storage: the camera still holds for this session, only the
    // across-reload memory is lost.
  }
};

const routeCollection = (legs: RouteLeg[]) => ({
  type: "FeatureCollection" as const,
  features: legs
    .filter((leg) => leg.line.length >= 2)
    .map((leg) => ({
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: leg.line },
      properties: { mode: leg.mode, name: leg.name ?? "" },
    })),
});

const waypointCollection = (points: Waypoint[]) => ({
  type: "FeatureCollection" as const,
  features: points.map((point, idx) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
    // The order clicked is the whole meaning of a route, so each point
    // wears its position rather than being one anonymous dot among many.
    properties: { id: point.id, order: String(idx + 1) },
  })),
});

const pinCollection = (pins: ScoutPin[], dark: boolean) => ({
  type: "FeatureCollection" as const,
  features: pins.map((pin) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [pin.lng, pin.lat] },
    properties: {
      id: pin.id,
      icon: pinImageId(pin.color, pin.phase, dark),
      label: pin.tag ? `${pin.name}\n${pin.tag}` : pin.name,
      name: pin.name,
      notes: pin.notes.join("\n"),
      website: pin.website ?? "",
    },
  })),
});

// Real DOM rather than an HTML string, so the link carries no escaping
// question and the card can grow a control later.
const pinCard = (properties: Record<string, unknown>) => {
  const root = document.createElement("div");
  // Outside Panda's reach, so the spacing rides a 4px sub-grid instead of
  // the app's lh rhythm tokens.
  root.style.cssText = "display:grid;gap:4px;min-width:170px;max-width:250px";
  const line = (text: string, style: string) => {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = style;
    root.appendChild(el);
  };
  line(String(properties.name ?? ""), "font-weight:600;font-size:1.05em");
  for (const note of String(properties.notes ?? "")
    .split("\n")
    .filter(Boolean)) {
    line(note, "font-size:0.85em;color:var(--tooltip-subtext)");
  }
  const website = String(properties.website ?? "");
  if (website) {
    const anchor = document.createElement("a");
    anchor.textContent = "Website";
    anchor.href = website;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.style.cssText =
      "color:#7DB3E8;font-size:0.85em;text-decoration:underline;margin-top:2px";
    root.appendChild(anchor);
  }
  return root;
};

export function MapCanvas(props: {
  pins: ScoutPin[];
  route: RouteLeg[];
  waypoints: Waypoint[];
  // Cmd (or Ctrl) held while clicking: the gesture that grows a route,
  // deliberately a modifier so a plain click never drops a point by
  // accident while reading the map.
  onRoutePoint: (at: { lng: number; lat: number }) => void;
  home: { lng: number; lat: number };
  // Announced upward so a line typed before the map existed can search the
  // moment it does, instead of waiting for the next keystroke.
  onReady: (ready: boolean) => void;
  apiRef: React.RefObject<ScoutMapApi | null>;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);
  const popupRef = React.useRef<import("maplibre-gl").Popup | null>(null);
  const [ready, storeReady] = React.useState(false);
  // Repaint counter: a style swap wipes every image, source, and layer, so
  // the pin effect has to run again once the new style settles.
  const [styleTick, storeStyleTick] = React.useState(0);
  const homeRef = React.useRef(props.home);
  homeRef.current = props.home;
  const onReadyRef = React.useRef(props.onReady);
  onReadyRef.current = props.onReady;
  const onRoutePointRef = React.useRef(props.onRoutePoint);
  onRoutePointRef.current = props.onRoutePoint;

  React.useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;
    let sizeWatcher: ResizeObserver | null = null;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (disposed || !containerRef.current) return;
      const isDark = document.documentElement.dataset.theme === "dark";
      const style = await mapStyle(isDark);
      if (disposed || !containerRef.current) return;
      const opening = storedCamera() ?? { ...homeRef.current, zoom: 13 };
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: style as never,
        center: [opening.lng, opening.lat],
        zoom: opening.zoom,
        attributionControl: { compact: true },
        // The observer below owns resizing. Maplibre's own only reacts to
        // later CHANGES, so a map built before the page stylesheet lands
        // (the container still zero-height) keeps the 400x300 fallback
        // canvas forever. A fresh observer reports the current size the
        // moment it starts watching, which is the one report that matters.
        trackResize: false,
      });
      mapRef.current = map;
      sizeWatcher = new ResizeObserver(() => map.resize());
      sizeWatcher.observe(containerRef.current);
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(
        new maplibregl.GeolocateControl({ trackUserLocation: false }),
        "bottom-right",
      );
      if (import.meta.env.DEV) (window as { __scoutMap?: unknown }).__scoutMap = map;
      map.on("error", (event) => console.error("[scout map]", event.error?.message ?? event));
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 30,
      });
      popupRef.current = popup;
      // Layer-scoped handlers resolve their layer at dispatch time, so they
      // register once here and survive every style swap that takes the
      // layer with it. Registering them beside the layer instead would
      // stack a fresh copy on each swap.
      const openCard = (event: import("maplibre-gl").MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        if (feature?.geometry.type !== "Point") return;
        const [lng, lat] = feature.geometry.coordinates;
        popup.setLngLat([lng, lat]).setDOMContent(pinCard(feature.properties ?? {})).addTo(map);
      };
      map.on("mouseenter", PIN_LAYER, (event) => {
        map.getCanvas().style.cursor = "pointer";
        openCard(event);
      });
      map.on("mouseleave", PIN_LAYER, () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
      // Touch has no hover: a tap is how a phone reads a pin.
      map.on("click", PIN_LAYER, openCard);
      map.on("click", (event) => {
        const held = event.originalEvent.metaKey || event.originalEvent.ctrlKey;
        if (held) onRoutePointRef.current({ lng: event.lngLat.lng, lat: event.lngLat.lat });
      });
      map.on("moveend", () => rememberCamera(map));
      // style.load, not load: "load" waits for the first rendered frame,
      // which never arrives while the container has no size (a background
      // tab, a collapsed pane), leaving the map permanently un-ready and
      // its layers unbuilt. Having a style is the real precondition for
      // adding sources and layers, and it is also enough to search.
      map.on("style.load", () => {
        if (disposed) return;
        storeReady(true);
        onReadyRef.current(true);
      });
      // Follow <html data-theme>: swap the paper, then let the pin effect
      // rebuild everything the swap took with it. Each swap claims a
      // number, and a swap that is no longer the newest drops its style on
      // arrival: fetching the dark paper takes long enough that two quick
      // flips can come back out of order and leave the losing one showing.
      let themeGeneration = 0;
      const followTheme = () => {
        const generation = ++themeGeneration;
        (async () => {
          const dark = document.documentElement.dataset.theme === "dark";
          const nextStyle = await mapStyle(dark);
          if (disposed || generation !== themeGeneration) return;
          map.setStyle(nextStyle as never);
          // style.load, not styledata: styledata fires repeatedly and can
          // land while the new style is still arriving, and re-adding the
          // pin source that early throws.
          map.once("style.load", () => {
            if (!disposed) storeStyleTick((tick) => tick + 1);
          });
        })();
      };
      observer = new MutationObserver(followTheme);
      observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
      // The theme was read before the style fetch above, and the watcher
      // only starts now, so a flip during startup would otherwise go
      // unseen until the next one.
      if ((document.documentElement.dataset.theme === "dark") !== isDark) followTheme();

      props.apiRef.current = {
        view: () => {
          const bounds = map.getBounds();
          return {
            south: bounds.getSouth(),
            west: bounds.getWest(),
            north: bounds.getNorth(),
            east: bounds.getEast(),
          };
        },
        center: () => {
          const center = map.getCenter();
          return { lng: center.lng, lat: center.lat };
        },
        zoom: () => map.getZoom(),
        flyTo: (target, zoom) =>
          map.easeTo({ center: [target.lng, target.lat], zoom: zoom ?? map.getZoom() }),
      };
    })();
    return () => {
      disposed = true;
      observer?.disconnect();
      sizeWatcher?.disconnect();
      props.apiRef.current = null;
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      storeReady(false);
      onReadyRef.current(false);
    };
    // Mount-only: the api ref is a stable handle, and every live value the
    // callbacks read comes through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pins = props.pins;
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // A style swap leaves the map styleless for a moment, and adding an
    // image, source, or layer in that window throws. Ticking a checkbox or
    // the minute clock mid-swap would land exactly there. Nothing is lost
    // by waiting: style.load bumps styleTick and runs this again.
    if (!map.isStyleLoaded()) return;
    const dark = document.documentElement.dataset.theme === "dark";
    for (const pin of pins) {
      const id = pinImageId(pin.color, pin.phase, dark);
      if (map.hasImage(id)) continue;
      map.addImage(id, pinImage(pin.color, pin.phase, dark), { pixelRatio: 2 });
    }
    const collection = pinCollection(pins, dark);
    const source = map.getSource(PIN_LAYER) as import("maplibre-gl").GeoJSONSource | undefined;
    if (source) {
      source.setData(collection);
      return;
    }
    map.addSource(PIN_LAYER, { type: "geojson", data: collection });
    map.addLayer({
      id: PIN_LAYER,
      type: "symbol",
      source: PIN_LAYER,
      layout: {
        "icon-image": ["get", "icon"],
        "icon-anchor": "bottom",
        // Pins never hide each other: two branches of a chain on the same
        // block are exactly the comparison the search exists to make.
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-anchor": "top",
        "text-offset": [0, 0.2],
        "text-max-width": 9,
        // Labels DO collide, and the loser simply goes unlabelled: the pin
        // still stands, and the popup carries the detail.
        "text-optional": true,
      },
      paint: {
        "text-color": dark ? "#D9D0C4" : "#2C2722",
        "text-halo-color": dark ? "#171512" : "#FFFFFF",
        "text-halo-width": 1.4,
      },
    });
  }, [pins, ready, styleTick]);

  const route = props.route;
  const waypoints = props.waypoints;
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    const dark = document.documentElement.dataset.theme === "dark";
    const legs = routeCollection(route);
    const points = waypointCollection(waypoints);
    const drawn = map.getSource(ROUTE_LAYER) as import("maplibre-gl").GeoJSONSource | undefined;
    if (drawn) {
      drawn.setData(legs);
      (map.getSource(WAYPOINT_LAYER) as import("maplibre-gl").GeoJSONSource).setData(points);
      return;
    }
    map.addSource(ROUTE_LAYER, { type: "geojson", data: legs });
    map.addSource(WAYPOINT_LAYER, { type: "geojson", data: points });
    // Under the search pins: the route is context for them, not a rival.
    const under = map.getLayer(PIN_LAYER) ? PIN_LAYER : undefined;
    // Two layers rather than one, because line-dasharray is the one paint
    // property maplibre will not drive from a feature: a walk has to be a
    // separate filtered layer to be dashed at all. The pair also means the
    // two modes differ by pattern and not by colour alone.
    const routeWidth = ["interpolate", ["linear"], ["zoom"], 11, 3, 17, 6] as unknown as number;
    map.addLayer(
      {
        id: ROUTE_LAYER,
        type: "line",
        source: ROUTE_LAYER,
        filter: ["==", ["get", "mode"], "ride"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          // Our own colour rather than each operator's brand: an imported
          // hue is tuned for someone else's paper and can vanish on one of
          // our two.
          "line-color": dark ? "#6B93BF" : "#3A6EA5",
          "line-width": routeWidth,
          "line-opacity": 0.9,
        },
      },
      under,
    );
    map.addLayer(
      {
        id: `${ROUTE_LAYER}-walk`,
        type: "line",
        source: ROUTE_LAYER,
        filter: ["!=", ["get", "mode"], "ride"],
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: {
          "line-color": dark ? "#8A8378" : "#6B6258",
          "line-width": routeWidth,
          "line-opacity": 0.85,
          "line-dasharray": [1.6, 1.3],
        },
      },
      under,
    );
    map.addLayer(
      {
        id: `${WAYPOINT_LAYER}-dot`,
        type: "circle",
        source: WAYPOINT_LAYER,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            7,
            17,
            11,
          ] as unknown as number,
          "circle-color": dark ? "#D9D0C4" : "#2C2722",
          "circle-stroke-color": dark ? "#171512" : "#FFFFFF",
          "circle-stroke-width": 2,
        },
      },
      under,
    );
    map.addLayer(
      {
        id: WAYPOINT_LAYER,
        type: "symbol",
        source: WAYPOINT_LAYER,
        layout: {
          // The order clicked is the whole meaning of a route, so each point
          // wears its position rather than being an anonymous dot.
          "text-field": ["get", "order"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 11,
          "text-allow-overlap": true,
        },
        paint: { "text-color": dark ? "#171512" : "#FFFFFF" },
      },
      under,
    );
  }, [route, waypoints, ready, styleTick]);

  // A raw element with inline sizing, not an atom: maplibre claims this node,
  // stamping its own class and `position: relative` from its unlayered
  // stylesheet, which outranks anything Panda emits for it. Inline styles are
  // the only declarations that survive the takeover.
  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
