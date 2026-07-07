// The Suggested overlay: a curated slice of the sights data. What the
// plan already contains hints at taste (museum names, park strolls), and
// a wikipedia/wikidata tag separates landmarks from lawn fixtures. When
// the plan gives no usable hints, notability alone curates.

import type { OverlayPlace } from "./fetch-places";

const PICK_CAP = 25;

const TASTE_HINTS: Array<{ hint: RegExp; categories: RegExp }> = [
  { hint: /museum|galler|exhibit|art\b/i, categories: /^(museum|gallery)$/ },
  { hint: /park|garden|stroll|botanic/i, categories: /^(park|garden)$/ },
  {
    hint: /castle|palace|church|cathedral|monument|historic|ruin|fort/i,
    categories: /^(castle|monument|fort|ruins|city_gate|attraction)$/,
  },
  { hint: /view|tower|lookout|panorama/i, categories: /^viewpoint$/ },
  { hint: /zoo|aquarium|animal/i, categories: /^(zoo|aquarium)$/ },
];

export const suggestPicks = (sights: OverlayPlace[], planTexts: string[]) => {
  const plan = planTexts.join(" ");
  const liked = TASTE_HINTS.filter((taste) => taste.hint.test(plan));
  const notable = sights.filter((place) => place.notable);
  const affine = liked.length
    ? notable.filter((place) => liked.some((taste) => taste.categories.test(place.category ?? "")))
    : notable;
  return (affine.length ? affine : notable)
    .slice(0, PICK_CAP)
    .map((place) => ({ ...place, kind: "picks" as const }));
};
