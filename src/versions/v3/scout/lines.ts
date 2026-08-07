// The panel's query lines: what each one holds, and every way it can change.
// A reducer rather than a drawer of useStates because a line's fields move
// together (an arriving answer sets the status, both result sections, the
// notice, and the text they answer to in one step), and because the panel
// edits a LIST of them, where a stray partial update is how ghost results
// survive.

import type { GoogleHours } from "entities/place-search";
import { PIN_COLORS } from "entities/scout-maps";
import type { Finding, LineResults } from "./find-places";

export type LineStatus = "idle" | "searching" | "answered" | "failed";

export type ScoutLine = {
  id: string;
  color: string;
  typed: string;
  status: LineStatus;
  // The engine's hits ("Places") and the view sweep's ("In this view").
  // Two sections, each replaced wholesale by its own source's answers.
  places: Finding[];
  nearby: Finding[];
  // The slow half of the search is still out, so the rows on screen are
  // not yet the whole answer.
  sweeping: boolean;
  // Which findings are painted on the map. Ids rather than the findings
  // themselves, so a fresh search cannot leave a stale copy pinned.
  shownIds: string[];
  // The view sweep runs only when asked for, per query: typing anything
  // new withdraws the ask.
  sweepAsked: boolean;
  // Bumped by every refresh press. Clearing `query` alone would make a
  // second press while a search is already running a silent no-op, since
  // the value it clears is already empty.
  runId: number;
  // Whether the sweep's rows are showing. The engine's few hits are always
  // visible; it is the sweep's dozens of branches that fold away once
  // everything is painted.
  expanded: boolean;
  notice?: string;
  failure?: string;
};

const freshLine = (taken: string[]): ScoutLine => ({
  id: crypto.randomUUID(),
  color: PIN_COLORS.find((color) => !taken.includes(color)) ?? PIN_COLORS[taken.length % PIN_COLORS.length],
  typed: "",
  status: "idle",
  places: [],
  nearby: [],
  shownIds: [],
  sweeping: false,
  sweepAsked: false,
  runId: 0,
  expanded: true,
});

// The set of lines plus which one the results region speaks for: every
// input keeps searching, but only the ACTIVE line's results render (the
// map stays the aggregate of every line's ticked pins).
export type LineSet = { lines: ScoutLine[]; activeId: string };

export const openingLines = (): LineSet => {
  const first = freshLine([]);
  return { lines: [first], activeId: first.id };
};

export const lineFindings = (line: ScoutLine) => line.places.concat(line.nearby);

export type ScoutAction =
  | { name: "typed"; id: string; text: string }
  | { name: "searching"; id: string; query: string }
  | { name: "answered"; id: string; query: string; results: LineResults }
  | { name: "failed"; id: string; query: string; failure: string }
  | { name: "emptied"; id: string }
  | { name: "refreshed"; id: string }
  | { name: "toggled"; id: string; findingId: string }
  | { name: "allToggled"; id: string }
  | { name: "disclosed"; id: string }
  // An engine hit resolved its coordinates (and street address). Written
  // back into the finding so pins and flights can use them.
  | { name: "located"; id: string; findingId: string; lng: number; lat: number; address?: string }
  | { name: "locateFailed"; id: string; findingId: string }
  // The engine answered a ticked hit's hours ask, possibly empty-handed;
  // either way the asking is over.
  | { name: "hoursArrived"; id: string; findingId: string; hours?: GoogleHours }
  | { name: "added" }
  | { name: "removed"; id: string }
  // An input took focus: its results own the region below the inputs.
  | { name: "focused"; id: string }
  // The owner asked this query for the every-match view sweep.
  | { name: "sweepAsked"; id: string };

const withLine = (set: LineSet, id: string, change: (line: ScoutLine) => ScoutLine): LineSet => ({
  ...set,
  lines: set.lines.map((line) => (line.id === id ? change(line) : line)),
});

// An answer only counts if it answers what the line is currently asking.
// The searcher aborts a run it has superseded, but an abort that lands
// after the network already replied would otherwise let an overtaken
// result paint over a newer one.
const stillAsking = (line: ScoutLine, query: string) => line.typed.trim() === query;

// One search reports per source, and each report replaces the sections
// with FRESH copies of the findings. Facts resolved onto the old copies
// (coordinates, street address, fetched hours) carry over by id, or a
// ticked pin would lose its ground the moment the slow source landed.
const carryResolved = (fresh: Finding[], known: Finding[]) =>
  fresh.map((finding) => {
    const resolved = known.find(
      (entry) => entry.id === finding.id && entry.lng !== undefined,
    );
    if (!resolved) return finding;
    return {
      ...finding,
      lng: resolved.lng,
      lat: resolved.lat,
      address: resolved.address ?? finding.address,
      spotHours: resolved.spotHours,
      hoursKnown: resolved.hoursKnown,
    };
  });

