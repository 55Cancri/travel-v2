# Agent handoff — travel-2

This file exists so the next agent (or model) can pick up exactly where the last session left
off. It records what's built, what's decided-but-not-built, hard-won gotchas, things the user
still needs to verify, and the user's working preferences. Read [OVERVIEW.md](OVERVIEW.md)
(design doc) and [TODO.md](TODO.md) (checklist, keep the `Progress: N/M` counter updated)
alongside this.

**Context:** two users total (Eric + partner). Hard deadline: Europe trip departs
**July 28, 2026** — Amsterdam (5 days) → Paris → Belgium (Antwerp/Ghent/Brussels). The seed
data in `src/entities/trips/seed.ts` is the *real* trip with real coordinates.

---

## 1. Where things stand

Phase 0–3 are largely done (46/82 on TODO.md). Working today, locally:

- Outline editor: sections per city (idea pool "Ideas — Not yet scheduled" + days), Enter/Backspace/paste keyboard engine, drag-to-reorder within a section (variable-height rows handled), done/cancelled statuses, time chips, colored place dots, detail lines, item editor (bottom sheet on mobile / modal on desktop).
- Map: OpenFreeMap basemap, kind-colored pins, day/pool scoping, dashed route line, fly-to from row dots, popups with name+address, hand-tuned dark style, resizable split divider, mobile map/list pill.
- City chips: outlined, hold-drag to reorder, ✕ on active chip deletes (confirm with item count; empty city deletes instantly — uses native `window.confirm` for now, a styled dialog is fine to add later).
- Theming: ⌘D dark mode with pre-paint script, warm stone palette, blue focus tokens, themed scrollbars/popups/pins.
- Data: module store + `useSyncExternalStore` + localStorage (`travel2:db:v1`). Every mutation is a named function in `src/entities/trips/store.ts` — **that mutation surface is the seam where sync slots in later.** Don't add ad-hoc state writes in components.

Dormant on purpose (do NOT wire up without being asked): `alchemy.run.ts` (Cloudflare app: D1, `TripRoom` Durable Object, TanStack Start website, port 5006), `src/entities/db/schema.ts` (Drizzle: trips/segments/days/places/items/legs/mutations with fractional-index `rank`, HLC column, dedupe unique index), `drizzle.config.ts`. **No deploy, no provisioning, no DB writes** — the user wants local mock data until the app shape settles.

## 2. Unverified / known rough edges

