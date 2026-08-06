import { describe, expect, test } from "bun:test";
import "temporal-polyfill/global";
import {
  addEdge,
  frequentSearches,
  createMap,
  deleteMap,
  forgetSearch,
  noteSearch,
  readScoutDb,
  removePlace,
  savePlace,
  saveSearch,
  setEdgeModes,
  switchMap,
} from "./store";

// The store is a module singleton, so these tests share one world and
// each creates the map or entries it needs. What earns a test here is
// the non-obvious moves: edge cleanup, delete fallback, the recents
// bookkeeping behind "common".

const draftPlace = (label: string) => ({
  label,
  color: "#E11D48",
  lng: 4.9,
  lat: 52.37,
});

describe("maps", () => {
  test("deleting the active map falls back to a survivor, never to none", () => {
    const first = readScoutDb().activeMapId;
    const second = createMap("Second");
    expect(readScoutDb().activeMapId).toBe(second);
    deleteMap(second);
    expect(readScoutDb().activeMapId).toBe(first);
    // Deleting the last map leaves a fresh one rather than an empty screen.
    deleteMap(first);
    expect(readScoutDb().mapOrder.length).toBe(1);
    expect(readScoutDb().activeMapId).toBe(readScoutDb().mapOrder[0]);
  });
});

describe("places and edges", () => {
  test("removing a place takes its edges with it", () => {
    const mapId = createMap("Edges");
    const a = savePlace(mapId, draftPlace("A"));
    const b = savePlace(mapId, draftPlace("B"));
    const c = savePlace(mapId, draftPlace("C"));
    addEdge(mapId, a, b);
    const bc = addEdge(mapId, b, c);
    if (!bc) throw new Error("edge refused");
    expect(readScoutDb().maps[mapId].edges.length).toBe(2);
    removePlace(mapId, a);
    expect(readScoutDb().maps[mapId].edges.map((edge) => edge.id)).toEqual([bc]);
  });

  test("re-adding an edge returns the existing one, and self edges refuse", () => {
    const mapId = createMap("Dupes");
    const a = savePlace(mapId, draftPlace("A"));
    const b = savePlace(mapId, draftPlace("B"));
    const edge = addEdge(mapId, a, b);
    expect(addEdge(mapId, a, b)).toBe(edge);
    expect(addEdge(mapId, a, a)).toBeNull();
    expect(readScoutDb().maps[mapId].edges.length).toBe(1);
  });

  test("an edge never ends up with no modes", () => {
    const mapId = createMap("Modes");
    const a = savePlace(mapId, draftPlace("A"));
    const b = savePlace(mapId, draftPlace("B"));
    const edgeId = addEdge(mapId, a, b);
    if (!edgeId) throw new Error("edge refused");
    setEdgeModes(mapId, edgeId, []);
    expect(readScoutDb().maps[mapId].edges[0].modes.length).toBeGreaterThan(0);
    setEdgeModes(mapId, edgeId, ["walk", "tram"]);
    expect(readScoutDb().maps[mapId].edges[0].modes).toEqual(["walk", "tram"]);
  });

  test("switching maps keeps each map's places apart", () => {
    const one = createMap("One");
    savePlace(one, draftPlace("Only here"));
    const two = createMap("Two");
    expect(Object.keys(readScoutDb().maps[two].places).length).toBe(0);
    switchMap(one);
    expect(readScoutDb().activeMapId).toBe(one);
    expect(Object.keys(readScoutDb().maps[one].places).length).toBe(1);
  });
});

describe("searches", () => {
  test("repeats bump one recents entry instead of stacking copies", () => {
    noteSearch("Media Markt");
    noteSearch("media markt");
    noteSearch("MEDIA MARKT");
    const matching = readScoutDb().searches.recents.filter(
      (entry) => entry.query.toLowerCase() === "media markt",
    );
    expect(matching.length).toBe(1);
    expect(matching[0].count).toBe(3);
  });

  test("common lists often-typed queries but not ones already saved", () => {
    noteSearch("stroopwafel");
    noteSearch("stroopwafel");
    noteSearch("stroopwafel");
    expect(frequentSearches(readScoutDb()).some((entry) => entry.query === "stroopwafel")).toBe(
      true,
    );
    const savedId = saveSearch("stroopwafel");
    expect(frequentSearches(readScoutDb()).some((entry) => entry.query === "stroopwafel")).toBe(
      false,
    );
    if (savedId) forgetSearch(savedId);
    expect(readScoutDb().searches.saved.some((entry) => entry.query === "stroopwafel")).toBe(
      false,
    );
  });

  test("saving the same query twice keeps one entry", () => {
    const first = saveSearch("Hotel Hoy");
    const second = saveSearch("hotel hoy");
    expect(first).toBe(second);
  });
});
