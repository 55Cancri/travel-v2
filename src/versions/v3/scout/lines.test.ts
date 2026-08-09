import { describe, expect, test } from "bun:test";
import type { Finding, LineResults } from "./find-places";
import { openingLines, scoutReducer, type LineSet } from "./lines";

// The reducer moves that guard against ghost results: answers replacing
// sections wholesale, ticks surviving only for findings that came back,
// resolved facts carrying across replacements, the show-all control
// staying scoped to the sweep section, and the active line following
// focus, adds, and removals.

const engineHit = (id: string): Finding => ({
  id: `google:${id}`,
  name: id,
  source: "google",
  placeId: id,
});

const sweepHit = (id: string): Finding => ({
  id: `osm:node/${id}`,
  name: id,
  lng: 4.9,
  lat: 52.37,
  source: "osm",
});

const first = (set: LineSet) => set.lines[0];

const typedSet = (typed: string) => {
  const opening = openingLines();
  return scoutReducer(opening, { name: "typed", id: first(opening).id, text: typed });
};

const answered = (set: LineSet, query: string, results: Partial<LineResults>) =>
  scoutReducer(set, {
    name: "answered",
    id: first(set).id,
    query,
    results: { places: [], nearby: [], sweeping: false, ...results },
  });

describe("answered", () => {
  test("a fresh answer replaces both sections wholesale", () => {
    let set = typedSet("hotel hoy");
    set = answered(set, "hotel hoy", { nearby: [sweepHit("stale")] });
    set = answered(set, "hotel hoy", {
      places: [engineHit("paris")],
      nearby: [sweepHit("fresh")],
    });
    expect(first(set).places.map((finding) => finding.name)).toEqual(["paris"]);
    expect(first(set).nearby.map((finding) => finding.name)).toEqual(["fresh"]);
  });

  test("ticks survive only for findings that came back", () => {
    let set = typedSet("nemo");
    set = answered(set, "nemo", { nearby: [sweepHit("a"), sweepHit("b")] });
    set = scoutReducer(set, { name: "toggled", id: first(set).id, findingId: "osm:node/a" });
    set = scoutReducer(set, { name: "toggled", id: first(set).id, findingId: "osm:node/b" });
    set = answered(set, "nemo", { nearby: [sweepHit("a")] });
    expect(first(set).shownIds).toEqual(["osm:node/a"]);
  });

  test("resolved coordinates survive the slow source's later answer", () => {
    // The owner's vanishing pin: tick a resolved engine hit while the
    // sweep is still out, then the sweep's answer (success or failure)
    // replaces the section with coordinate-less copies. The tick
    // survived by id, but a pin cannot stand without its ground.
    let set = typedSet("hotel hoy");
    set = answered(set, "hotel hoy", { places: [engineHit("hoy")], sweeping: true });
    set = scoutReducer(set, {
      name: "located",
      id: first(set).id,
      findingId: "google:hoy",
      lng: 2.34,
      lat: 48.88,
      address: "68 Rue des Martyrs",
    });
    set = scoutReducer(set, { name: "toggled", id: first(set).id, findingId: "google:hoy" });
    set = answered(set, "hotel hoy", { places: [engineHit("hoy")] });
    expect(first(set).shownIds).toEqual(["google:hoy"]);
    expect(first(set).places[0].lng).toBe(2.34);
    expect(first(set).places[0].address).toBe("68 Rue des Martyrs");
  });

  test("an answer for words no longer asked changes nothing", () => {
    const set = typedSet("media markt");
    const after = answered(set, "media", { places: [engineHit("overtaken")] });
    expect(after.lines[0]).toBe(set.lines[0]);
  });
});

describe("the active line", () => {
  test("added appends below, in a fresh color, and takes the region", () => {
    const set = typedSet("hotel hoy");
    const grown = scoutReducer(set, { name: "added" });
    expect(grown.lines.length).toBe(2);
    expect(grown.lines[0].id).toBe(first(set).id);
    expect(grown.lines[1].typed).toBe("");
    expect(grown.lines[1].color).not.toBe(first(set).color);
    expect(grown.activeId).toBe(grown.lines[1].id);
  });

  test("focus claims the region; removing the active line hands it to a neighbor", () => {
    let set = scoutReducer(typedSet("one"), { name: "added" });
    const [a, b] = set.lines;
    set = scoutReducer(set, { name: "focused", id: a.id });
    expect(set.activeId).toBe(a.id);
    set = scoutReducer(set, { name: "removed", id: a.id });
    expect(set.activeId).toBe(b.id);
    // The last line never leaves: an empty panel offers no way back.
    set = scoutReducer(set, { name: "removed", id: b.id });
    expect(set.lines.length).toBe(1);
  });

  test("typing a new phrase withdraws the sweep ask", () => {
    let set = typedSet("media markt");
    set = scoutReducer(set, { name: "sweepAsked", id: first(set).id });
    expect(first(set).sweepAsked).toBe(true);
    set = scoutReducer(set, { name: "typed", id: first(set).id, text: "media markt utrecht" });
    expect(first(set).sweepAsked).toBe(false);
  });
});

describe("allToggled", () => {
  test("covers the sweep section and leaves engine ticks alone", () => {
    let set = typedSet("nemo");
    set = answered(set, "nemo", {
      places: [engineHit("museum")],
      nearby: [sweepHit("a"), sweepHit("b")],
    });
    set = scoutReducer(set, { name: "toggled", id: first(set).id, findingId: "google:museum" });
    set = scoutReducer(set, { name: "allToggled", id: first(set).id });
    expect(first(set).shownIds.toSorted()).toEqual(
      ["google:museum", "osm:node/a", "osm:node/b"].toSorted(),
    );
    // Folding back off keeps the engine tick.
    set = scoutReducer(set, { name: "allToggled", id: first(set).id });
    expect(first(set).shownIds).toEqual(["google:museum"]);
  });
});

describe("located", () => {
  test("writes resolved coordinates into the engine hit", () => {
    let set = typedSet("hotel hoy");
    set = answered(set, "hotel hoy", { places: [engineHit("hoy")] });
    set = scoutReducer(set, {
      name: "located",
      id: first(set).id,
      findingId: "google:hoy",
      lng: 2.34,
      lat: 48.88,
      address: "68 Rue des Martyrs",
    });
    expect(first(set).places[0].lng).toBe(2.34);
    expect(first(set).places[0].lat).toBe(48.88);
    expect(first(set).places[0].address).toBe("68 Rue des Martyrs");
  });
});
