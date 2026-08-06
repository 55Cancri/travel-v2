// The panel's query lines: what each one holds, and every way it can change.
// A reducer rather than a drawer of useStates because a line's fields move
// together (an arriving answer sets the status, both result sections, the
// notice, and the text they answer to in one step), and because the panel
// edits a LIST of them, where a stray partial update is how ghost results
// survive.

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
  runId: 0,
  expanded: true,
});

export const openingLines = () => [freshLine([])];

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
  | { name: "added" }
  | { name: "removed"; id: string };

const withLine = (lines: ScoutLine[], id: string, change: (line: ScoutLine) => ScoutLine) =>
  lines.map((line) => (line.id === id ? change(line) : line));

// An answer only counts if it answers what the line is currently asking.
// The searcher aborts a run it has superseded, but an abort that lands
// after the network already replied would otherwise let an overtaken
// result paint over a newer one.
const stillAsking = (line: ScoutLine, query: string) => line.typed.trim() === query;

export const scoutReducer = (lines: ScoutLine[], action: ScoutAction): ScoutLine[] => {
  switch (action.name) {
    case "typed":
      return withLine(lines, action.id, (line) => ({ ...line, typed: action.text }));
    case "searching":
      return withLine(lines, action.id, (line) => ({
        ...line,
        status: "searching",
        failure: undefined,
      }));
    case "answered":
      return withLine(lines, action.id, (line) => {
        if (!stillAsking(line, action.query)) return line;
        const arrived = action.results.places.concat(action.results.nearby);
        return {
          ...line,
          status: "answered",
          places: action.results.places,
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
      return withLine(lines, action.id, (line) =>
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
      return withLine(lines, action.id, (line) => ({
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
      return withLine(lines, action.id, (line) => ({ ...line, runId: line.runId + 1 }));
    case "toggled":
      return withLine(lines, action.id, (line) => ({
        ...line,
        shownIds: line.shownIds.includes(action.findingId)
          ? line.shownIds.filter((id) => id !== action.findingId)
          : line.shownIds.concat(action.findingId),
      }));
    case "allToggled":
      // "Show all" is the sweep's control (paint every branch); the
      // engine's few hits keep their individual ticks either way.
      return withLine(lines, action.id, (line) => {
        const nearbyIds = line.nearby.map((finding) => finding.id);
        const engineTicks = line.shownIds.filter((id) => !nearbyIds.includes(id));
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
      return withLine(lines, action.id, (line) => ({ ...line, expanded: !line.expanded }));
    case "located":
      return withLine(lines, action.id, (line) => ({
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
    case "locateFailed":
      return withLine(lines, action.id, (line) => ({
        ...line,
        notice: "That place could not be resolved just now.",
      }));
    case "added":
      // Newest line on top: the panel grows toward the reader instead of
      // pushing the next question below the last one's answers.
      return [freshLine(lines.map((line) => line.color))].concat(lines);
    case "removed":
      // The last line never leaves: an empty panel offers no way back.
      return lines.length === 1 ? lines : lines.filter((line) => line.id !== action.id);
  }
};