export const scoutReducer = (set: LineSet, action: ScoutAction): LineSet => {
  switch (action.name) {
    case "typed":
      return withLine(set, action.id, (line) => ({
        ...line,
        typed: action.text,
        // A new phrase is a new question; the old sweep ask dies with it.
        sweepAsked: line.typed.trim() === action.text.trim() ? line.sweepAsked : false,
      }));
    case "searching":
      return withLine(set, action.id, (line) => ({
        ...line,
        status: "searching",
        failure: undefined,
      }));
    case "answered":
      return withLine(set, action.id, (line) => {
        if (!stillAsking(line, action.query)) return line;
        const arrived = action.results.places.concat(action.results.nearby);
        return {
          ...line,
          status: "answered",
          places: carryResolved(action.results.places, line.places),
          nearby: action.results.nearby,
          notice: action.results.notice,
          sweeping: action.results.sweeping,
          failure: undefined,
          // Ticks are kept for findings that came back, and dropped for
          // the rest. One search reports twice (the engine, then the map
          // sweep), so clearing here would un-tick whatever was picked
          // between the two. Ids identify a place, so a kept tick always
          // refers to the same place.
          shownIds: line.shownIds.filter((id) => arrived.some((finding) => finding.id === id)),
          // Open, or a search run after folding the last one away would
          // land its results behind a closed disclosure.
          expanded: true,
        };
      });
    case "failed":
      return withLine(set, action.id, (line) =>
        !stillAsking(line, action.query) ? line : {
          ...line,
          status: "failed",
          failure: action.failure,
          places: [],
          nearby: [],
          shownIds: [],
          sweeping: false,
        },
      );
    case "emptied":
      return withLine(set, action.id, (line) => ({
        ...line,
        status: "idle",
        places: [],
        nearby: [],
        shownIds: [],
        sweeping: false,
        notice: undefined,
        failure: undefined,
      }));
    case "refreshed":
      // A new run id is what makes the same words search again, now against
      // wherever the map is looking.
      return withLine(set, action.id, (line) => ({ ...line, runId: line.runId + 1 }));
    case "toggled":
      return withLine(set, action.id, (line) => {
        if (line.shownIds.includes(action.findingId)) {
          return { ...line, shownIds: line.shownIds.filter((id) => id !== action.findingId) };
        }
        // A tick resolves coordinates first, and the answer set can have
        // been replaced while that request was out. A finding no longer
        // in either section is a stale press, not a pin.
        if (!lineFindings(line).some((finding) => finding.id === action.findingId)) {
          return line;
        }
        return { ...line, shownIds: line.shownIds.concat(action.findingId) };
      });
    case "allToggled":
      // "Show all" is the sweep's control (paint every branch); the
      // engine's few hits keep their individual ticks either way.
      return withLine(set, action.id, (line) => {
        const nearbyIds = line.nearby.map((finding) => finding.id);
        // Intersected with the engine section rather than "everything not
        // in the sweep", so an id from a superseded answer can never ride
        // along forever.
        const engineTicks = line.shownIds.filter((id) =>
          line.places.some((finding) => finding.id === id),
        );
        const wasAll =
          nearbyIds.length > 0 && nearbyIds.every((id) => line.shownIds.includes(id));
        return {
          ...line,
          shownIds: wasAll ? engineTicks : engineTicks.concat(nearbyIds),
          // Turning everything on makes the rows redundant, so they fold
          // away; turning it back off is the start of picking individually,
          // which needs them.
          expanded: wasAll,
        };
      });
    case "disclosed":
      return withLine(set, action.id, (line) => ({ ...line, expanded: !line.expanded }));
    case "located":
      return withLine(set, action.id, (line) => ({
        ...line,
        places: line.places.map((finding) =>
          finding.id === action.findingId
            ? {
                ...finding,
                lng: action.lng,
                lat: action.lat,
                address: action.address ?? finding.address,
              }
            : finding,
        ),
      }));
    case "hoursArrived":
      return withLine(set, action.id, (line) => ({
        ...line,
        places: line.places.map((finding) =>
          finding.id === action.findingId
            ? { ...finding, spotHours: action.hours, hoursKnown: true }
            : finding,
        ),
      }));
    case "locateFailed":
      // A failure for a hit that a newer answer already replaced must not
      // stamp its notice over that newer answer.
      return withLine(set, action.id, (line) =>
        line.places.some((finding) => finding.id === action.findingId)
          ? { ...line, notice: "That place could not be resolved just now." }
          : line,
      );
    case "added": {
      // Appended BELOW: the fresh input lands under its predecessor,
      // right where the "+ Add place" row invited it, takes the active
      // slot (adding is an intent to type), and shift+tab walks back up
      // in reading order.
      const fresh = freshLine(set.lines.map((line) => line.color));
      return { lines: set.lines.concat(fresh), activeId: fresh.id };
    }
    case "removed": {
      // The last line never leaves: an empty panel offers no way back.
      if (set.lines.length === 1) return set;
      const at = set.lines.findIndex((line) => line.id === action.id);
      const lines = set.lines.filter((line) => line.id !== action.id);
      return {
        lines,
        // A removed active line hands the region to its next-door
        // neighbor rather than leaving it speaking for a ghost.
        activeId:
          set.activeId === action.id
            ? (lines[Math.min(at, lines.length - 1)] ?? lines[0]).id
            : set.activeId,
      };
    }
    case "focused":
      return set.lines.some((line) => line.id === action.id)
        ? { ...set, activeId: action.id }
        : set;
    case "sweepAsked":
      return withLine(set, action.id, (line) => ({ ...line, sweepAsked: true }));
  }
};
