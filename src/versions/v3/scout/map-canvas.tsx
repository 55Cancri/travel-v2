import * as React from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { mapStyle } from "entities/map-style";
import type { MapCamera } from "entities/scout-maps";
import type { ViewBounds } from "./find-places";
import { PinCards, type PinCardFacts } from "./pin-cards";
import { pinImage, pinImageId, type PinPhase } from "./pin-icons";
import type { RouteLeg } from "./route";

// The whole screen, with the query panel floating over it. The camera is the
// user's: nothing here moves it on its own, and the panel asks for a move
// only in answer to a press. Where the map is looking is the map document's
// memory (each saved map keeps its own camera), reported upward on every
// rest and restored on switch.
//
// Two pin populations share one look but not one meaning: search pins are a
// query line's ticked findings (ephemeral), saved pins are the document's
// own places. Both report presses upward; the screen decides whether a
// press edits, connects, or does nothing.

export type ScoutPin = {
  id: string;
  lng: number;
  lat: number;
  // The color of the query line (or saved place) that owns it.
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
  // One flight that frames every given point: the overview half of the
  // camera peek. A single point (degenerate bounds) lands at street
  // level instead of the renderer's maximum zoom.
  fitTo: (points: { lng: number; lat: number }[]) => void;
  // A cut, not a flight: how a map switch lands on the other map's camera.
  jumpTo: (camera: MapCamera) => void;
  // Instant pixel pan. A canvas resize keeps the geography centered on
  // the NEW canvas center, so the sidebar push compensates by half the
  // pushed width to hold the world still on screen.
  shiftBy: (xPx: number) => void;
};

const PIN_LAYER = "scout-pins";
const SAVED_LAYER = "scout-saved";
const ROUTE_LAYER = "scout-route";
// Invisible, wide twin of the route lines: the thing a finger can hit.
const ROUTE_HIT_LAYER = "scout-route-hit";

