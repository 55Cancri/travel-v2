# Agent handoff — travel-2

_Updated 2026-07-11 after the UI-versioning + house-rules round._

## How this file works (read me first)

This file exists so a FRESH agent with zero context or memory can resume
exactly where the last session stopped, even mid-implementation. Read
[OVERVIEW.md](OVERVIEW.md) (design vision) and [TODO.md](TODO.md) (the
authoritative checklist, keep its `Progress: N/M` counter accurate)
alongside it. Maintain it like this:

- **Every work round appends a `## Round:` entry at the TOP** (newest
  first) before the session ends: what shipped (with file paths), what is
  mid-flight (the exact resume point: file, branch, next command, the
  decision already made), what the round queued, and what the owner still
  needs to verify or decide.
- **Write for a stranger.** More detail than feels necessary is correct.
  An interrupted implementation must be resumable from this file alone,
  so record intent and next steps, not just diffs. "Half of X is in
  file Y, the remaining half is Z, designed as W" beats "worked on X".
- **Checklists are live.** `- [ ]` items get checked off (`- [x]`) as
  they land, in whatever round entry they live in. The owner reads these
  to see movement.
- **Compact when it grows.** Past ~700 lines, fold the OLDEST rounds
  into the `## Compacted history` section at the bottom: one short
  paragraph per round, and promote anything still load-bearing (a
  gotcha, a decision, a preference) into the matching standing section
  first so it survives. Recent rounds always stay verbatim. The file
  never grows unbounded and never loses a still-true fact.
- **Standing sections** (gotchas, preferences, locked decisions, repo
  mechanics) live below the rounds and get edited in place, never
  duplicated into rounds.

## Round: UI versioning, house-rules port, keyless-machine dev (2026-07-11)

Context: this machine pulled 115 commits of other-agent work (Cloudflare
server live, site door, phone bottom sheet, map overlays, route stepper)
before starting. Three asks: port stockpile's CLAUDE.md advances, version
the UI, and turn this file into a living handoff log.

DONE:

- **UI versioning shipped.** The organizing idea: a UI generation is a
  self-contained folder owning its screens, and the app renders whichever
  generation a device chose.
  - `src/versions/` is the new module (door: `versions` path alias, which
    REPLACED the `cells/*` alias). `catalog.ts` lists every generation
    (id, label, lazy `TripsShelf` + `Planner` components). `choice.ts` is
    the per-device preference store (`travel2:ui-version` in
    localStorage, `useSyncExternalStore`, unknown/absent id resolves to
    the latest entry). `picker.tsx` is `UiVersionPicker`, a GhostButton
    reading `UI v1` that cycles the catalog on press.
  - The old `src/cells/planner` moved wholesale (git mv, history intact)
    to `src/versions/v1/planner/`. The trip-list screen JSX moved out of
    `src/routes/index.tsx` into `src/versions/v1/trips-shelf/index.tsx`
    and its header now renders the picker between the Trips title and
    "+ New trip".
  - Routes are version-neutral shells now: they keep the mount gate,
    read `useUiVersion()`, and render the active generation's screen in
    a `<React.Suspense fallback={null}>` (screens are `React.lazy`, so
    dormant generations stay out of the active bundle).
  - Adding v2 when the time comes: copy `src/versions/v1` to `v2`,
    evolve freely, append a catalog entry. The picker and both routes
    pick it up with no further wiring. Every generation's trip shelf
    must keep rendering `UiVersionPicker` so a device can climb out of
    a broken generation.
  - Verified in the local dev server: shelf renders with the pill, the
    planner renders from its new home, the outline keyboard engine
    still adds/removes rows.
- **CLAUDE.md caught up with stockpile's newer directives** (theirs had
  2026-07-09/10 additions ours lacked): the GPT-5.6 Sol partnership
  section (Sol reviews everything by default, division of labor, the
  formatter ban, the gemini inline-diff review recipe), plus five owner
  directives (paper cuts die in the turn they surface, the backlog
  shrinks every round, behavior feedback lands in CLAUDE.md not agent
  memory, reports speak plain language, test-ready means
  design-complete). Skills dirs were already in sync (only cosmetic
  project-specific wording differs).
- **`bun run check:names` ported from stockpile** as
  `scripts/banned-names/index.ts` (TS-only adaptation): scans
  declaration sites and file/folder names for the banned naming stems.
  Running it found and fixed 6 pre-existing violations: three `index`
  locals in `use-drag-reorder.ts` (now `idx`/`i`) and
  `keyHandler`/`pasteHandler`/`blurHandler` in `section.tsx` (now
  `rowKeyDown`/`rowPaste`/`rowBlur`).
