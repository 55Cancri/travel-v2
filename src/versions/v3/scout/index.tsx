import * as React from "react";
import { Block, Compass, ListBullets, MagnifyingGlass } from "atoms";
import { IconButton } from "alloys";
import {
  activeMap,
  addEdge,
  clearEdges,
  PIN_COLORS,
  readScoutDb,
  rememberMapCamera,
  removeEdge,
  savePlace,
  useScoutDb,
  type MapCamera,
  type SavedPlace,
} from "entities/scout-maps";
import { useDb } from "entities/trips/store";
import { attachGoogleHours } from "./attach-google-hours";
import { MIN_SEARCH_ZOOM, type Finding, type SearchScope } from "./find-places";
import { lineFindings, openingLines, scoutReducer } from "./lines";
import { MapCanvas, type ScoutMapApi, type ScoutPin } from "./map-canvas";
import {
  googleTodayLine,
  openLine,
  openTag,
  openVerdict,
  placeOpenVerdict,
  useMinuteClock,
} from "./open-now";
import { EdgeDrawer } from "./edge-drawer";
import { MapsMenu } from "./maps-menu";
import type { PinCardFacts } from "./pin-cards";
import { PlaceDrawer, type PlaceDrawerTarget } from "./place-drawer";
import { QueryPanel } from "./query-panel";
import { planEdges, type RouteLeg } from "./route";
import { SearchDrawer } from "./search-drawer";
import { UiVersionPicker } from "../../picker";

// Generation v3: the map IS the screen, and the plan floats over it. A line
// in the panel asks the map a question ("media markt", or one address), and
// whichever answers get ticked become pins. The map itself is a DOCUMENT
// (entities/scout-maps): pins saved into it persist with a name and color,
// edges connect them into routed paths, and each map keeps its own camera.
//
// Connecting: Cmd-click drops a spot node and chains it to the previous
// node; connect mode (the compass toggle) does the same from plain presses
// on pins, which is the whole gesture on a phone. Both feed one graph.

// Where the map opens on a device that has never panned it. Trip data is the
// better guess than any hard-coded city, so the first place the plan already
// knows wins.
const FALLBACK_HOME = { lng: 4.89, lat: 52.37 };
const OPENING_ZOOM = 13;
// Anything closer than this and a result row is looking at the ground.
const FOCUS_ZOOM = 16;
// Past this many shown pins the persistent cards stop covering search
// results (a 120-branch sweep under cards would wallpaper the map) and
// fall back to the symbol labels; saved places keep their cards always.
const CARD_CAP = 12;

