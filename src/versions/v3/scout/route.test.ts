import { afterEach, describe, expect, test } from "bun:test";
import "temporal-polyfill/global";
import type { SavedPlace, ScoutEdge } from "entities/scout-maps";
import { planEdges } from "./route";

// The edge planner against mocked routers: the walk-or-ride judgement,
// and the guard that keeps a walking itinerary from impersonating a
// bus-only connection.

const liveFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = liveFetch;
});

const place = (id: string, lng: number): SavedPlace => ({
  id,
  label: id,
  color: "#E11D48",
  lng,
  lat: 52.37,
  savedAtMs: 0,
});

const edge = (fromId: string, toId: string, modes: ScoutEdge["modes"]): ScoutEdge => ({
  id: `${fromId}-${toId}`,
  fromId,
  toId,
  modes,
});

const jsonAnswer = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });

// "AAAA" decodes to two points one step apart at the given precision;
// enough geometry to count as a drawable line.
const walkOnlyItinerary = {
  itineraries: [
    { legs: [{ mode: "WALK", legGeometry: { points: "AAAA", precision: 5 } }] },
  ],
};

const roadAnswer = {
  code: "Ok",
  routes: [{ geometry: { coordinates: [[4.9, 52.37], [4.902, 52.37]] } }],
  waypoints: [{ location: [4.9, 52.37] }, { location: [4.902, 52.37] }],
};

describe("planEdges", () => {
  test("a walkable pair with walking allowed takes the foot router", async () => {
    const asked: string[] = [];
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      asked.push(String(url));
      if (String(url).includes("routed-foot")) return jsonAnswer(roadAnswer);
      throw new Error(`unexpected router: ${String(url)}`);
    }) as typeof fetch;
    const places = { a: place("a", 4.9), b: place("b", 4.902) };
    const plan = await planEdges(
      places,
      [edge("a", "b", ["walk", "bus"])],
      "2026-08-06",
      new AbortController().signal,
    );
    expect(plan.legs.length).toBe(1);
    expect(plan.legs[0].mode).toBe("walk");
    expect(plan.legs[0].edgeId).toBe("a-b");
    expect(plan.notice).toBeUndefined();
    expect(asked.some((url) => url.includes("routed-foot"))).toBe(true);
  });

  test("a bus-only edge refuses a walking itinerary and says so", async () => {
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      const text = String(url);
      if (text.includes("transitous")) {
        // The router found no bus and answers with its walking fallback.
        expect(text).toContain("transitModes=BUS");
        return jsonAnswer(walkOnlyItinerary);
      }
      throw new Error(`unexpected router: ${text}`);
    }) as typeof fetch;
    // Far apart, so the hop cannot be judged walkable.
    const places = { a: place("a", 4.9), b: place("b", 5.1) };
    const plan = await planEdges(
      places,
      [edge("a", "b", ["bus"])],
      "2026-08-06",
      new AbortController().signal,
    );
    // The edge still draws (straight), and the notice names the failure.
    expect(plan.legs.length).toBe(1);
    expect(plan.legs[0].line.length).toBe(2);
    expect(plan.notice).toContain("could not be routed");
  });
});
