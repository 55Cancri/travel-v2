import * as React from "react";
import { Block, Button, CaretRight, MagnifyingGlass, Text } from "atoms";
import { Checkbox, ErrorNote, Eyebrow, IconButton } from "alloys";
import { fetchPlaceSpot } from "entities/place-search";
import { noteSearch } from "entities/scout-maps";
import type { Finding } from "../find-places";
import type { ScoutAction, ScoutLine } from "../lines";
import { ResultRow } from "./result-row";

// The results region: what the ACTIVE line found, below the whole input
// group. Exactly one of these is mounted per surface, which is also why
// the surface-wide keyboard lives here: arrows and Enter walk these rows
// from anywhere (a query input included, since focusing one makes its
// line the active one), j/k only from outside editable fields.
//
// Results render as two sections. "Places" is the search engine's few,
// already ranked hits. "In this view" is the map sweep's branch list,
// which exists only after its ghost row is pressed: the sweep is slow,
// view-bound, and uninvited it read as noise beside the engine's
// answers. Engine hits are born without coordinates: the first
// interaction with one (tick, or press to fly) resolves them through
// the details route, then acts.

export function QueryResults(props: {
  line: ScoutLine;
  dispatch: (action: ScoutAction) => void;
  onFocusFinding: (finding: Finding) => void;
  now: Temporal.Instant;
}) {
  const line = props.line;
  const isSearching = line.status === "searching";

  // An engine hit with coordinates already, or resolved on the spot. Null
  // means the resolve failed, which the line's notice already says.
  const located = async (finding: Finding): Promise<Finding | null> => {
    if (finding.lng !== undefined && finding.lat !== undefined) return finding;
    if (!finding.placeId) return null;
    try {
      const spot = await fetchPlaceSpot(finding.placeId, false);
      props.dispatch({
        name: "located",
        id: line.id,
        findingId: finding.id,
        lng: spot.lng,
        lat: spot.lat,
        address: spot.address,
      });
      return { ...finding, lng: spot.lng, lat: spot.lat, address: spot.address ?? finding.address };
    } catch (error) {
      console.warn("[scout] place resolve failed:", error);
      props.dispatch({ name: "locateFailed", id: line.id, findingId: finding.id });
      return null;
    }
  };

  // Ticks whose resolve is still in flight. A double tap would otherwise
  // pass the "not shown yet" test twice, queue two toggles behind one
  // network answer, and the pin would flash on and straight back off.
  const tickingRef = React.useRef(new Set<string>());

  // Resolves the finding and puts its pin on the map, once. Null when
  // the resolve failed or the same finding is already mid-flight.
  const ensureShown = async (finding: Finding): Promise<Finding | null> => {
    if (tickingRef.current.has(finding.id)) return null;
    tickingRef.current.add(finding.id);
    try {
      const resolved = await located(finding);
      if (!resolved) return null;
      // Acting on a result is what makes a search a memory: recording
      // every debounced keystroke instead would fill the recents with
      // fragments of phrases still being typed.
      noteSearch(line.typed);
      props.dispatch({ name: "toggled", id: line.id, findingId: finding.id });
      // A pin on the map wants its times: the priciest lookup flavor,
      // spent only on a deliberate tick and answered onto the card as
      // soon as it lands ("Loading times..." until then).
      if (finding.placeId && !finding.hoursKnown) {
        fetchPlaceSpot(finding.placeId, true)
          .then((spot) => {
            props.dispatch({
              name: "hoursArrived",
              id: line.id,
              findingId: finding.id,
              hours: spot.hours,
            });
          })
          .catch((error: unknown) => {
            console.warn("[scout] hours fetch failed:", error);
            // Answered empty-handed: the card's loading line must end.
            props.dispatch({ name: "hoursArrived", id: line.id, findingId: finding.id });
          });
      }
      return resolved;
    } finally {
      tickingRef.current.delete(finding.id);
    }
  };

  const toggleFinding = (finding: Finding) => {
    // Unticking never needs coordinates; ticking pins, which does.
    if (line.shownIds.includes(finding.id)) {
      props.dispatch({ name: "toggled", id: line.id, findingId: finding.id });
      return;
    }
    ensureShown(finding);
  };

  // A row press means "show me this place": the pin drops AND the camera
  // goes. The checkbox stays the way to take a pin back off.
  const focusFinding = async (finding: Finding) => {
    if (!line.shownIds.includes(finding.id)) {
      const shown = await ensureShown(finding);
      if (shown) props.onFocusFinding(shown);
      return;
    }
    const resolved = await located(finding);
    if (!resolved) return;
    noteSearch(line.typed);
    props.onFocusFinding(resolved);
  };

  const nearbyIds = line.nearby.map((finding) => finding.id);
  const allNearbyShown =
    nearbyIds.length > 0 && nearbyIds.every((id) => line.shownIds.includes(id));

  // The keyboard highlight walks the VISIBLE rows (a folded sweep list is
  // not walkable); -1 is "nothing highlighted". A fresh answer resets it,
  // keyed on the row IDS rather than the arrays, because resolving a
  // hit's coordinates replaces the array without changing what the rows
  // ARE, and resetting then would wipe the highlight in the middle of
  // check-then-uncheck.
  const [activeIdx, storeActiveIdx] = React.useState(-1);
  const walkable = line.expanded ? line.places.concat(line.nearby) : line.places;
  const walkableSig = `${line.id}|${walkable.map((finding) => finding.id).join("|")}`;
  React.useEffect(() => {
    storeActiveIdx(-1);
  }, [walkableSig]);

  // Up clamps at the first row rather than walking off it; from nothing,
  // either direction lands on row one.
  const stepHighlight = (delta: 1 | -1) => {
    if (walkable.length === 0) return;
    storeActiveIdx((idx) =>
      delta === 1 ? Math.min(idx + 1, walkable.length - 1) : Math.max(idx - 1, 0),
    );
  };

  // Enter is one action, not two: an unchecked row checks AND flies, a
  // checked row unchecks and holds the camera still.
  const actOnActive = () => {
    const finding = walkable[activeIdx];
    if (!finding) return false;
    if (line.shownIds.includes(finding.id)) {
      props.dispatch({ name: "toggled", id: line.id, findingId: finding.id });
      return true;
    }
    ensureShown(finding).then((shown) => {
      if (shown) props.onFocusFinding(shown);
    });
    return true;
  };

  // The surface-wide walk. Arrows and Enter also work from inside a QUERY
  // input (focusing one already made its line the active one here); j/k
  // only outside editable fields, where letters are letters.
  const surfaceKeysRef = React.useRef<(event: KeyboardEvent) => void>(() => {});
  surfaceKeysRef.current = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement;
    const inQueryInput = target.getAttribute?.("aria-label") === "What to find on the map";
    const editable =
      target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    if (editable && !inQueryInput) return;
    if (event.key === "ArrowDown" || (!editable && event.key === "j")) {
      event.preventDefault();
      stepHighlight(1);
      return;
    }
    if (event.key === "ArrowUp" || (!editable && event.key === "k")) {
      event.preventDefault();
      stepHighlight(-1);
      return;
    }
    if (event.key === "Enter" && actOnActive()) event.preventDefault();
  };
  React.useEffect(() => {
    const controller = new AbortController();
    document.addEventListener("keydown", (event) => surfaceKeysRef.current(event), {
      signal: controller.signal,
    });
    return () => controller.abort();
  }, []);

  return (
    <Block>
      {/* The status line owns a RESERVED row under the inputs: searching,
          sweeping, failures, and the empty verdict all speak here, and
          when nothing does the space stays, so results never jump. */}
      <Block minH="1lh">
        {line.failure ? (
          // A failed line keeps the words that failed, so retyping them
          // is not a change and would never search again. The retry
          // lives here because the results block below it does not
          // exist to hold one.
          <Block grid cols="1fr auto" alignItems="center" gap="sm">
            <ErrorNote fontSize="xs">{line.failure}</ErrorNote>
            <IconButton
              type="button"
              aria-label="Try this search again"
              onPress={() => props.dispatch({ name: "refreshed", id: line.id })}
            >
              <MagnifyingGlass size={16} />
            </IconButton>
          </Block>
        ) : (
          <Text as="p" fontSize="xs" color="text-muted">
            {line.notice ??
              (isSearching
                ? "Looking for suggestions..."
                : line.status === "answered" &&
                    !line.sweeping &&
                    line.places.length === 0 &&
                    line.nearby.length === 0
                  ? // Not while a sweep is still out: "nothing anywhere"
                    // beside a spinner would contradict itself.
                    "Nothing anywhere by that name."
                  : "")}
          </Text>
        )}
      </Block>

      {line.places.length > 0 ? (
        <Block pt="xs">
          <Eyebrow>Places</Eyebrow>
          {line.places.map((finding, i) => (
            <ResultRow
              key={finding.id}
              finding={finding}
              checked={line.shownIds.includes(finding.id)}
              active={activeIdx === i}
              now={props.now}
              onToggle={() => toggleFinding(finding)}
              onFocus={() => focusFinding(finding)}
            />
          ))}
        </Block>
      ) : null}

      {/* The sweep is invited, never assumed: a slow every-match scan of
          the visible map only runs for a query whose owner pressed this. */}
      {line.status === "answered" && !line.sweepAsked && line.nearby.length === 0 ? (
        <Button
          type="button"
          onPress={() => props.dispatch({ name: "sweepAsked", id: line.id })}
          w="100%"
          minW={0}
          justifyContent="start"
          columnGap="xs"
          px={0}
          py="xs"
          borderRadius="xs"
          color="text-muted"
          _hover={{ "@media (hover: hover)": { color: "text-primary" } }}
        >
          <MagnifyingGlass size={14} />
          <Text as="span" fontSize="xs" fontWeight="550">
            Find every match in this view
          </Text>
        </Button>
      ) : null}

      {line.nearby.length > 0 ? (
        <Block pt="xs">
          <Block grid cols="auto 1fr auto" alignItems="center" gap="sm">
            <Checkbox
              checked={allNearbyShown}
              onToggle={() => props.dispatch({ name: "allToggled", id: line.id })}
              label="Show everything in this view on the map"
            />
            {/* The caret and the count are one target, the way a disclosure
                row usually is: a bare caret is a small thing to hit. */}
            <Button
              type="button"
              aria-expanded={line.expanded}
              onPress={() => props.dispatch({ name: "disclosed", id: line.id })}
              justifyContent="start"
              gap="xs"
              w="100%"
              minH="xl"
              px={0}
              borderRadius="xs"
              color="text-muted"
              _hover={{ "@media (hover: hover)": { color: "text-primary" } }}
            >
              <Block
                display="grid"
                placeItems="center"
                // A rotation, not a second glyph: the same caret turns, so
                // the two positions can never drift apart.
                _motion={{
                  // Starts where it belongs instead of swinging into place
                  // the first time a result list appears.
                  initial: false,
                  animate: { rotate: line.expanded ? 90 : 0 },
                  transition: { duration: 0.2, ease: "easeOut" },
                }}
              >
                <CaretRight size={14} />
              </Block>
              <Text fontSize="xs" fontWeight="550">
                In this view ({line.nearby.length})
              </Text>
            </Button>
            <IconButton
              type="button"
              aria-label="Search this view again"
              onPress={() => props.dispatch({ name: "refreshed", id: line.id })}
            >
              <MagnifyingGlass size={16} />
            </IconButton>
          </Block>
          {/* The rows stay mounted and the box closes over them, rather
              than unmounting them on the way out. A disclosure that
              animates its own removal has to keep rendering the old props
              while it goes, so the row a press just changed would visibly
              revert as it folded away. */}
          <Block
            // The height tween needs a clipped box, or the rows spill out of
            // the container while it closes. The inner box is what scrolls,
            // so the clip and the scroll never fight.
            overflow="hidden"
            // inert, not just aria-hidden: a zero-height box still holds
            // focusable checkboxes, and tabbing into rows nobody can see is
            // worse than not announcing them.
            inert={!line.expanded}
            aria-hidden={!line.expanded}
            _motion={{
              initial: false,
              animate: {
                height: line.expanded ? "auto" : 0,
                opacity: line.expanded ? 1 : 0,
              },
              transition: line.expanded
                ? { duration: 0.3, ease: "easeOut" }
                : { duration: 0.2, ease: "easeIn" },
            }}
          >
            {/* A chain search returns dozens of branches. Capping the list
                and scrolling inside it keeps the inputs above reachable,
                instead of burying them under this one's answers. */}
            <Block maxH="15rem" overflowY="auto">
              {line.nearby.map((finding, i) => (
                <ResultRow
                  key={finding.id}
                  finding={finding}
                  checked={line.shownIds.includes(finding.id)}
                  active={activeIdx === line.places.length + i}
                  now={props.now}
                  onToggle={() => toggleFinding(finding)}
                  onFocus={() => focusFinding(finding)}
                />
              ))}
            </Block>
          </Block>
        </Block>
      ) : null}
    </Block>
  );
}