export function Scout() {
  const db = useDb();
  const scoutDb = useScoutDb();
  const map = activeMap(scoutDb);
  const [lines, dispatch] = React.useReducer(scoutReducer, undefined, openingLines);
  const now = useMinuteClock();
  const [mapReady, storeMapReady] = React.useState(false);
  const [route, storeRoute] = React.useState<RouteLeg[]>([]);
  const [routeNotice, storeRouteNotice] = React.useState<string | null>(null);
  const [connecting, storeConnecting] = React.useState(false);
  // One surface open at a time: the phone's search sheet, the maps menu,
  // a place's editor, or a connection's editor.
  const [openSheet, storeOpenSheet] = React.useState<
    | { face: "search" }
    | { face: "maps" }
    | { face: "place"; target: PlaceDrawerTarget }
    | { face: "edge"; edgeId: string }
    | null
  >(null);
  const mapApiRef = React.useRef<ScoutMapApi | null>(null);
  // The tail of the chain being connected: the next connected node draws
  // an edge from here. Dropped when connect mode ends or the map switches.
  const lastNodeRef = React.useRef<string | null>(null);

  const placed = Object.values(db.items).find((item) => item.place);
  const home = placed?.place ?? FALLBACK_HOME;

  // The route follows the document: every edge or endpoint change re-asks
  // the routers, and a run superseded mid-flight is abandoned rather than
  // allowed to paint a stale path over the newer one. The signature keys
  // the effect to routing-relevant facts ONLY, because the map object also
  // changes identity on renames and camera rests, and a pan must not
  // replan the route.
  const routeSig = JSON.stringify([
    map.id,
    map.edges,
    map.edges
      .flatMap((edge) => [map.places[edge.fromId], map.places[edge.toId]])
      .map((place) => (place ? [place.id, place.lng, place.lat] : null)),
  ]);
  React.useEffect(() => {
    const snapshot = readScoutDb();
    const current = activeMap(snapshot);
    if (current.edges.length === 0) {
      storeRoute([]);
      storeRouteNotice(null);
      return;
    }
    const controller = new AbortController();
    // The previous plan's notice belongs to the previous graph, so it goes
    // now rather than lingering over a route being redrawn. The drawn line
    // stays until the new one lands, which reads as the route catching up
    // rather than blinking out on every added edge.
    storeRouteNotice(null);
    planEdges(
      current.places,
      current.edges,
      Temporal.Now.plainDateISO().toString(),
      controller.signal,
    )
      .then((plan) => {
        if (controller.signal.aborted) return;
        storeRoute(plan.legs);
        storeRouteNotice(plan.notice ?? null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("[scout] route planning failed:", error);
        // The old line would otherwise sit under the failure notice as if
        // it still described this graph.
        storeRoute([]);
        storeRouteNotice("The route could not be planned.");
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSig]);

  // Switching maps lands on the other map's own camera, and a chain never
  // crosses documents.
  const mapIdRef = React.useRef(map.id);
  React.useEffect(() => {
    if (mapIdRef.current === map.id) return;
    mapIdRef.current = map.id;
    lastNodeRef.current = null;
    const camera = map.camera ?? { ...home, zoom: OPENING_ZOOM };
    mapApiRef.current?.jumpTo(camera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id]);

  const scopeOf = (): SearchScope | null => {
    const api = mapApiRef.current;
    const view = api?.view();
    const bias = api?.center();
    if (!api || !view || !bias) return null;
    return { view, bias, scanMap: api.zoom() >= MIN_SEARCH_ZOOM };
  };

  const focusFinding = (finding: Finding) => {
    const api = mapApiRef.current;
    // The line resolves an engine hit before reporting it here, so bare
    // coordinates mean a stale press on a hit that failed to resolve.
    if (!api || finding.lng === undefined || finding.lat === undefined) return;
    api.flyTo({ lng: finding.lng, lat: finding.lat }, Math.max(api.zoom(), FOCUS_ZOOM));
  };

  // Draws an edge from the chain's tail to this place and makes it the new
  // tail. The first connected node has nothing to connect FROM and only
  // starts the chain.
  const chainTo = (placeId: string) => {
    const tail = lastNodeRef.current;
    if (tail && tail !== placeId) addEdge(map.id, tail, placeId);
    lastNodeRef.current = placeId;
  };

  // A ticked search pin entering the graph becomes a saved place first
  // (an edge needs endpoints that outlive the search), keeping the color
  // it was found under. A pin already promoted once reuses its place.
  const promoteFinding = (lineColor: string, finding: Finding) => {
    if (finding.lng === undefined || finding.lat === undefined) return null;
    const known = Object.values(activeMap(readScoutDb()).places).find(
      (place) => place.sourceRef === finding.id,
    );
    if (known) return known.id;
    const placeId = savePlace(map.id, {
      label: finding.name,
      color: lineColor,
      lng: finding.lng,
      lat: finding.lat,
      address: finding.address,
      hours: finding.hours ? { kind: "osm", raw: finding.hours } : undefined,
      sourceRef: finding.id,
    });
    // An engine hit knows no hours until asked; entering a document is
    // the one moment that ask is worth the priciest tier.
    if (finding.placeId) attachGoogleHours(map.id, placeId, finding.placeId);
    return placeId;
  };

  const onSearchPinPress = (pinId: string) => {
    const splitAt = pinId.indexOf(":");
    const lineId = pinId.slice(0, splitAt);
    const findingId = pinId.slice(splitAt + 1);
    const line = lines.find((entry) => entry.id === lineId);
    const finding = line ? lineFindings(line).find((entry) => entry.id === findingId) : undefined;
    if (!line || !finding) return;
    if (connecting) {
      const placeId = promoteFinding(line.color, finding);
      if (placeId) chainTo(placeId);
      return;
    }
    storeOpenSheet({
      face: "place",
      target: { kind: "finding", lineColor: line.color, finding },
    });
  };

  const onSavedPinPress = (placeId: string) => {
    if (connecting) {
      chainTo(placeId);
      return;
    }
    storeOpenSheet({ face: "place", target: { kind: "saved", placeId } });
  };

  // Cmd-click on bare map: a spot node, generically named, chained like
  // any other node. Desktop's fast path for sketching a route.
  const onSpotDrop = (at: { lng: number; lat: number }) => {
    const current = activeMap(readScoutDb());
    const placeId = savePlace(map.id, {
      label: `Spot ${current.placeOrder.length + 1}`,
      color: PIN_COLORS[current.placeOrder.length % PIN_COLORS.length],
      lng: at.lng,
      lat: at.lat,
    });
    chainTo(placeId);
  };

  const toggleConnecting = () => {
    storeConnecting((was) => {
      // Leaving connect mode ends the chain; the next session starts one.
      if (was) lastNodeRef.current = null;
      return !was;
    });
  };

  const pins: ScoutPin[] = lines.flatMap((line) =>
    lineFindings(line).flatMap((finding) => {
      // An engine hit that has never been interacted with has no
      // coordinates yet and cannot stand on the map.
      if (
        !line.shownIds.includes(finding.id) ||
        finding.lng === undefined ||
        finding.lat === undefined
      ) {
        return [];
      }
      const verdict = openVerdict(finding, now);
      return [
        {
          // Two lines can find the same shop; each keeps its own pin in its
          // own color rather than one of them silently winning.
          id: `${line.id}:${finding.id}`,
          lng: finding.lng,
          lat: finding.lat,
          color: line.color,
          phase: verdict.phase,
          name: finding.name,
          tag: openTag(verdict),
          notes: [openLine(verdict), finding.category, finding.address, finding.phone].filter(
            (note): note is string => Boolean(note),
          ),
          website: finding.website,
        },
      ];
    }),
  );

  const saved: ScoutPin[] = map.placeOrder.flatMap((placeId) => {
    const place: SavedPlace | undefined = map.places[placeId];
    if (!place) return [];
    const verdict = placeOpenVerdict(place, now);
    return [
      {
        id: place.id,
        lng: place.lng,
        lat: place.lat,
        color: place.color,
        phase: verdict.phase,
        name: place.label,
        tag: openTag(verdict),
        notes: [openLine(verdict), place.address].filter((note): note is string =>
          Boolean(note),
        ),
      },
    ];
  });

  // The persistent mini tooltips: every saved place gets one, and shown
  // search pins join while the total stays readable. The hours line is
  // the live verdict when the next flip is near, else today's schedule.
  const cardsCoverSearch = saved.length + pins.length <= CARD_CAP;
  const cards: PinCardFacts[] = map.placeOrder
    .flatMap((placeId): PinCardFacts[] => {
      const place = map.places[placeId];
      if (!place) return [];
      const verdict = placeOpenVerdict(place, now);
      const todayLine =
        place.hours?.kind === "google" ? googleTodayLine(place.hours, now) : null;
      return [
        {
          id: place.id,
          lng: place.lng,
          lat: place.lat,
          color: place.color,
          title: place.label,
          hoursLine: openLine(verdict) ?? todayLine,
          closedNow: verdict.phase === "closed",
        },
      ];
    })
    .concat(
      cardsCoverSearch
        ? pins.map((pin) => ({
            id: pin.id,
            lng: pin.lng,
            lat: pin.lat,
            color: pin.color,
            title: pin.name,
            hoursLine: pin.tag,
            closedNow: pin.phase === "closed",
          }))
        : [],
    );

  const onCardPress = (id: string) => {
    // Search-pin cards carry the line-scoped id; a bare id is a saved
    // place.
    if (id.includes(":")) onSearchPinPress(id);
    else onSavedPinPress(id);
  };

  const opening: MapCamera = map.camera ?? { ...home, zoom: OPENING_ZOOM };

  return (
    <Block position="fixed" inset="0" overflow="hidden">
      <MapCanvas
        pins={pins}
        saved={saved}
        route={route}
        cards={cards}
        cardsCoverSearch={cardsCoverSearch}
        onCardPress={onCardPress}
        onSearchPinPress={onSearchPinPress}
        onSavedPinPress={onSavedPinPress}
        onEdgePress={(edgeId) => storeOpenSheet({ face: "edge", edgeId })}
        onSpotDrop={onSpotDrop}
        opening={opening}
        onCameraRest={(camera) => rememberMapCamera(readScoutDb().activeMapId, camera)}
        onReady={storeMapReady}
        apiRef={mapApiRef}
      />
      {/* The floating panel is the wide-window search surface; a phone
          reaches the same lines through the search sheet instead. */}
      <Block display={{ base: "none", md: "block" }}>
        <QueryPanel
          lines={lines}
          scopeOf={scopeOf}
          dispatch={dispatch}
          onFocusFinding={focusFinding}
          now={now}
          mapReady={mapReady}
          edgeCount={map.edges.length}
          routeNotice={routeNotice}
          onClearRoute={() => clearEdges(map.id)}
          onUndoEdge={() => {
            const edges = activeMap(readScoutDb()).edges;
            const last = edges.at(-1);
            if (last) removeEdge(map.id, last.id);
          }}
        />
      </Block>
      {/* The maps menu lives top-left on every width (it is the only way
          to switch documents). */}
      <Block position="absolute" top="sm" insetInlineStart="sm" zIndex={20}>
        <Block
          display={{ base: "block", md: "none" }}
          borderRadius="sm"
          bg="surface-panel"
          boxShadow="0 2px 10px rgba(0, 0, 0, 0.18)"
        >
          <IconButton
            type="button"
            aria-label="Your maps"
            onPress={() => storeOpenSheet({ face: "maps" })}
          >
            <ListBullets size={18} />
          </IconButton>
        </Block>
      </Block>
      {/* The way out of a generation that has gone wrong, kept clear of the
          map's own controls in the opposite corner; the connect toggle,
          the phone's search button, and the wide-window maps button ride
          under it. */}
      <Block
        position="absolute"
        top="sm"
        insetInlineEnd="sm"
        zIndex={20}
        grid
        gap="xs"
        justifyItems="end"
      >
        <Block
          borderRadius="sm"
          bg="surface-panel"
          boxShadow="0 2px 10px rgba(0, 0, 0, 0.18)"
        >
          <UiVersionPicker />
        </Block>
        <Block
          borderRadius="sm"
          bg={connecting ? "accent" : "surface-panel"}
          color={connecting ? "text-on-accent" : "text-primary"}
          boxShadow="0 2px 10px rgba(0, 0, 0, 0.18)"
        >
          <IconButton
            type="button"
            aria-label={connecting ? "Stop connecting places" : "Connect places into a route"}
            aria-pressed={connecting}
            onPress={toggleConnecting}
          >
            <Compass size={18} />
          </IconButton>
        </Block>
        <Block
          display={{ base: "block", md: "none" }}
          borderRadius="sm"
          bg="surface-panel"
          boxShadow="0 2px 10px rgba(0, 0, 0, 0.18)"
        >
          <IconButton
            type="button"
            aria-label="Search the map"
            onPress={() => storeOpenSheet({ face: "search" })}
          >
            <MagnifyingGlass size={18} />
          </IconButton>
        </Block>
        <Block
          display={{ base: "none", md: "block" }}
          borderRadius="sm"
          bg="surface-panel"
          boxShadow="0 2px 10px rgba(0, 0, 0, 0.18)"
        >
          <IconButton
            type="button"
            aria-label="Your maps"
            onPress={() => storeOpenSheet({ face: "maps" })}
          >
            <ListBullets size={18} />
          </IconButton>
        </Block>
      </Block>

      <SearchDrawer
        open={openSheet?.face === "search"}
        onClose={() => storeOpenSheet(null)}
        lines={lines}
        scopeOf={scopeOf}
        dispatch={dispatch}
        onFocusFinding={focusFinding}
        now={now}
        mapReady={mapReady}
        edgeCount={map.edges.length}
        routeNotice={routeNotice}
        onClearRoute={() => clearEdges(map.id)}
        onUndoEdge={() => {
          const edges = activeMap(readScoutDb()).edges;
          const last = edges.at(-1);
          if (last) removeEdge(map.id, last.id);
        }}
      />
      <MapsMenu open={openSheet?.face === "maps"} onClose={() => storeOpenSheet(null)} />
      <PlaceDrawer
        mapId={map.id}
        target={openSheet?.face === "place" ? openSheet.target : null}
        now={now}
        onClose={() => storeOpenSheet(null)}
      />
      <EdgeDrawer
        mapId={map.id}
        edgeId={openSheet?.face === "edge" ? openSheet.edgeId : null}
        onClose={() => storeOpenSheet(null)}
      />
    </Block>
  );
}