const routeCollection = (legs: RouteLeg[]) => ({
  type: "FeatureCollection" as const,
  features: legs
    .filter((leg) => leg.line.length >= 2)
    .map((leg) => ({
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: leg.line },
      properties: { mode: leg.mode, name: leg.name ?? "", edgeId: leg.edgeId },
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
  saved: ScoutPin[];
  route: RouteLeg[];
  // The persistent mini tooltips. When they cover the search pins too,
  // the symbol labels and hover popups stand down (the cards carry the
  // words); a big sweep keeps labels instead and the cards stick to
  // saved places.
  cards: PinCardFacts[];
  cardsCoverSearch: boolean;
  onCardPress: (id: string) => void;
  // A press on a pin, either population. The screen routes it: connect
  // mode chains it into an edge, otherwise it opens the place's editor.
  onSearchPinPress: (pinId: string) => void;
  onSavedPinPress: (placeId: string) => void;
  // A press on a drawn route line, to edit that edge's transport modes.
  onEdgePress: (edgeId: string) => void;
  // Cmd (or Ctrl) held while clicking bare map: drops a spot node and
  // chains it, deliberately a modifier so a plain click never adds to the
  // document by accident while reading the map.
  onSpotDrop: (at: { lng: number; lat: number }) => void;
  // Where the camera opens: the document's saved camera, or home when the
  // map has never been looked at.
  opening: MapCamera;
  // Reported at every camera rest, so the document remembers.
  onCameraRest: (camera: MapCamera) => void;
  onReady: (ready: boolean) => void;
  apiRef: React.RefObject<ScoutMapApi | null>;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);
  const popupRef = React.useRef<import("maplibre-gl").Popup | null>(null);
  const [ready, storeReady] = React.useState(false);
  // The map as STATE (not just the ref), so the card overlay mounts its
  // listeners once the instance exists.
  const [liveMap, storeLiveMap] = React.useState<import("maplibre-gl").Map | null>(null);
  const cardsCoverRef = React.useRef(props.cardsCoverSearch);
  cardsCoverRef.current = props.cardsCoverSearch;
  // Repaint counter: a style swap wipes every image, source, and layer, so
  // the pin effect has to run again once the new style settles.
  const [styleTick, storeStyleTick] = React.useState(0);
  // Refreshed every render so a map that finishes constructing after a
  // document switch opens on the CURRENT document's camera, not the one
  // mounted first.
  const openingRef = React.useRef(props.opening);
  openingRef.current = props.opening;
  const onReadyRef = React.useRef(props.onReady);
  onReadyRef.current = props.onReady;
  const onSearchPinPressRef = React.useRef(props.onSearchPinPress);
  onSearchPinPressRef.current = props.onSearchPinPress;
  const onSavedPinPressRef = React.useRef(props.onSavedPinPress);
  onSavedPinPressRef.current = props.onSavedPinPress;
  const onEdgePressRef = React.useRef(props.onEdgePress);
  onEdgePressRef.current = props.onEdgePress;
  const onSpotDropRef = React.useRef(props.onSpotDrop);
  onSpotDropRef.current = props.onSpotDrop;
  const onCameraRestRef = React.useRef(props.onCameraRest);
  onCameraRestRef.current = props.onCameraRest;

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
      const opening = openingRef.current;
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
      storeLiveMap(map);
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
      // The popup is the info surface only while the persistent cards do
      // not already carry the words; saved pins always have a card, so
      // only the search layer ever gets one, and only in label mode.
      const openCard = (event: import("maplibre-gl").MapLayerMouseEvent) => {
        if (cardsCoverRef.current) return;
        const feature = event.features?.[0];
        if (feature?.geometry.type !== "Point") return;
        const [lng, lat] = feature.geometry.coordinates;
        popup.setLngLat([lng, lat]).setDOMContent(pinCard(feature.properties ?? {})).addTo(map);
      };
      const hoverable = (layer: string) => {
        map.on("mouseenter", layer, (event) => {
          map.getCanvas().style.cursor = "pointer";
          if (layer === PIN_LAYER) openCard(event);
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });
      };
      hoverable(PIN_LAYER);
      hoverable(SAVED_LAYER);
      // Touch has no hover: a tap is how a phone reads a pin. The press
      // also goes upward, where the screen may turn it into a connection
      // or an editor.
      map.on("click", PIN_LAYER, (event) => {
        openCard(event);
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") onSearchPinPressRef.current(id);
      });
      map.on("click", SAVED_LAYER, (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") onSavedPinPressRef.current(id);
      });
      map.on("mouseenter", ROUTE_HIT_LAYER, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", ROUTE_HIT_LAYER, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", ROUTE_HIT_LAYER, (event) => {
        // A press meant for a pin is the pin's: pins sit above the route
        // and already answered it.
        const pinsHit = map.queryRenderedFeatures(event.point, {
          layers: [PIN_LAYER, SAVED_LAYER].filter((layer) => map.getLayer(layer)),
        });
        if (pinsHit.length > 0) return;
        const edgeId = event.features?.[0]?.properties?.edgeId;
        if (typeof edgeId === "string" && edgeId) onEdgePressRef.current(edgeId);
      });
      map.on("click", (event) => {
        const held = event.originalEvent.metaKey || event.originalEvent.ctrlKey;
        if (!held) return;
        // A Cmd-click that lands on a pin is a connection gesture, not a
        // request for a new spot on top of it; the pin's own handler has
        // it.
        const hit = map.queryRenderedFeatures(event.point, {
          layers: [PIN_LAYER, SAVED_LAYER].filter((layer) => map.getLayer(layer)),
        });
        if (hit.length > 0) return;
        onSpotDropRef.current({ lng: event.lngLat.lng, lat: event.lngLat.lat });
      });
      map.on("moveend", () => {
        const center = map.getCenter();
        onCameraRestRef.current({ lng: center.lng, lat: center.lat, zoom: map.getZoom() });
      });
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
        fitTo: (points) => {
          if (points.length === 0) return;
          const bounds = new maplibregl.LngLatBounds();
          for (const point of points) bounds.extend([point.lng, point.lat]);
          // Padding clears the corner chrome; maxZoom is the same street
          // level a result row flies to, which is where a one-point fit
          // would otherwise dive past.
          map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
        },
        jumpTo: (camera) =>
          map.jumpTo({ center: [camera.lng, camera.lat], zoom: camera.zoom }),
        shiftBy: (xPx) => map.panBy([xPx, 0], { duration: 0 }),
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
      storeLiveMap(null);
      storeReady(false);
      onReadyRef.current(false);
    };
    // Mount-only: the api ref is a stable handle, and every live value the
    // callbacks read comes through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One effect per pin population, same dance: register any missing
  // images, then set or create the source and its symbol layer.
  const paintPins = (
    map: import("maplibre-gl").Map,
    layer: string,
    pins: ScoutPin[],
    dark: boolean,
    labeled: boolean,
  ) => {
    for (const pin of pins) {
      const id = pinImageId(pin.color, pin.phase, dark);
      if (map.hasImage(id)) continue;
      map.addImage(id, pinImage(pin.color, pin.phase, dark), { pixelRatio: 2 });
    }
    const collection = pinCollection(pins, dark);
    const source = map.getSource(layer) as import("maplibre-gl").GeoJSONSource | undefined;
    if (source) {
      source.setData(collection);
      // The label mode can flip after the layer exists (cards taking
      // over from a big sweep's labels and back).
      map.setLayoutProperty(layer, "text-field", labeled ? ["get", "label"] : "");
      return;
    }
    map.addSource(layer, { type: "geojson", data: collection });
    map.addLayer({
      id: layer,
      type: "symbol",
      source: layer,
      layout: {
        "icon-image": ["get", "icon"],
        "icon-anchor": "bottom",
        // Pins never hide each other: two branches of a chain on the same
        // block are exactly the comparison the search exists to make.
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "text-field": labeled ? ["get", "label"] : "",
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
  };

  const pins = props.pins;
  const saved = props.saved;
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // A style swap leaves the map styleless for a moment, and adding an
    // image, source, or layer in that window throws. Ticking a checkbox or
    // the minute clock mid-swap would land exactly there. Nothing is lost
    // by waiting: style.load bumps styleTick and runs this again.
    if (!map.isStyleLoaded()) return;
    const dark = document.documentElement.dataset.theme === "dark";
    // Saved first, so the search pins' layer ends up above it: a fresh
    // search should never hide under last week's saved pins. Saved pins
    // never carry symbol text (their card always does); search pins keep
    // labels only while the cards are not covering them.
    paintPins(map, SAVED_LAYER, saved, dark, false);
    paintPins(map, PIN_LAYER, pins, dark, !props.cardsCoverSearch);
  }, [pins, saved, ready, styleTick, props.cardsCoverSearch]);

  const route = props.route;
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    const dark = document.documentElement.dataset.theme === "dark";
    const legs = routeCollection(route);
    const drawn = map.getSource(ROUTE_LAYER) as import("maplibre-gl").GeoJSONSource | undefined;
    if (drawn) {
      drawn.setData(legs);
      return;
    }
    map.addSource(ROUTE_LAYER, { type: "geojson", data: legs });
    // Under the pins: the route is context for them, not a rival.
    const under = map.getLayer(SAVED_LAYER)
      ? SAVED_LAYER
      : map.getLayer(PIN_LAYER)
        ? PIN_LAYER
        : undefined;
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
    // The finger-sized twin over both visible lines, still under the pins.
    map.addLayer(
      {
        id: ROUTE_HIT_LAYER,
        type: "line",
        source: ROUTE_LAYER,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#000000",
          "line-width": 22,
          // Not zero: a fully transparent line can be culled out of hit
          // testing, and one that is one step above invisible cannot.
          "line-opacity": 0.001,
        },
      },
      under,
    );
  }, [route, ready, styleTick]);

  // Raw elements with inline sizing, not atoms: maplibre claims the inner
  // node, stamping its own class and `position: relative` from its
  // unlayered stylesheet, which outranks anything Panda emits for it.
  // Inline styles are the only declarations that survive the takeover. The
  // outer div is ours and anchors the card overlay.
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <PinCards map={liveMap} cards={props.cards} onPress={props.onCardPress} />
    </div>
  );
}
