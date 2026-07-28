import * as React from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { mapStyle } from "entities/map-style";
import type { ViewBounds } from "./find-places";
import { pinImage, pinImageId, type PinPhase } from "./pin-icons";

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
  home: { lng: number; lat: number };
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
      map.on("moveend", () => rememberCamera(map));
      map.on("load", () => {
        if (!disposed) storeReady(true);
      });
      // Follow <html data-theme>: swap the paper, then let the pin effect
      // rebuild everything the swap took with it.
      observer = new MutationObserver(() => {
        (async () => {
          const dark = document.documentElement.dataset.theme === "dark";
          const nextStyle = await mapStyle(dark);
          if (disposed) return;
          map.setStyle(nextStyle as never);
          // style.load, not styledata: styledata fires repeatedly and can
          // land while the new style is still arriving, and re-adding the
          // pin source that early throws.
          map.once("style.load", () => {
            if (!disposed) storeStyleTick((tick) => tick + 1);
          });
        })();
      });
      observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });

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
    };
    // Mount-only: the api ref is a stable handle, and every live value the
    // callbacks read comes through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pins = props.pins;
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
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

  // A raw element with inline sizing, not an atom: maplibre claims this node,
  // stamping its own class and `position: relative` from its unlayered
  // stylesheet, which outranks anything Panda emits for it. Inline styles are
  // the only declarations that survive the takeover.
  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