- **The hand-tuned dark map theme has NOT been visually confirmed by the user.** It was built blind (see gotcha #1 below), validated with `npx @maplibre/maplibre-gl-style-spec gl-style-validate`, all 38 layer-id overrides matched. If colors read wrong, `DARK_PAINT` in `src/cells/planner/map-pane.tsx` is the single tuning table.
- Blue focus rings likewise await user eyes.
- Debug aids left in `map-pane.tsx` **intentionally**: `window.__map` (DEV-gated) and a `map.on("error")` console logger (`[map] …`). Keep them.
- City delete uses native `window.confirm`; replace with a styled dialog eventually (maybe with the settings work).
- Light mode got less polish than dark; user acknowledged deferring a light-mode pass.

## 3. Hard-won gotchas (cost real debugging time — don't relearn these)

1. **Hidden browser tabs freeze `requestAnimationFrame`, and MapLibre applies styles on rAF.** If the preview tab is hidden/covered, the map NEVER initializes — no errors, no markers, `isStyleLoaded()` false forever. It looks exactly like a code bug. It isn't. Bring the window forward, reload. This burned hours.
2. **MapLibre's stylesheet is unlayered CSS**, so it beats anything Panda emits inside `@layer`. Popup/control skins must live in `src/styles.css` as plain (unlayered) rules with enough specificity (see `.maplibregl-popup .maplibregl-popup-content`).
3. **Sticky elements pin below the scroll container's `padding-top`.** Padding on the scroll pane made sticky headers hover ~24px down with rows visibly scrolling above them. Padding goes on the first child instead.
4. **The map camera must NOT be an effect of store state.** It refits only on `[ready, scopeKey]` (+ `scopeNonce` so re-clicking the same day recenters). When it depended on the db, every keystroke/toggle made pins "wiggle" and pin-clicks zoom out.
5. **Drag-to-reorder: promote ONLY the lifted row** (position/zIndex/will-change). Applying will-change to all rows exploded compositing layers and made the *map* flicker during drags.
6. Variable-height drag needs measured heights: `measure` returns each row's height at grab time; slot = midpoint crossing over the heights array; siblings shift by the lifted row's height (see `use-drag-reorder.ts`, also supports `axis: "x"` for city chips).
7. **OpenFreeMap's "dark" style is pure grayscale** — not one hue in it. Filters/inversions over the light style look like "the lights are off" (user rejected). The fix: fetch the dark style JSON and repaint layer-by-layer (`loadDarkStyle()` + `DARK_PAINT`, 38 layer ids → paint overrides: warm near-black base, night-teal water, dark-green parks, amber-cast motorways, labels brightened ~2 steps).
8. Auto-growing row text is a `<textarea rows={1}>` with `field-sizing: content`; Enter never inserts a newline (the section key handler spawns a row instead). Checkbox needed a `display: grid` fixed-size wrapper — as an inline-level element it sat on the text baseline and looked lower than the grip.
9. **React Compiler is on** — no ref writes during render (the MapPane `apiRef` bug); mutate refs in effects.
10. Verifying via preview `eval`: focus reads race React effects, evals steal focus, and row text lives in input/textarea `.value` (not `textContent`) — query values, not text.
11. HMR sometimes shows stale errors mid-multi-file-edit ("X is not defined", "Failed to reload"); a full reload clears them — don't chase ghosts.

## 4. User preferences (violating these caused rework)

- Plain pin click must **not** move the camera; ⌘-click = street-level zoom. Row dot click = fly + popup.
- Selected day header = accent **underline**, never red/accent text.
- Detail lines under items: indented plain lines, **no card chrome**.
- Rows **wrap** by default (a future setting may offer single-line).
- Edit affordance is a **pencil**, not an ✕ next to other tappables; hover-reveal on desktop, always visible on mobile. The pencil icon was hand-tuned (stubby, 2.5 stroke, eraser divider line).
- Dark mode must be **designed colors**, never CSS filters/inversions — applies to the map especially.
- No amber/purple pin palette; current: terracotta/berry/teal/steel/stone with theme-adaptive shadows (`--pin-*` CSS vars in `panda.config.ts`).
- TODO.md style: short checkbox lines; keep `Progress: N/M` accurate as tasks are checked/added/removed.
- When consulting other models (`codex` / `gemini` CLIs are on PATH): **form your own ideas first**, append theirs at the end, clearly attributed — never lead with them.
- Design docs before code for anything substantial; the user reviews everything.

## 5. Next up (explicit user asks, in rough priority)

1. **Drag items BETWEEN sections** (idea pool → day). Repeatedly named "next up". `use-drag-reorder.ts` is per-container today; cross-container needs shared drop targets + a `moveItemAcross(fromRef, toRef, …)` store mutation.
2. **Settings menu** — first setting: wrap vs single-line rows.
3. **Smart chips** — detect times/costs/URLs while typing in a row.
4. **Day title editing** (seed has titles like "To the beach"; headers currently show date only — deliberate).
5. **Global paste box / brain-dump inbox** — trip-level; placement (bottom of outline vs in Ideas) deliberately undecided until the magic-paste work.
6. **Magic paste** — paste anything (text, confirmation emails, images) → LLM → structured items on days; ambiguous pastes trigger a mini-questionnaire; undated stuff lands in the inbox. This is the marquee feature for actually importing the real trip.
7. Geocode-as-you-type (Google Places (New), cache results at plan time — never live on-trip).
8. Follow-ups / "still to figure out" list per trip; light-mode polish pass.

## 6. Locked future decisions (researched + verified — don't re-litigate)

- **Sync:** D1 + Drizzle + append-only mutation log; `TripRoom` Durable Object per trip applies → broadcasts → catches up; LWW conflicts; HLC timestamps; fractional-index `rank` for ordering (deps already installed). Two users only — keep it simple.
- **Transit:** Transitous (MOTIS) covers EU incl. **Eurostar (verified)**; Navitia is shutting down — don't use it.
- **Geocoding:** Google Places (New), plan-time only, results cached into the trip data.
- **Offline maps:** PMTiles region extract on R2 → OPFS download; the only *legal* offline option with OpenFreeMap-style tiles.
- **iOS (as of 26.5):** no vibration API at all, no local alarms from web; notifications only via **Declarative Web Push** on an installed PWA. Haptics are Android-only (`entities/haptics`).
- Voice diary port from travel v1 (MediaRecorder → OPFS → R2 → transcription) is parked in Phase 6.

## 7. Repo mechanics

- `bun install` (prepare runs `panda codegen` → `styled-system/`, which is gitignored), `bun run dev` → localhost:5006, `bun run typecheck`.
- `.claude/launch.json` exists for the preview tooling (`travel-2`, bun, port 5006).
- localStorage keys: `travel2:db:v1` (data), `travel2:theme`, `travel2:leftw` (split width).
- The initial code landed as stacked PRs (docs → scaffold → atoms → data → dormant infra → outline → map → app wiring). Merge bottom-up; each PR's base is the branch below it.
