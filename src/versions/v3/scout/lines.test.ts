import { describe, expect, test } from "bun:test";
import type { Finding, LineResults } from "./find-places";
import { openingLines, scoutReducer, type ScoutLine } from "./lines";

// The reducer moves that guard against ghost results: answers replacing
// sections wholesale, ticks surviving only for findings that came back,
// and the show-all control staying scoped to the sweep section.

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

const answered = (line: ScoutLine, query: string, results: Partial<LineResults>) =>
  scoutReducer([line], {
    name: "answered",
    id: line.id,
    query,
    results: { places: [], nearby: [], sweeping: false, ...results },
  })[0];

const typedLine = (typed: string) => {
  const line = openingLines()[0];
  return scoutReducer([line], { name: "typed", id: line.id, text: typed })[0];
};

describe("answered", () => {
  test("a fresh answer replaces both sections wholesale", () => {
    let line = typedLine("hotel hoy");
    line = answered(line, "hotel hoy", { nearby: [sweepHit("stale")] });
    line = answered(line, "hotel hoy", {
      places: [engineHit("paris")],
      nearby: [sweepHit("fresh")],
    });
    expect(line.places.map((finding) => finding.name)).toEqual(["paris"]);
    expect(line.nearby.map((finding) => finding.name)).toEqual(["fresh"]);
  });

  test("ticks survive only for findings that came back", () => {
    let line = typedLine("nemo");
    line = answered(line, "nemo", { nearby: [sweepHit("a"), sweepHit("b")] });
    line = scoutReducer([line], { name: "toggled", id: line.id, findingId: "osm:node/a" })[0];
    line = scoutReducer([line], { name: "toggled", id: line.id, findingId: "osm:node/b" })[0];
    line = answered(line, "nemo", { nearby: [sweepHit("a")] });
    expect(line.shownIds).toEqual(["osm:node/a"]);
  });

  test("resolved coordinates survive the slow source's later answer", () => {
    // The owner's vanishing pin: tick a resolved engine hit while the
    // sweep is still out, then the sweep's answer (success or failure)
    // replaces the section with coordinate-less copies. The tick
    // survived by id, but a pin cannot stand without its ground.
    let line = typedLine("hotel hoy");
    line = answered(line, "hotel hoy", { places: [engineHit("hoy")], sweeping: true });
    line = scoutReducer([line], {
      name: "located",
      id: line.id,
      findingId: "google:hoy",
      lng: 2.34,
      lat: 48.88,
      address: "68 Rue des Martyrs",
    })[0];
    line = scoutReducer([line], { name: "toggled", id: line.id, findingId: "google:hoy" })[0];
    line = answered(line, "hotel hoy", { places: [engineHit("hoy")] });
    expect(line.shownIds).toEqual(["google:hoy"]);
    expect(line.places[0].lng).toBe(2.34);
    expect(line.places[0].address).toBe("68 Rue des Martyrs");
  });

  test("an answer for words no longer asked changes nothing", () => {
    let line = typedLine("media markt");
    const before = line;
    line = answered(line, "media", { places: [engineHit("overtaken")] });
    expect(line).toBe(before);
  });
});

describe("added", () => {
  test("appends the fresh line below, in a fresh color", () => {
    const first = typedLine("hotel hoy");
    const lines = scoutReducer([first], { name: "added" });
    expect(lines.length).toBe(2);
    expect(lines[0].id).toBe(first.id);
    expect(lines[1].typed).toBe("");
    expect(lines[1].color).not.toBe(first.color);
  });
});

describe("allToggled", () => {
  test("covers the sweep section and leaves engine ticks alone", () => {
    let line = typedLine("nemo");
    line = answered(line, "nemo", {
      places: [engineHit("museum")],
      nearby: [sweepHit("a"), sweepHit("b")],
    });
    line = scoutReducer([line], { name: "toggled", id: line.id, findingId: "google:museum" })[0];
    line = scoutReducer([line], { name: "allToggled", id: line.id })[0];
    expect(line.shownIds.toSorted()).toEqual(
      ["google:museum", "osm:node/a", "osm:node/b"].toSorted(),
    );
    // Folding back off keeps the engine tick.
    line = scoutReducer([line], { name: "allToggled", id: line.id })[0];
    expect(line.shownIds).toEqual(["google:museum"]);
  });
});

describe("located", () => {
  test("writes resolved coordinates into the engine hit", () => {
    let line = typedLine("hotel hoy");
    line = answered(line, "hotel hoy", { places: [engineHit("hoy")] });
    line = scoutReducer([line], {
      name: "located",
      id: line.id,
      findingId: "google:hoy",
      lng: 2.34,
      lat: 48.88,
      address: "68 Rue des Martyrs",
    })[0];
    expect(line.places[0].lng).toBe(2.34);
    expect(line.places[0].lat).toBe(48.88);
    expect(line.places[0].address).toBe("68 Rue des Martyrs");
  });
});
