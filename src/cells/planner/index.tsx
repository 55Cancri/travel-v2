import * as React from "react";
import { ArrowLeft, Block, Button, Input, Link, Plus, Text } from "atoms";
import { Center, Subtext } from "alloys";
import { haptics } from "entities/haptics";
import {
  addDay,
  addSegment,
  deleteSegment,
  moveSegment,
  renameSegment,
  renameTrip,
  segmentItemCount,
  useDb,
} from "entities/trips/store";
import type { ContainerRef, Item } from "entities/trips/types";
import { ItemEditor } from "./item-editor";
import { MapPane, type MapApi } from "./map-pane";
import { Section } from "./section";
import { useDragReorder } from "./use-drag-reorder";

// The planner: outline on the left, map on the right. Desktop shows both;
// mobile shows the outline with a floating Map toggle that swaps to a
// full-screen map (same MapPane instance — CSS repositions it, the map just
// resizes). Selecting a section header scopes the map; a selected day also
// draws its route.

type Scope =
  | { type: "segment" }
  | { type: "pool" }
  | { type: "day"; id: string };

const formatDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const nextDate = (lastIso: string | undefined) => {
  const base = lastIso ? new Date(`${lastIso}T00:00:00`) : new Date();
  if (lastIso) base.setDate(base.getDate() + 1);
  return base.toISOString().slice(0, 10);
};

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
  const [showMap, storeShowMap] = React.useState(false);
  const [highlightItemId, storeHighlightItemId] = React.useState<string | null>(null);
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

  const startResize = (event: React.PointerEvent) => {
    event.preventDefault();
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
  const routeItemIds = scope.type === "day" ? (db.days[scope.id]?.itemIds ?? null) : null;
  const scopeKey = `${segmentId ?? "-"}:${scope.type}:${scope.type === "day" ? scope.id : ""}#${scopeNonce}`;

  const highlight = (itemId: string) => {
    storeHighlightItemId(itemId);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    // Slightly outlives the rowLocate blink so the animation always
    // finishes before the state (and with it the animation rule) clears.
    highlightTimer.current = setTimeout(() => storeHighlightItemId(null), 1200);
  };

  // Pin click: highlight + scroll the row. ⌘-click additionally zooms to
  // street level; a plain click never moves the camera.
  const onPinClick = (itemId: string, zoom: boolean) => {
    highlight(itemId);
    document
      .getElementById(`ti-${itemId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (zoom) {
      const place = db.items[itemId]?.place;
      if (place) mapApi.current?.focusItem(itemId, place, 16.5);
    }
  };

  const onFly = (item: Item) => {
    if (!item.place) return;
    haptics.tap();
    mapApi.current?.focusItem(item.id, item.place, 16);
    storeShowMap(true);
  };

  const selectScope = (next: Scope) => {
    haptics.tap();
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
    haptics.tap();
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
      {/* ---- outline pane ----
          No pt on the scroller itself: sticky children pin below a scroll
          container's padding-top, which left a strip rows scrolled through
          above the "stuck" headers. Top spacing lives on the first child. */}
      <Block className="outline-pane" minH="0" overflowY="auto" px="md" pb="2xl" flow="md">
        <Block grid cols="auto 1fr auto" gap="sm" alignItems="center" pt="md">
          <Link
            to="/"
            onClick={() => haptics.tap()}
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

        {/* segment chips — tap to select, hold + drag to reorder */}
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
                  onPointerDown={(event) => onChipPointerDown(event, index, id)}
                  onPress={() => {
                    if (chipDragged.current) return;
                    haptics.tap();
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
                the right — like the trip header. */}
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
              highlightItemId={highlightItemId}
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
                highlightItemId={highlightItemId}
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

      {/* ---- map pane: side-by-side on desktop, full-screen overlay on mobile ---- */}
      <Block
        display={{ base: showMap ? "block" : "none", md: "block" }}
        position={{ base: "fixed", md: "relative" }}
        inset={{ base: "0", md: "auto" }}
        zIndex={{ base: 50, md: "auto" }}
        h={{ base: "100svh", md: "100%" }}
        borderLeftWidth={{ base: "0", md: "1px" }}
        borderLeftStyle="solid"
        borderLeftColor="border-muted"
      >
        <MapPane
          items={scopedItems}
          routeItemIds={routeItemIds}
          scopeKey={scopeKey}
          onPinClick={onPinClick}
          apiRef={mapApi}
        />
      </Block>

      {/* mobile map/list toggle */}
      <Button
        type="button"
        onPress={() => {
          haptics.tap();
          storeShowMap((prev) => !prev);
        }}
        hideFrom="md"
        px="md"
        py="xs"
        borderRadius="9999px"
        bg="surface-strong"
        color="text-on-strong"
        fontSize="sm"
        fontWeight={600}
        boxShadow="0 6px 18px rgba(0, 0, 0, 0.28)"
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
          zIndex: 60,
        }}
      >
        {showMap ? "☰ List" : "◉ Map"}
      </Button>

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
