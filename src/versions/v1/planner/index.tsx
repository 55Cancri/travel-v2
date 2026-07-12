import * as React from "react";
import { ArrowLeft, Block, Button, Input, Link, Plus, Text, haptic } from "atoms";
import { Center, Subtext } from "alloys";
import {
  addDay,
  addSegment,
  deleteSegment,
  insertItemAfter,
  moveSegment,
  renameSegment,
  renameTrip,
  segmentItemCount,
  updateItem,
  useDb,
} from "entities/trips/store";
import type { ContainerRef, Item, ItemKind, Place } from "entities/trips/types";
import { ItemEditor } from "./item-editor";
import { MapPane, type MapApi } from "./map-pane";
import { Section } from "./section";
import { useDragReorder } from "./use-drag-reorder";

// The planner: outline on the left, map on the right. Desktop shows both;
// mobile shows the outline with a floating Map toggle that swaps to a
// full-screen map (same MapPane instance, CSS repositions it, the map just
// resizes). Selecting a section header scopes the map; a selected day also
// draws its route.

type Scope =
  | { type: "segment" }
  | { type: "pool" }
  | { type: "day"; id: string };

// The sheet's resting heights, as translateY in svh on a 96svh panel:
// full shows almost everything, half splits with the map, peek leaves the
// grabber and trip header while the map takes the screen.
type SheetRest = "peek" | "half" | "full";
const SHEET_OFFSETS: Record<SheetRest, number> = { full: 4, half: 46, peek: 82 };

const DESKTOP_QUERY = "(min-width: 768px)";

function usePhone() {
  return React.useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(DESKTOP_QUERY);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    () => !window.matchMedia(DESKTOP_QUERY).matches,
    // Server-rendered documents assume desktop; the client corrects on
    // hydration before anything interactive happens.
    () => false,
  );
}

