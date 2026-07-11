// The Suggested overlay: a curated slice of the sights data. The real
// curator is the server's model (/api/curate); the local heuristic paints
// first and stands in whenever the server can't answer. For the
// heuristic: what the plan already contains hints at taste (museum names,
// park strolls), and a wikipedia/wikidata tag separates landmarks from
// lawn fixtures.

import type { OverlayPlace } from "./fetch-places";

export const curatePicks = async (
  sights: OverlayPlace[],
  planTexts: string[],
  signal: AbortSignal,
) => {
  const res = await fetch("/api/curate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plan: planTexts.filter(Boolean).slice(0, 100),
      candidates: sights.slice(0, 120).map((place) => ({
        id: place.id,
        name: place.name,
        category: place.category,
        notable: place.notable,
      })),
    }),
    signal,
  });
  if (!res.ok) throw new Error(`curate responded ${res.status}`);
  const body = (await res.json()) as { picks?: string[] };
  const byId = new Map(sights.map((place) => [place.id, place]));
  const picks = (body.picks ?? []).flatMap((id) => {
    const place = byId.get(id);
    return place ? [{ ...place, kind: "picks" as const }] : [];
  });
  if (!picks.length) throw new Error("curate answered with no usable picks");
  return picks;
};

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