- **Keyless-machine dev unblocked** (see the fire alarm below):
  `alchemy.run.ts` now includes the Workers AI binding only when
  Cloudflare credentials exist (API token or a wrangler login on disk),
  because AI is the one binding with no local emulation and its remote
  proxy hard-fails dev without credentials. `/api/curate` degrades to
  the client's notability heuristic, which is that endpoint's designed
  fallback. `.claude/launch.json` gained a `travel-2-local` config
  (plain `vite dev --port 5006`) that serves off the
  alchemy-generated `.alchemy/local/wrangler.jsonc` when the full
  `bun run dev` cannot run.
- Empty catches in `entities/theme` got their required
  expected-error comments in passing (sealed-storage setItem).

FOR THE OWNER (verify / decide):

- [ ] **FIRE ALARM: this machine has no real `.env`.** The prod deploy
      credentials (ALCHEMY_PASSWORD, CLOUDFLARE_API_TOKEN, the Google
      Places key, the door password) live only wherever the 2026-07-07
      infra work ran. Copy that `.env` here. Until then this machine
      cannot deploy and its dev door uses placeholder credentials
      (email `gUmijQUL@protonmail.com`, password `local-dev`, written
      into the local `.env`, which is gitignored).
- [ ] Review the versioning design: the picker is a cycling pill on the
      trip shelf header. Fine for 2-3 generations, becomes a menu if the
      catalog grows. Placement and the pill treatment are open to taste.
- [ ] The dark map theme and blue focus rings remain visually
      unconfirmed by the owner (carried from the pre-pull handoff).

QUEUED BY THIS ROUND:

- [ ] Slice this round into PRs (in flight as this entry is written).
- [ ] GPT-5.6 Sol background review of the round's diff (in flight).
- [ ] When a second UI generation starts: copy v1, then consider
      whether map-pane internals (dark style table, overlays) should
      become version-shared entities instead of duplicating.

## Queue (owner asks, carried from before the pull; TODO.md is authoritative)

- [ ] **Drag items BETWEEN sections** (idea pool → day). Repeatedly
      named "next up". `use-drag-reorder.ts` (now under
      `src/versions/v1/planner/`) is per-container; cross-container
      needs shared drop targets and a `moveItemAcross` store mutation.
- [ ] Settings menu. First setting: wrap vs single-line rows.
- [ ] Smart chips: detect times/costs/URLs while typing in a row.
- [ ] Day title editing (headers currently show date only, deliberate).
- [ ] Global paste box / brain-dump inbox (placement deliberately
      undecided until the magic-paste work).
- [ ] **Magic paste**: paste anything → LLM → structured items on days.
      The marquee feature for importing the real trip.
- [x] Geocode-as-you-type (landed with the Cloudflare round:
      `/api/places` + KV cache + item-row place picking).
- [x] Map overlays (landed: food/vegan, luggage, bikes, buses, sights,
      Suggested with Workers-AI curation).
- [ ] Light-mode polish pass (owner acknowledged deferring).

## Where things stand (2026-07-11)

- **The Cloudflare infra is LIVE** (since 2026-07-07): the app deploys
  to https://travel-v2.leaftime.workers.dev with D1 + KV + Workers AI
  bound. `bun run dev` / `bun run deploy` execute `alchemy.run.ts` under
  node. The site sits behind a door (allowlisted email + shared
  password, 90-day sealed cookie). Trip data is still localStorage-only
  until the D1 + TripRoom Durable Object sync lands.
- Working UI (all now under `src/versions/v1/`): outline editor
  (sections per city, keyboard engine, drag reorder, statuses, time
  chips, item editor), map pane (OpenFreeMap, kind-colored pins,
  day/pool scoping, route line + transit/route stepper, hand-tuned dark
  style, ambient overlays with verdict cards), phone layout (outline
  rides a bottom sheet over a fullscreen map), city chips, ⌘D theming.
- Data: module store + `useSyncExternalStore` + localStorage
  (`travel2:db:v1`). Every mutation is a named function in
  `src/entities/trips/store.ts`. That mutation surface is the seam
  where sync slots in later. No ad-hoc state writes in components.

## Hard-won gotchas (cost real debugging time, do not relearn)

1. **Hidden browser tabs freeze `requestAnimationFrame`, and MapLibre
   applies styles on rAF.** A hidden/covered preview tab means the map
   NEVER initializes: no errors, `isStyleLoaded()` false forever. Looks
   exactly like a code bug. Bring the window forward, reload.
2. **MapLibre's stylesheet is unlayered CSS**, so it beats anything
   Panda emits inside `@layer`. Popup/control skins live in
   `src/styles.css` as plain unlayered rules.
