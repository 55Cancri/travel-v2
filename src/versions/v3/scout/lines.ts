// The panel's query lines: what each one holds, and every way it can change.
// A reducer rather than a drawer of useStates because a line's fields move
// together (an arriving answer sets the status, the findings, the notice, and
// the text they answer to in one step), and because the panel edits a LIST of
// them, where a stray partial update is how ghost results survive.

import type { Finding, LineResults } from "./find-places";

export type LineStatus = "idle" | "searching" | "answered" | "failed";

export type ScoutLine = {
  id: string;
  color: string;
  typed: string;
  // The text the current findings answer to. Empty means nothing has been
  // asked yet, which is also how a refresh makes the same words run again.
  query: string;
  status: LineStatus;
  findings: Finding[];
  // Which findings are painted on the map. Ids rather than the findings
  // themselves, so a fresh search cannot leave a stale copy pinned.
  shownIds: string[];
  // Bumped by every refresh press. Clearing `query` alone would make a
  // second press while a search is already running a silent no-op, since
  // the value it clears is already empty.
  runId: number;
  // Whether the result rows are showing. Painting everything is the moment
  // the rows stop earning their height, so showing all folds them away and
  // the caret brings them back.
  expanded: boolean;
  notice?: string;
  failure?: string;
};

// The same register as the map's other overlays: saturated enough to hold
// against pale streets, light enough to stay visible on the dark canvas.
export const LINE_COLORS = [
  "#E11D48",
  "#0EA5E9",
  "#16A34A",
  "#8B5CF6",
  "#F59E0B",
  "#0D9488",
];

const freshLine = (taken: string[]): ScoutLine => ({
  id: crypto.randomUUID(),
  color: LINE_COLORS.find((color) => !taken.includes(color)) ?? LINE_COLORS[taken.length % LINE_COLORS.length],
  typed: "",
  query: "",
  status: "idle",
  findings: [],
  shownIds: [],
  runId: 0,
  expanded: true,
});

export const openingLines = () => [freshLine([])];

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
      return withLine(lines, action.id, (line) =>
        !stillAsking(line, action.query) ? line : {
          ...line,
          query: action.query,
          status: "answered",
          findings: action.results.findings,
          notice: action.results.notice,
          failure: undefined,
          // A new answer starts unpainted: silently re-pinning ids that
          // happen to repeat would mix two searches on one map.
          shownIds: [],
        },
      );
    case "failed":
      return withLine(lines, action.id, (line) =>
        !stillAsking(line, action.query) ? line : {
          ...line,
          query: action.query,
          status: "failed",
          failure: action.failure,
          findings: [],
          shownIds: [],
        },
      );
    case "emptied":
      return withLine(lines, action.id, (line) => ({
        ...line,
        query: "",
        status: "idle",
        findings: [],
        shownIds: [],
        notice: undefined,
        failure: undefined,
      }));
    case "refreshed":
      // Forgetting what the findings answered to is what makes the same
      // words search again, now against wherever the map is looking.
      return withLine(lines, action.id, (line) => ({
        ...line,
        query: "",
        runId: line.runId + 1,
      }));
    case "toggled":
      return withLine(lines, action.id, (line) => ({
        ...line,
        shownIds: line.shownIds.includes(action.findingId)
          ? line.shownIds.filter((id) => id !== action.findingId)
          : line.shownIds.concat(action.findingId),
      }));
    case "allToggled":
      return withLine(lines, action.id, (line) => {
        const wasAll = line.shownIds.length === line.findings.length;
        return {
          ...line,
          shownIds: wasAll ? [] : line.findings.map((finding) => finding.id),
          // Turning everything on makes the rows redundant, so they fold
          // away; turning it back off is the start of picking individually,
          // which needs them.
          expanded: wasAll,
        };
      });
    case "disclosed":
      return withLine(lines, action.id, (line) => ({ ...line, expanded: !line.expanded }));
    case "added":
      // Newest line on top: the panel grows toward the reader instead of
      // pushing the next question below the last one's answers.
      return [freshLine(lines.map((line) => line.color))].concat(lines);
    case "removed":
      // The last line never leaves: an empty panel offers no way back.
      return lines.length === 1 ? lines : lines.filter((line) => line.id !== action.id);
  }
};
