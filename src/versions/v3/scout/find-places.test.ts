import { describe, expect, test } from "bun:test";
import { namePattern, wordsOf } from "./find-places";

// How a typed phrase becomes a map query. This is where "Nemo Science"
// failed to find a museum whose entire name is "Nemo": the phrase went to
// Overpass as one substring, and no substring of that name contains it.

describe("wordsOf", () => {
  test.each([
    ["Media Markt", ["media", "markt"]],
    ["  NEMO   Science  ", ["nemo", "science"]],
    // Punctuation splits, and single letters are too weak to search on.
    ["Jan's Café, Amsterdam", ["jan", "café", "amsterdam"]],
    ["Dam 1", ["dam"]],
  ])("splits %p", (typed, expected) => {
    expect(wordsOf(typed)).toEqual(expected);
  });

  test("keeps non-latin words whole", () => {
    expect(wordsOf("東京 駅")).toEqual(["東京", "駅"]);
  });
});

describe("namePattern", () => {
  test("asks for ANY typed word, so a name missing one still comes back", () => {
    // The museum is called just "Nemo". Anchoring on the longest word
    // ("science") or on the whole phrase would both miss it.
    expect(namePattern(["nemo", "science"])).toBe("nemo|science");
  });

  test("a single word is the whole pattern", () => {
    expect(namePattern(["albert"])).toBe("albert");
  });

  test("escapes what would otherwise be regex syntax", () => {
    expect(namePattern(["c++", "shop"])).toBe("c\\+\\+|shop");
  });
});
