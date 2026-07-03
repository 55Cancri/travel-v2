# travel-2 — checklist

**Progress: 46 / 82**  _(update both numbers as tasks are checked / added / removed)_

## Phase 0 — Scaffold
- [x] Scaffold TanStack Start + React 19 + Vite project
- [x] Port Panda CSS config + rhythm tokens + cols/rows utilities (warm palette, Instrument Sans)
- [x] Path aliases (atoms/ cells/ entities/)
- [x] Port atoms (Block/Button/Input/Text/Link/Checkbox) + icons + haptics from stochastic-v3
- [x] Local dev server runs (`bun run dev` → localhost:5006)
- [x] Port `alchemy.run.ts` (D1, TripRoom DO, worker) — present but dormant, no deploy
- [ ] Deploy to Workers — deferred by choice
- [ ] Auth: seed 2 users, 90-day session — deferred
- [ ] R2 bucket (tiles now, audio later) — deferred

## Phase 1 — Data (local mock now, sync backbone later)
- [x] Normalized trip model: Trip → Segment (city + idea pool) → Day → Item
- [x] Module store + useSyncExternalStore + localStorage persistence (+ reset button)
- [x] Seed = the real Europe 2026 trip with real coordinates
- [x] Drizzle schema: trips, segments, days, items, places, legs, mutations — written, dormant (no migrations yet)
- [ ] Mutation type contracts (create/update/move/status/delete per entity)
- [ ] IndexedDB mirror + outbox (offline writes)
- [ ] TripRoom Durable Object: apply → D1, broadcast, catch-up, LWW conflicts
- [ ] Export/backup trip JSON button

## Phase 2 — Outline editor (left pane)
- [x] Item row: label-wrapped input, animated checkbox, grip handle
- [x] Enter inserts below + autofocus; Backspace-on-empty deletes; blur-trim
- [x] Drag reorder within a section (ported spring physics + flushSync commit)
- [x] Variable-height drag: rows with cards/notes slot correctly (midpoint crossing + lifted-height shifts)
- [x] Multiline paste → one item per line (bullets stripped)
- [x] Done / cancelled statuses (strikethrough kept visible, hover ✕ / restore ↺)
- [x] Time chip + colored place dot (click = fly map); small note line under items
- [x] Lodging / flight detail cards (address, check-in/out, confirmation, phone)
- [x] Idea pool per city + day sections, each with "N of M done" badge
- [x] Editable trip name + city name; + city, + day buttons
- [x] Item editor (pencil → bottom sheet on mobile / modal on desktop): kind picker,
      time, cost, link, note, booking details, cancel/restore, delete
- [x] Sticky headers: city bar (name + date range) always pinned; day headers stack beneath it
- [x] Row text wraps onto extra lines by default (auto-growing rows, first-line-aligned controls)
- [x] Themed consistent scrollbars on the outline pane
- [x] Blue focus rings app-wide (focus tokens — replaced the emerald/terracotta clash)
- [x] Hand-tuned dark map theme: repainted OpenFreeMap dark layer-by-layer (warm base,
      night-teal water, dark-green parks, amber motorways, brighter labels) — spec-validated
- [x] City chips: ✕ on the active chip deletes the city (confirms with item count; empty = instant)
- [x] Darker hover circles in dark mode (surface-hover token)
- [x] City chips: outlined restyle, hold-drag to reorder, + City
- [x] Done items get strikethrough; checkbox animates both ways (draw / retract + color fade)
- [x] Ghost add rows: stroke-matched SVG plus, aligned to checkbox column (incl. Add day)
- [ ] Drag items BETWEEN sections (idea pool → day) — next up
- [ ] Smart chips: detect times, costs, URLs while typing
- [ ] Day title editing ("To the beach")
- [ ] Follow-ups / "still to figure out" list per trip
- [ ] Settings menu (first setting: wrap vs single-line rows)
- [ ] Global paste box (bottom of outline or in Ideas) — decide placement with the magic-paste work

## Phase 3 — Map (right pane)
- [x] MapLibre GL + OpenFreeMap street-level basemap (free, keyless)
- [x] Pins colored by kind, dimmed when done, popup with place name
- [x] Scoping: Ideas/day header click → map shows just that; city chip → everything
- [x] Day route line (dashed, straight-line v0) following plan order
- [x] Pin click → highlight + scroll to row; row dot → fly to pin
- [x] Mobile: full-screen map toggle (floating pill)
- [x] ⌘D dark mode — whole app + map style swap (OpenFreeMap liberty ↔ fiord)
- [x] Row dot → fly + popup with name & address; popups theme-aware
- [x] Dark pins: bare color (no ring/shadow), softened palette; hover pop-above
- [x] Re-clicking the selected day recenters the map
- [x] Resizable split divider between outline and map (persisted width)
- [x] Camera only refits on scope change; plain pin click never moves it; ⌘-click = street zoom
- [x] Pin palette rework: terracotta/berry/teal/steel + theme-adaptive ring (no white halo)
- [ ] Geocode as you type (Google Places) → confirm → pin drops
- [ ] Real walking/transit legs (Transitous) + cached timetable snapshots
- [ ] Opening-hours chip + "open now" pin state
- [ ] Desktop: map expand to full-screen
- [ ] Upgrade mobile toggle → draggable bottom sheet (peek/half/full)

## Phase 4 — Offline PWA (delayed, by choice)
- [ ] Manifest + service worker, installable
- [ ] IndexedDB mirror = offline reads + queued writes
- [ ] PMTiles trip-region extract on R2 → OPFS "Download trip maps"
- [ ] Airplane-mode end-to-end test on both phones

## Phase 5 — On-trip polish
- [x] Haptics on tap/grab/check-off (Android; iOS has none — verified)
- [ ] Today view: next-up item, countdown, big check-off
- [ ] Magic paste: text / confirmation emails / images → LLM → structured items on days
- [ ] Paste triage UX: ambiguous paste asks a mini-questionnaire; undated stuff lands in a trip-level brain-dump inbox to sort later
- [ ] Point-Me compass arrow (DeviceOrientation full-screen arrow to next stop)
- [ ] Import the full real Amsterdam/Paris/Belgium plan via magic paste
- [ ] Practice run: plan + walk a local day before July 28

## Phase 6 — Post-v1 (parked, not forgotten)
- [ ] Optimize-my-day: constraints + travel matrix + LLM proposal, versioned per day
- [ ] Web push alarms (DO alarms → Declarative Web Push; iOS needs installed PWA)
- [ ] Time-travel viewer (replay mutation log; before/after)
- [ ] Presence: see partner's active day/item live
- [ ] Voice diary port from travel v1 (MediaRecorder → OPFS → R2 → transcribe)
- [ ] Day cover images (Place photos)