const formatDay = (iso: string) =>
  Temporal.PlainDate.from(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const nextDate = (lastIso: string | undefined) =>
  (lastIso
    ? Temporal.PlainDate.from(lastIso).add({ days: 1 })
    : Temporal.Now.plainDateISO()
  ).toString();

const LEFT_WIDTH_KEY = "travel2:leftw";
const clampWidth = (width: number) => Math.max(320, Math.min(780, width));

// City header is permanently stuck at the top of the outline; day headers
// stack directly beneath it (their sticky top = the city bar's height).
const CITY_BAR_HEIGHT = "2.75rem";

export function Planner(props: { tripId: string }) {
  const db = useDb();
  const trip = db.trips[props.tripId];
  const [activeSegmentId, storeActiveSegmentId] = React.useState<string | null>(null);
  const [scope, storeScope] = React.useState<Scope>({ type: "segment" });
  // Phone layout: the map owns the screen and the outline rides a
  // bottom sheet, dragged by its grabber between three resting heights.
  const phone = usePhone();
  const [sheetRest, storeSheetRest] = React.useState<SheetRest>("half");
  const [sheetDragPx, storeSheetDragPx] = React.useState<number | null>(null);
  const sheetDragPxRef = React.useRef(0);
  const sheetGrip = React.useRef<{ pointerId: number; startY: number; basePx: number } | null>(
    null,
  );
  const [highlightItemIds, storeHighlightItemIds] = React.useState<string[]>([]);
  const highlightTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapApi = React.useRef<MapApi | null>(null);
  const [tripName, storeTripName] = React.useState(trip?.name ?? "");
  // Resizable split (desktop): drag the divider, width persists.
  const [leftWidth, storeLeftWidth] = React.useState(() => {
    if (typeof localStorage === "undefined") return 460;
    const stored = Number(localStorage.getItem(LEFT_WIDTH_KEY));
    return Number.isFinite(stored) && stored > 0 ? clampWidth(stored) : 460;
  });
  const resizeFrom = React.useRef({ x: 0, width: 460 });
  // True while the divider is being dragged: the map pane holds its canvas
  // size until release so the map doesn't repaint-flash on every frame.
  const [paneResizing, storePaneResizing] = React.useState(false);

  const startResize = (event: React.PointerEvent) => {
    event.preventDefault();
    storePaneResizing(true);
    resizeFrom.current = { x: event.clientX, width: leftWidth };
    const controller = new AbortController();
    const { signal } = controller;
    window.addEventListener(
      "pointermove",
      (move) => {
        const next = clampWidth(resizeFrom.current.width + (move.clientX - resizeFrom.current.x));
        storeLeftWidth(next);
      },
      { signal },
    );
    const end = () => {
      controller.abort();
      storePaneResizing(false);
      storeLeftWidth((width) => {
        try {
          localStorage.setItem(LEFT_WIDTH_KEY, String(width));
        } catch (error) {
          // Private mode / quota: the width still applies, it just won't
          // survive a reload.
          console.warn("[planner] persist split width failed:", error);
        }
        return width;
      });
    };
    window.addEventListener("pointerup", end, { signal });
    window.addEventListener("pointercancel", end, { signal });
  };

  // Item editor (pencil) target.
  const [editing, storeEditing] = React.useState<{ itemId: string; ref: ContainerRef } | null>(
    null,
  );
  // Bumped on every header/chip click so re-clicking the SAME day recenters.
  const [scopeNonce, storeScopeNonce] = React.useState(0);

  const segmentId =
    activeSegmentId && trip?.segmentIds.includes(activeSegmentId)
      ? activeSegmentId
      : (trip?.segmentIds[0] ?? null);
  const segment = segmentId ? db.segments[segmentId] : null;

  // City chips reorder horizontally with the same spring engine as rows; drag
  // starts after a 6px move so a plain tap still selects.
  const segmentReorder = useDragReorder({
    ids: trip?.segmentIds ?? [],
    onCommit: (from, to) => {
      if (trip) moveSegment(trip.id, from, to);
    },
    axis: "x",
    measure: (target) => {
      const row = target.closest("[data-chip-row]") as HTMLElement | null;
      if (!row) return [];
      const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0;
      return Array.from(row.querySelectorAll(":scope > [data-chip]")).map(
        (el) => el.getBoundingClientRect().width + gap,
      );
    },
  });
  const chipPress = React.useRef<AbortController | null>(null);
  const chipDragged = React.useRef(false);

  const onChipPointerDown = (event: React.PointerEvent, index: number, id: string) => {
    const target = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startY = event.clientY;
    const controller = new AbortController();
    chipPress.current?.abort();
    chipPress.current = controller;
    const { signal } = controller;
    window.addEventListener(
      "pointermove",
      (move) => {
        if (Math.abs(move.clientX - startX) > 6 || Math.abs(move.clientY - startY) > 6) {
          controller.abort();
          chipDragged.current = true;
          segmentReorder.startDrag({ point: move.clientX, target }, index, id);
          window.addEventListener(
            "pointerup",
            () => setTimeout(() => (chipDragged.current = false), 0),
            { once: true },
          );
        }
      },
      { signal },
    );
    window.addEventListener("pointerup", () => controller.abort(), { signal });
  };
  const [segmentName, storeSegmentName] = React.useState(segment?.name ?? "");
  React.useEffect(() => {
    storeSegmentName(segment?.name ?? "");
  }, [segment?.id, segment?.name]);

  if (!trip) {
    return (
      <Block p="lg" flow="sm">
        <Text as="p">Trip not found.</Text>
        <Link to="/">← Back to trips</Link>
      </Block>
    );
  }

  const days = (segment?.dayIds ?? [])
    .map((id) => db.days[id])
    .filter((day) => day !== undefined);

  // Map scope → which items show as pins, and which day (if any) draws a route.
  const scopedItemIds =
    scope.type === "day"
      ? (db.days[scope.id]?.itemIds ?? [])
      : scope.type === "pool"
        ? (segment?.poolItemIds ?? [])
        : [
            ...(segment?.poolItemIds ?? []),
            ...days.flatMap((day) => day.itemIds),
          ];
  const scopedItems = scopedItemIds
    .map((id) => db.items[id])
    .filter((entry): entry is Item => entry !== undefined);
  const routeDay = scope.type === "day" ? (db.days[scope.id] ?? null) : null;
  const routeItemIds = routeDay?.itemIds ?? null;
  const scopeKey = `${segmentId ?? "-"}:${scope.type}:${scope.type === "day" ? scope.id : ""}#${scopeNonce}`;
  // Address suggestions rank near the city being planned: the segment's
  // first placed item anchors the geocoder bias.
  const anchorPlace = [...(segment?.poolItemIds ?? []), ...days.flatMap((day) => day.itemIds)]
    .map((id) => db.items[id]?.place)
    .find((place) => place !== undefined);
  const placeBias = anchorPlace ? { lng: anchorPlace.lng, lat: anchorPlace.lat } : null;

  const highlight = (itemIds: string | string[]) => {
    storeHighlightItemIds(Array.isArray(itemIds) ? itemIds : [itemIds]);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    // Slightly outlives the rowLocate blink so the animation always
    // finishes before the state (and with it the animation rule) clears.
    highlightTimer.current = setTimeout(() => storeHighlightItemIds([]), 1200);
  };

  // Step mode: which leg of the selected day's route is spotlighted on the
  // map (null = off). Stepping also walks the checklist: both endpoint
  // rows blink and the list scrolls to the leg's start.
  const [stepLeg, storeStepLeg] = React.useState<number | null>(null);
  const routeStops = (routeDay?.itemIds ?? [])
    .map((id) => db.items[id])
    .filter(
      (entry): entry is Item =>
        entry !== undefined && entry.place !== undefined && entry.status !== "cancelled",
    );
  const stepTo = (leg: number | null) => {
    storeStepLeg(leg);
    if (leg === null) return;
    const from = routeStops[leg];
    const to = routeStops[leg + 1];
    if (!from || !to) return;
    highlight([from.id, to.id]);
    document.getElementById(`ti-${from.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  // Arrow keys drive the stepper while it is active, unless focus is in a
  // text field (rows already use arrows to hop). Escape exits.
  React.useEffect(() => {
    if (stepLeg === null) return;
    const controller = new AbortController();
    window.addEventListener(
      "keydown",
      (event) => {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          stepTo(Math.min(routeStops.length - 2, stepLeg + 1));
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          stepTo(Math.max(0, stepLeg - 1));
        } else if (event.key === "Escape") {
          event.preventDefault();
          stepTo(null);
        }
      },
      { signal: controller.signal },
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepLeg, routeStops.length]);

  // Pin click: scroll the row into view, then blink it. The blink waits for
  // the smooth scroll to settle (its duration varies with distance, and a
  // blink that starts mid-scroll is half over before the row appears).
  // scrollend never shipped on WebKit, so settling is detected by watching
  // the row hold still for a few frames, with a cap for safety. An
  // already-visible row settles in ~3 frames, so it still blinks promptly.
  // ⌘-click additionally zooms to street level; a plain click never moves
  // the camera.
  const scrollWatch = React.useRef(0);
  const onPinClick = (itemId: string, zoom: boolean) => {
    // On the phone, the tapped pin's row lives in the sheet: a peeked
    // sheet rises to half so the blink is actually visible.
    storeSheetRest((rest) => (rest === "peek" ? "half" : rest));
    const row = document.getElementById(`ti-${itemId}`);
    if (row) {
      const scroller = row.closest(".outline-pane");
      if (phone && scroller instanceof HTMLElement) {
        // The sheet's lower half hangs off-screen at the half rest, so
        // container-centering parks the row at the phone's bottom edge.
        // Land it near the sheet's top instead, just under the sticky
        // city bar with a little context above.
        const rowTop =
          row.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop;
        scroller.scrollTo({ top: Math.max(0, rowTop - 110), behavior: "smooth" });
      } else {
        row.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      cancelAnimationFrame(scrollWatch.current);
      let restingTop = Infinity;
      let stillFrames = 0;
      const started = performance.now();
      const watch = () => {
        const top = row.getBoundingClientRect().top;
        stillFrames = top === restingTop ? stillFrames + 1 : 0;
        restingTop = top;
        if (stillFrames >= 3 || performance.now() - started > 1500) {
          highlight(itemId);
          return;
        }
        scrollWatch.current = requestAnimationFrame(watch);
      };
      scrollWatch.current = requestAnimationFrame(watch);
    } else {
      highlight(itemId);
    }
    if (zoom) {
      const place = db.items[itemId]?.place;
      if (place) mapApi.current?.focusItem(itemId, place, 16.5);
    }
  };

  const onFly = (item: Item) => {
    if (!item.place) return;
    mapApi.current?.focusItem(item.id, item.place, 16);
    // Flying to a place is a map moment: the sheet drops out of the way.
    storeSheetRest("peek");
  };

  // The sheet drags from its grabber only, so list scrolling and row
  // drag-reorder never fight it. Release snaps to the nearest rest.
  const onSheetGrab = (event: React.PointerEvent<HTMLDivElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (error) {
      // NotFoundError means the pointer already lifted (or is synthetic):
      // the drag still works uncaptured, it just loses the glide-off-the-
      // handle grace. Anything else is a real bug.
      if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
    }
    sheetGrip.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      basePx: (SHEET_OFFSETS[sheetRest] * window.innerHeight) / 100,
    };
    sheetDragPxRef.current = 0;
    storeSheetDragPx(0);
  };
  const onSheetDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const grip = sheetGrip.current;
    if (!grip || event.pointerId !== grip.pointerId) return;
    const svh = window.innerHeight / 100;
    const raw = grip.basePx + (event.clientY - grip.startY);
    const clamped = Math.min(
      Math.max(raw, SHEET_OFFSETS.full * svh),
      SHEET_OFFSETS.peek * svh,
    );
    sheetDragPxRef.current = clamped - grip.basePx;
    storeSheetDragPx(clamped - grip.basePx);
  };
  const onSheetRelease = (event: React.PointerEvent<HTMLDivElement>) => {
    const grip = sheetGrip.current;
    if (!grip || event.pointerId !== grip.pointerId) return;
    sheetGrip.current = null;
    const svh = window.innerHeight / 100;
    const finalSvh = (grip.basePx + sheetDragPxRef.current) / svh;
    let nearest: SheetRest = "half";
    for (const rest of ["peek", "half", "full"] as const) {
      if (Math.abs(SHEET_OFFSETS[rest] - finalSvh) < Math.abs(SHEET_OFFSETS[nearest] - finalSvh)) {
        nearest = rest;
      }
    }
    storeSheetRest(nearest);
    storeSheetDragPx(null);
  };

  // An overlay card's "Add to plan" lands in the segment's idea pool: not
  // yet scheduled, ready to drag onto a day.
  const addPlaceToPool = (place: Place, kind: ItemKind) => {
    if (!segmentId) return;
    const poolCount = segment?.poolItemIds.length ?? 0;
    const created = insertItemAfter({ type: "pool", id: segmentId }, poolCount - 1, kind);
    updateItem(created.id, { text: place.name, place });
  };

  const selectScope = (next: Scope) => {
    storeStepLeg(null);
    storeScope(next);
    storeScopeNonce((nonce) => nonce + 1);
  };

  const newSegment = () => {
    const id = addSegment(trip.id, "New city");
    if (id) {
      storeActiveSegmentId(id);
      storeScope({ type: "segment" });
    }
  };

  const newDay = () => {
    if (!segment) return;
    const last = days.at(-1)?.date;
    const id = addDay(segment.id, nextDate(last));
    if (id) storeScope({ type: "day", id });
  };

  // Delete a city: empty cities go silently; anything with items confirms.
  const removeCity = (id: string, name: string) => {
    const count = segmentItemCount(db, id);
    if (
      count > 0 &&
      !window.confirm(
        `Delete ${name} and everything in it? (${count} item${count === 1 ? "" : "s"})`,
      )
    ) {
      return;
    }
    deleteSegment(trip.id, id);
    storeActiveSegmentId(null);
    selectScope({ type: "segment" });
  };

  return (
    <Block
      grid
      h="100svh"
      gridTemplateColumns={{ base: "1fr", md: "var(--leftw) auto 1fr" }}
      style={
        {
          overscrollBehavior: "none",
          "--leftw": `${leftWidth}px`,
        } as React.CSSProperties
      }
    >
      {/* ---- outline: desktop column, phone bottom sheet ----
          The sheet is a fixed 96svh panel translated to one of three
          resting heights; the transform is live only on the phone, where
          the map owns the screen underneath. */}
      <Block
        position={{ base: "fixed", md: "static" }}
        left={{ base: "0", md: "auto" }}
        right={{ base: "0", md: "auto" }}
        bottom={{ base: "0", md: "auto" }}
        zIndex={{ base: 40, md: "auto" }}
        h={{ base: "96svh", md: "100%" }}
        minH="0"
        grid
        gridTemplateRows={{ base: "auto 1fr", md: "1fr" }}
        bg={{ base: "surface-page", md: "transparent" }}
        borderTopLeftRadius={{ base: "1rem", md: "0" }}
        borderTopRightRadius={{ base: "1rem", md: "0" }}
        boxShadow={{ base: "0 -8px 30px rgba(0, 0, 0, 0.25)", md: "none" }}
        style={{
          transform: phone
            ? `translateY(calc(${SHEET_OFFSETS[sheetRest]}svh + ${sheetDragPx ?? 0}px))`
            : undefined,
          transition:
            phone && sheetDragPx === null
              ? "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)"
              : undefined,
        }}
      >
        {/* grabber (phone only): the sheet's one drag surface. The bar
            sits low in its well so it reads inside the sheet, not glued
            to the rounded lip. */}
        <Block
          hideFrom="md"
          onPointerDown={onSheetGrab}
          onPointerMove={onSheetDragMove}
          onPointerUp={onSheetRelease}
          onPointerCancel={onSheetRelease}
          grid
          placeItems="center"
          h="2rem"
          pt="0.7rem"
          cursor="grab"
          style={{ touchAction: "none" }}
        >
          <Block as="span" w="2.25rem" h="0.25rem" borderRadius="9999px" bg="border-strong" />
        </Block>
        {/* No pt on the scroller itself: sticky children pin below a scroll
            container's padding-top, which left a strip rows scrolled through
            above the "stuck" headers. Top spacing lives on the first child. */}
        <Block className="outline-pane" minH="0" overflowY="auto" px="md" pb="2xl" flow="md">
        <Block grid cols="auto 1fr auto" gap="sm" alignItems="center" pt="md">
          <Link
            to="/"
            color="text-muted"
            display="grid"
            placeItems="center"
            w="1.5rem"
            h="2.5rem"
            ml="-0.35rem"
            textDecoration="none"
            aria-label="Back to trips"
            _hover={{ color: "text-primary" }}
          >
            <ArrowLeft size={20} />
          </Link>
          <Input
            value={tripName}
            aria-label="Trip name"
            onChange={(event) => storeTripName(event.currentTarget.value)}
            onBlur={() => renameTrip(trip.id, tripName)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            borderWidth="0"
            borderRadius="0"
            bg="transparent"
            px="0"
            py="xs"
            fontSize="xl"
            fontWeight={700}
            letterSpacing="-0.02em"
            color="text-primary"
            _focusWithin={{ borderColor: "transparent", boxShadow: "none" }}
          />
          {trip.dates ? (
            <Subtext fontSize="sm" whiteSpace="nowrap">
              {trip.dates}
            </Subtext>
          ) : null}
        </Block>

        {/* segment chips: tap to select, hold + drag to reorder */}
        <Block data-chip-row="" flex gap="xs" flexWrap="wrap" alignItems="center">
          {trip.segmentIds.map((id, index) => {
            const entry = db.segments[id];
            if (!entry) return null;
            const active = id === segmentId;
            return (
              <Block
                key={id}
                data-chip=""
                _motion={segmentReorder.motionFor(id)}
                position="relative"
              >
                <Button
                  type="button"
                  // The release after a chip drag still lands here as a
                  // press; the manual tap under haptic={false} keeps the
                  // buzz on real selections only.
                  haptic={false}
                  onPointerDown={(event) => onChipPointerDown(event, index, id)}
                  onPress={() => {
                    if (chipDragged.current) return;
                    haptic("tap");
                    storeActiveSegmentId(id);
                    selectScope({ type: "segment" });
                  }}
                  px="sm"
                  pr={active ? "1.7rem" : "sm"}
                  py="0.15lh"
                  borderRadius="9999px"
                  fontSize="sm"
                  fontWeight={550}
                  borderWidth="1px"
                  borderStyle="solid"
                  borderColor={active ? "surface-strong" : "border-muted"}
                  bg={active ? "surface-strong" : "transparent"}
                  color={active ? "text-on-strong" : "text-muted"}
                  style={{ touchAction: "none" }}
                  _hover={active ? {} : { color: "text-primary", borderColor: "border-strong" }}
                >
                  {entry.name}
                </Button>
                {active ? (
                  <Button
                    type="button"
                    aria-label={`Delete ${entry.name}`}
                    title={`Delete ${entry.name}`}
                    onPress={() => removeCity(id, entry.name)}
                    grid
                    placeItems="center"
                    position="absolute"
                    right="0.35rem"
                    top="50%"
                    w="1.05rem"
                    h="1.05rem"
                    p={0}
                    borderRadius="9999px"
                    color="text-on-strong"
                    opacity={0.6}
                    fontSize="xs"
                    lineHeight="1"
                    style={{ transform: "translateY(-50%)" }}
                    _hover={{ opacity: 1 }}
                  >
                    ✕
                  </Button>
                ) : null}
              </Block>
            );
          })}
          <Button
            type="button"
            onPress={newSegment}
            // Borderless, so left padding reads as pure distance from the
            // last chip; slim keeps the + tucked against the row.
            pl="0.15rem"
            pr="sm"
            py="0.15lh"
            borderRadius="9999px"
            fontSize="sm"
            fontWeight={550}
            bg="transparent"
            color="text-muted"
            columnGap="0.3rem"
            _hover={{ color: "text-primary" }}
            start={<Plus size={14} />}
          >
            City
          </Button>
        </Block>

        {segment ? (
          <Block>
            {/* City bar: ALWAYS stuck at the top of the outline (its containing
                block spans the whole segment), with the city's date range on
                the right, like the trip header. */}
            <Block
              position="sticky"
              top="0"
              zIndex={5}
              bg="surface-page"
              grid
              cols="1fr auto"
              gap="sm"
              alignItems="center"
              mb="xs"
              style={{ height: CITY_BAR_HEIGHT }}
            >
              <Input
                value={segmentName}
                aria-label="City name"
                onChange={(event) => storeSegmentName(event.currentTarget.value)}
                onBlur={() => renameSegment(segment.id, segmentName)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                borderWidth="0"
                borderRadius="0"
                bg="transparent"
                px="0"
                py="0"
                fontSize="2xl"
                fontWeight={700}
                letterSpacing="-0.02em"
                color="text-primary"
                _focusWithin={{ borderColor: "transparent", boxShadow: "none" }}
              />
              {days.length ? (
                <Subtext fontSize="sm" whiteSpace="nowrap">
                  {days.length > 1
                    ? `${formatDay(days[0].date)} – ${formatDay(days[days.length - 1].date)}`
                    : formatDay(days[0].date)}
                </Subtext>
              ) : null}
            </Block>

            <Block flow="lg">
            <Section
              containerRef={{ type: "pool", id: segment.id }}
              title="Ideas"
              subtitle="Not yet scheduled"
              selected={scope.type === "pool"}
              highlightItemIds={highlightItemIds}
              placeBias={placeBias}
              onSelect={() => selectScope({ type: "pool" })}
              onFly={onFly}
              onEdit={(item, ref) => storeEditing({ itemId: item.id, ref })}
            />

            {days.map((day, index) => (
              <Section
                key={day.id}
                containerRef={{ type: "day", id: day.id }}
                title={`Day ${index + 1}`}
                subtitle={formatDay(day.date)}
                selected={scope.type === "day" && scope.id === day.id}
                stickyHeader
                stickyTop={CITY_BAR_HEIGHT}
                highlightItemIds={highlightItemIds}
                placeBias={placeBias}
                onSelect={() => selectScope({ type: "day", id: day.id })}
                onFly={onFly}
                onEdit={(item, ref) => storeEditing({ itemId: item.id, ref })}
              />
            ))}

            <Button
              type="button"
              onPress={newDay}
              grid
              cols="auto auto 1fr"
              gap="sm"
              alignItems="center"
              w="100%"
              px="0"
              py="xs"
              bg="transparent"
              color="text-muted"
              textAlign="left"
              fontSize="md"
              fontWeight={500}
              _hover={{ color: "text-primary" }}
            >
              <Block as="span" w="1.5rem" h="1.5rem" aria-hidden="true" />
              <Center as="span" w="1.3rem" h="1.3rem">
                <Plus size={17} />
              </Center>
              <Text as="span" fontSize="md" fontWeight={500} color="inherit">
                Add day
              </Text>
            </Button>
            </Block>
          </Block>
        ) : (
          <Subtext as="p">Add a city to start planning.</Subtext>
        )}
        </Block>
      </Block>

      {/* ---- resizable divider (desktop only) ---- */}
      <Block
        hideBelow="md"
        onPointerDown={startResize}
        w="9px"
        h="100%"
        cursor="col-resize"
        grid
        placeItems="center"
        style={{ touchAction: "none" }}
        css={{
          "&:hover > span, &:active > span": { background: "var(--colors-accent)" },
        }}
      >
        <Block
          as="span"
          w="3px"
          h="3rem"
          borderRadius="9999px"
          bg="border-strong"
          transition="background-color 120ms ease"
        />
      </Block>

      {/* ---- map pane: side-by-side on desktop; on the phone it owns the
          screen and the outline sheet rides above it ---- */}
      <Block
        position={{ base: "fixed", md: "relative" }}
        inset={{ base: "0", md: "auto" }}
        zIndex={{ base: 0, md: "auto" }}
        h={{ base: "100svh", md: "100%" }}
        borderLeftWidth={{ base: "0", md: "1px" }}
        borderLeftStyle="solid"
        borderLeftColor="border-muted"
      >
        <MapPane
          items={scopedItems}
          routeItemIds={routeItemIds}
          routeDayId={routeDay?.id ?? null}
          routeDate={routeDay?.date ?? null}
          routeVias={routeDay?.vias ?? null}
          paneResizing={paneResizing}
          stepLeg={stepLeg}
          onStep={stepTo}
          scopeKey={scopeKey}
          onPinClick={onPinClick}
          onAddPlace={addPlaceToPool}
          apiRef={mapApi}
        />
      </Block>

      {editing ? (
        <ItemEditor
          itemId={editing.itemId}
          containerRef={editing.ref}
          onClose={() => storeEditing(null)}
        />
      ) : null}
    </Block>
  );
}
