# travel-2

A trip planner + on-trip companion for exactly two people, replacing a Figma-bullet-lists +
Google My Maps workflow. The core idea: **the plan is a document, the map is a projection of
it** — an outline/checklist editor on the left, a MapLibre map on the right, and every item
with a place shows up as a pin.

Built against a real deadline: a Europe trip departing **July 28, 2026**
(Amsterdam → Paris → Belgium), which is also the seed data.

## Status

Local-dev only, by choice. All data is mock JSON in `localStorage` — no deploy, no database,
no auth yet. The Cloudflare config (`alchemy.run.ts`) and Drizzle schema exist but are
**dormant**: written so the sync layer can slot in later without touching components, not
wired to anything.

- [OVERVIEW.md](OVERVIEW.md) — the design doc: data model, sync design, map stack research, cuts for v1
- [TODO.md](TODO.md) — the phased checklist with a progress counter (currently 46/82)
- [HANDOFF.md](HANDOFF.md) — **read this first if you're an agent picking up the work**: lessons learned, gotchas, unverified bits, and what's next

## Stack

- **TanStack Start** + React 19 + Vite 7 (React Compiler enabled)
- **Panda CSS** — lh-based rhythm tokens, semantic color tokens, `data-theme` dark mode (⌘D)
- **MapLibre GL JS v5** + OpenFreeMap tiles (liberty for light; hand-tuned layer-by-layer repaint of the grayscale "dark" style for dark mode)
- **framer-motion** MotionValues for hand-rolled drag-to-reorder
- Module store + `useSyncExternalStore` + `localStorage` (key `travel2:db:v1`)
- Later: Alchemy → Cloudflare Workers / D1 / Durable Objects, PMTiles offline maps, Transitous transit

## Run it

```sh
bun install        # runs `panda codegen` via prepare
bun run dev        # vite dev on http://localhost:5006
bun run typecheck  # tsc --noEmit
```

## Layout

```
src/
  atoms/        Block/Button/Input/Text/Link/Checkbox + icons (ported from stochastic-v3)
  cells/
    planner/    the whole app: outline sections, item rows, drag reorder,
                item editor sheet/modal, map pane, resizable split
  entities/
    trips/      types, seed (the real 2026 trip), store + mutations
    theme/      dark mode toggle (⌘D)
    haptics/    tap/grab feedback (Android only; iOS has none)
    db/         dormant Drizzle schema for the future sync backbone
  routes/       __root (theme pre-paint script), index (trip list), trip.$tripId
```

## Reviewing this repo

The initial code lands as a stack of PRs (docs → scaffold → atoms → data → dormant infra →
outline editor → map → app wiring), each based on the previous branch. Review and merge them
bottom-up; GitHub retargets the next PR automatically when its base merges.