3. **Sticky elements pin below the scroll container's `padding-top`.**
   Padding goes on the first child instead.
4. **The map camera must NOT be an effect of store state.** It refits
   only on `[ready, scopeKey]` (+ `scopeNonce`). Depending on the db
   made pins wiggle on every keystroke.
5. **Drag-to-reorder: promote ONLY the lifted row**
   (position/zIndex/will-change). Promoting all rows exploded
   compositing layers and made the map flicker.
6. Variable-height drag needs measured heights: slot = midpoint
   crossing over the heights array (see `use-drag-reorder.ts`, also
   supports `axis: "x"` for city chips).
7. **OpenFreeMap's "dark" style is pure grayscale.** Filters/inversions
   read as "lights off" (owner rejected). The fix is the repaint table:
   `loadDarkStyle()` + `DARK_PAINT` in
   `src/versions/v1/planner/map-pane.tsx`.
8. Auto-growing row text is `<textarea rows={1}>` with
   `field-sizing: content`. Enter never inserts a newline (the section
   handler spawns a row). Checkboxes need a `display: grid` fixed-size
   wrapper.
9. **React Compiler is on**: no ref writes during render, mutate refs
   in effects.
10. Verifying via preview eval: row text lives in textarea `.value`,
    not `textContent`. Query values.
11. HMR sometimes shows stale errors mid-multi-file-edit. A full reload
    clears them. Don't chase ghosts. (Bit again 2026-07-11: a tsconfig
    `paths` change also needs a dev-server RESTART, vite-tsconfig-paths
    reads it at startup.)
12. **Alchemy dev needs Cloudflare credentials even for local work**
    unless the Workers AI binding is excluded (it proxies remotely).
    See the conditional in `alchemy.run.ts`.

## User preferences (violating these caused rework)

- Plain pin click must NOT move the camera. ⌘-click = street-level
  zoom. Row dot click = fly + popup.
- Selected day header = accent underline, never accent text.
- Detail lines under items: indented plain lines, no card chrome.
- Rows wrap by default (a future setting may offer single-line).
- Edit affordance is a pencil (hand-tuned icon), hover-reveal on
  desktop, always visible on mobile.
- Dark mode must be designed colors, never CSS filters/inversions,
  especially the map.
- Pin palette: terracotta/berry/teal/steel/stone (`--pin-*` vars in
  `panda.config.ts`). No amber/purple.
- TODO.md style: short checkbox lines, keep `Progress: N/M` accurate.
- When consulting peer models: form your own ideas first, append theirs
  at the end, clearly attributed. Never lead with them.
- Design docs before code for anything substantial. The owner reviews
  everything.

## Locked future decisions (researched and verified, do not re-litigate)

- **Sync:** D1 + Drizzle + append-only mutation log. `TripRoom` Durable
  Object per trip applies → broadcasts → catches up. LWW conflicts, HLC
  timestamps, fractional-index `rank` (deps installed). Two users only,
  keep it simple.
- **Transit:** Transitous (MOTIS) covers EU incl. Eurostar (verified).
  Navitia is shutting down, don't use it.
- **Geocoding:** Google Places (New), plan-time only, results cached
  into trip data (now live behind `/api/places`).
- **Offline maps:** PMTiles region extract on R2 → OPFS download. The
  only legal offline option with OpenFreeMap-style tiles.
- **iOS (as of 26.5):** no vibration API, no local alarms from web,
  notifications only via Declarative Web Push on an installed PWA.
  Haptics are Android-only (`entities/haptics`).
- Voice diary port from travel v1 is parked in Phase 6.

## Repo mechanics

- `bun install` (prepare runs `panda codegen` → gitignored
  `styled-system/`). `bun run dev` → localhost:5006 (needs `.env`, see
  `.env.example`). `bun run deploy` ships prod. `bun run typecheck`,
  `bun run check:names`.
- `.claude/launch.json`: `travel-2` (full alchemy dev) and
  `travel-2-local` (plain vite, for machines without Cloudflare
  credentials).
- localStorage keys: `travel2:db:v1` (data), `travel2:theme`,
  `travel2:leftw` (split width), `travel2:ui-version` (UI generation).
- Workflow: the working tree LIVES on `bleeding-edge`, uncommitted
  until slicing. PR slices branch from `origin/main` (or their parent
  slice), then merge back into `bleeding-edge`. Full rules: CLAUDE.md.

## Compacted history

- **Pre-2026-07-07 (the local-only era):** stacked PRs built the base
  (docs → scaffold → atoms → data → dormant infra → outline → map →
  app wiring), then feature rounds added the item editor, drag
  reorder, dark map style, city chips, and theming. The Cloudflare
  infra sat dormant by design until the owner asked for it.
