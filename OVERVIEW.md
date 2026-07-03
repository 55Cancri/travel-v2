# travel-2 — Trip planner + on-trip companion

One app that replaces the **Figma bullet-list planning** + **Google My Maps pinning** combo.
Built for exactly two users. Plan on desktop, live it on mobile — offline.

First real trip: **Europe, departing July 28, 2026** (Amsterdam 5d → Paris → Belgium: Antwerp / Ghent / Brussels).

---

## The core idea

**The plan is a document. The map is a projection of the document.**

Everything you type on the left (items, addresses, times) automatically materializes on the
right (pins, routes, schedules) — and vice versa: tapping a pin highlights its item, checking
an item off marks the pin visited. One source of truth, two synchronized views.

This is the thing Figma + My Maps could never do: the words and the map never talked to each other.

## How planning actually works today (observed from Figma boards)

1. A **freeform idea column** per city — museums, food spots, "third places", links, notes.
   Unstructured, fast to dump into.
2. Ideas get **distributed into days** — some get times, some don't. Some stay uncategorized.
3. Special blocks: **lodging** (address, check-in/out, confirmation code, phone), **flights**,
   **grocery stores**, day-trip sub-cities (Antwerp/Ghent/Brussels inside "Belgium").
4. Cancelled things get **struck through but kept visible**. Rich text, small sub-notes under items.
5. Separately, pins + hand-drawn routes in My Maps. Clunky, no metadata, bad transit routing.

→ travel-2 models this flow directly: **idea pool → drag into days → refine with times/routes → check off on trip.**

---

## Data model

**Hierarchy:** `Trip → Segment → Day → Item`

- **Trip** — "Europe 2026". Date range, cover, members.
- **Segment** — a city/region with its own lodging + idea pool: Amsterdam, Paris, Antwerp, Ghent, Brussels.
- **Day** — a date within a segment. Has an ordered list of items and a computed route.
- **Item** — the atomic unit. One line of text + optional structured facets:
  - `kind`: activity / food / lodging / transport / note / todo
  - `status`: idea / planned / done / cancelled / missed
  - `place` → link to a Place (geocoded)
  - `time`, `duration`, `cost`, `confirmationCode`, `url`, sub-note text
  - Items can be **unassigned** (live in the segment's idea pool) or belong to a day.
  - Ordering via fractional index (drag anywhere, no renumbering).
- **Place** — geocoded once, cached forever: name, address, lat/lng, category/icon,
  opening hours, photo, source id. Never re-fetch on trip.
- **Leg** — cached route between two consecutive items on a day: mode (walk/transit/drive),
  duration, polyline, timetable snapshot. Computed at plan time → viewable offline.

**Database: SQL — D1 + Drizzle.** The data is genuinely relational (items by day, joins to
places, legs between items). NoSQL buys nothing here.

**Plus an append-only `mutations` table** — every change (from either user, online or offline)
is a small mutation record. This one table gives us three features for free:
1. **Sync** — offline clients queue mutations locally, push when online.
2. **Versioning** — "how did the plan look before we shuffled everything?" = replay to a timestamp.
3. **Audit/history** — who moved the Louvre to Day 6, and when.

## Sync & offline (the make-or-break feature)

Hand-rolled **mutation-log sync** — no Replicache/Electric/CRDT dependency. For 2 users this
is genuinely simple and fully debuggable:

- Client keeps a full mirror of the trip in **IndexedDB** + an **outbox** of pending mutations.
- All reads are local (instant, works offline). All writes apply optimistically to the mirror
  and enqueue to the outbox.
- When online: outbox pushes to a **Durable Object (one per trip)** over WebSocket. The DO is
  the serialization point — applies mutations to D1, stamps a global sequence number, broadcasts
  to the other client. Clients pull anything they missed by last-seen sequence.
- Conflicts: **last-write-wins per field** (hybrid logical clock). With 2 users this is the
  right amount of engineering. Reordering conflicts can't corrupt (fractional indexes just coexist).
- The same DO socket = **live collab** when both online (see each other's edits + presence).
- Alternatives considered: TinyBase (official DO sync server — the fastest path if hand-rolling
  stalls, but no history), Yjs (built for rich text we don't have), Zero (still rejects offline
  writes), PowerSync/Electric (Postgres-only). The mutation log wins because **sync, versioning,
  and audit are one mechanism** — and it's ~400 lines we fully control.

**Auth:** hardcoded 2-account login. On login, issue a long-lived signed token (~90 days) so the
app works offline for the whole trip without re-auth.

## Map stack (verified July 2026)

- **Renderer: MapLibre GL JS v5** (pin v5 — v6 is a WebGL2-only/ESM-only prerelease).
- **Online tiles: OpenFreeMap** — free, unlimited, no API key, Cloudflare-sponsored bandwidth,
  dense street-level POI labels in EU cities (better than Protomaps' curated subset).
- **Offline tiles: Protomaps PMTiles extracts on R2** — `pmtiles extract` per trip city
  (tens of MB each) hosted on R2 ($0 egress), downloaded to **OPFS** via
  `@makina-corpus/maplibre-offline-pmtiles`. Result: **full vector street-level maps in airplane
  mode**. Note: this is the *only* free **and legal** offline path — Google's and Mapbox's ToS
  prohibit tile caching outright. Protomaps basemap has sparser POI labels than OpenFreeMap;
  fine offline since our own pins carry the meaning.
- **Geocoding & place data: Google Places API (New), at plan time only.** Pattern that keeps it
  $0: Text Search with IDs-only field mask (free, unlimited) → Place Details with a tight mask
  including `regularOpeningHours` (Enterprise SKU — 1,000 free/month, plenty). Cache everything
  in `places`; zero API calls on trip. Free fallback: Photon (autocomplete) + Nominatim
  `extratags` (OSM opening hours).
- **Routing:**
  - **Transit: Transitous** (`api.transitous.org`, free community MOTIS v2 API, no key) —
    confirmed feeds for NL/BE/FR **including Eurostar (ex-Thalys AMS–BRU–PAR)** plus an EU feed
    (FlixBus, European Sleeper). One query returns "Eurostar + metro door-to-door" — exactly the
    "15-min train beats the 1-hour bus" fix. Personal use fits their terms; send a meaningful
    User-Agent. Snapshot timetables into Legs for offline.
    Fallbacks: Google Routes transit (10k free/mo), NS + SNCF country APIs. **Avoid Navitia** —
    Hove is shutting the open-source project down (Sept 2026). Escape hatch if Transitous
    degrades: self-host MOTIS on a €10 VM (loads NL+BE+FR in <2 GB RAM).
  - Walking/driving: OSRM public or openrouteservice (2k/day free); Transitous also returns
    walking transfers. Polylines cached per Leg.

## The editor (left pane)

Not a heavy block-editor library. The **stockpile-v6 checkbox-list pattern**, extended:

- One row = one item. Enter → new item below. Backspace on empty → delete. Tab → sub-note.
- **Smart chips**: the row detects structure as you type/paste —
  - address or venue name → geocode suggestion → confirm → 📍 chip + pin drops on map
  - "14:30", "2pm–4pm" → time chip; "€25" → cost chip; URLs → link chip
  - `/` command menu for kind (food/museum/lodging/transport), confirmation codes, etc.
- **Lodging & flights are just items** with kind-specific chip sets (check-in/out, code, phone) —
  rendered as a slightly richer card, like the Figma hotel blocks.
- Check-off ✓ (done), long-press/menu → cancel (strikethrough, kept), drag handle to reorder
  or move between days / back to idea pool.
- Progressive disclosure: a bare text line is always allowed. Structure is optional, added inline.

## Layouts

- **Desktop:** two panes — outline left, map right. Map expandable to full-screen for route work.
  Clicking a day scopes the map to that day's pins + route; clicking the segment shows everything.
- **Mobile:** **bottom-sheet over map** (the Google Maps / Airbnb pattern — this answers the
  "how do both fit" question): full-bleed map, draggable sheet with the day list at
  peek / half / full snap points. Full = pure checklist mode; peek = pure map mode.
- **On-trip "Today" mode:** opens to today's day, next item up top with countdown, walking line
  to it, check-off buttons big and thumbable. Haptics on check-off (Android; iOS PWA has no
  vibration API — accept it).

## Route intelligence ("optimize my day")

Hybrid, not magic:
1. **Deterministic data assembly** — opening hours (cached), fixed-time constraints (ticket
   entries, check-out times), travel-time matrix between the day's places (routing API).
2. **Solver/LLM proposes** an ordered schedule with start times: v1 = LLM (Claude) given the
   assembled facts, because it can also respect fuzzy prefs ("lunch ~1pm", "nap after 3pm",
   "we're slow in mornings"). Later: greedy TSP-with-time-windows if we want determinism.
3. Proposal lands as a **new version of the day** — accept, or edit (insert chill block, stretch
   lunch) and see downstream impact (recomputed leg times, "only 45 min left at the Rijksmuseum ⚠").

## Voice diary (phase 2 — port from travel v1)

Long-form recording → MediaRecorder chunks → local storage (OPFS) → background upload to R2 when
online → transcription + AI daily summaries. travel v1 already proved the recording UX; carry the
pattern, replace SST/AWS with Workers/R2.

## Notifications / alarms (phase 1.5) — iOS reality (verified July 2026)

- **No local/scheduled alarms exist on the web on iOS. Period.** (Notification Triggers dead,
  Background Sync unsupported in Safari.) The only mechanism: **server-side push at the scheduled
  time** — Durable Object alarm fires → **Declarative Web Push** (iOS 18.4+, no service worker,
  guaranteed display) to the **installed** PWA. "Louvre entry in 45 min — leave now, 38 min by metro."
- iOS requires Add-to-Home-Screen install for push (iOS 26 made every A2HS site a web app by
  default). Permission needs a user gesture. Delivery is best-effort (Low Power Mode can defer).
- **Vibration/haptics: Android only.** `navigator.vibrate` has never worked on iOS and the
  checkbox-switch haptic hack was patched out in iOS 26.5. Design check-off feedback as
  animation+sound on iOS, vibration on Android.
- Fallback: email (2 users, trivial — SES pattern already exists in stochastic-v3).

---

## What's deliberately CUT from v1 (so it ships before July 28)

- ❌ Voice diary (phase 2 — but keep R2 + data model ready)
- ❌ Push alarms (phase 1.5)
- ❌ Optimize-my-day LLM (phase 1.5 — but cache the inputs from day 1)
- ❌ Time-travel UI (the mutation log records everything from day 1; build the viewer later)
- ❌ Free-drawn routes, arbitrary lines (My Maps cruft — routes only connect items)
- ❌ Photos/cover images beyond Place photos
- ❌ Any public signup/user management

## v1 = smallest lovable version

Outline editor with smart chips ✚ geocoded pins ✚ day route lines ✚ offline PWA with sync
✚ check-off / cancel / drag ✚ lodging & flight cards ✚ **paste-import of the existing Figma plan**
(LLM parses the current Amsterdam/Paris/Belgium dump into structured items — instant migration,
day one of using the app is with real data).

---

## Carry-over inventory (from sibling projects)

### From stochastic-v3 (`../stochastic-v3`)
- **`alchemy.run.ts`** — the whole pattern: D1 (`adopt: true`, migrations dir), SQLite-backed
  Durable Object namespaces, `TanStackStart("website", …)` worker with bindings, `req()` env-var
  assertion, encrypted secrets, `alchemy deploy --env-file .env`. Port nearly verbatim.
- **Panda CSS setup** — rhythm spacing (0.25lh–2.5lh), semantic surface/text tokens, `cols`/`rows`
  grid utilities, dark mode via `data-theme`.
- **Drag-reorder hook** (`src/cells/grocery-list/use-drag-reorder.ts`) — MotionValue-per-row,
  tuned springs (700/42 drag, 560/38 drop), `flushSync` atomic reorder. Port as-is.
- **Fractional-indexing** (`generateKeyBetween`) for ordering — survives concurrent reorders.
- **Checkbox component** (`src/atoms/blocks/checkbox`) — animated pathLength check, a11y.
- **Row = `<label>` wrapping input** — tap anywhere focuses, native mobile keyboard. Drag handle
  isolated to pointerdown. Safe-area insets.
- **Realtime layer** (`src/entities/realtime/*`) — WebSocket Hibernation DOs, presence as
  connection-token sets, "changed" notification → authoritative refetch. travel-2 simplifies to
  **one TripRoom DO** (2 users; the two-tier UserHub/ListRoom split is unnecessary) and upgrades
  the payload from "something changed, refetch" to actual mutation records (needed for offline).
- **Draft-row lifecycle** (`draft:${seq}` ids, single in-flight persist promise) — avoids dupes.
- **Mutation-log precedent**: `grocery_list_events` table (op_id, client_id, payload_json,
  unique (list_id, op_id)) — travel-2's `mutations` table is this, promoted to the sync backbone.
- **SES email via aws4fetch** (`src/entities/email`) — if we want email alarms.
- **Sessions**: 90-day cookie sessions table + opportunistic GC. Strip OAuth; seed 2 users.

### From stockpile-v6 (`../stockpile-v6`)
- **Keyboard/focus engine** (`packages/desktop/src/uis/atlas/tasks/`) — Enter inserts + autofocus
  via `pendingFocus` ref, Backspace-on-empty deletes + focuses previous, blur-trim removes empties,
  last row always remains as prompt. ~700 lines total, minimal deps — the editor blueprint.
- **Grip presence states** (hidden / inert / active) — no clutter until a row earns a handle.
- **Layout stability** — fixed-width grip+checkbox columns, placeholder square, zero shift.
- **"N of M done" score badge** — exactly the progress counter we want per day/trip.

### From travel v1 (`../travel`) — phase 2, voice diary
- **Recording engine** (`packages/client/src/storage/recording/`, `hooks/use-audio-recorder/`) —
  MediaRecorder with 60s timeslices, AAC-mp4 preferred codec, IndexedDB `recordings` + `chunks`
  stores (compound key `[recordingId, sequence]`), pause/resume, crash recovery, Wake Lock.
- **Upload**: presigned-URL direct-to-bucket → for travel-2, R2 presigned PUT instead of S3.
- **Processing pattern**: queue → transcribe (Deepgram nova-3, diarization) → LLM title/journal.
  On Cloudflare: R2 event → Queue → Worker.
- **Playback**: RAF-driven (60fps) word-level transcript highlighting.
- **Content block model** (text / diarized-text / media discriminated union) — reuse for diary.
- Known jank to avoid: stubbed auth, iOS mime quirks, thin error paths.

## Open questions

- [x] ~~Transitous coverage~~ — verified: NL/BE/FR + EU feeds, **Eurostar included**
- [x] ~~PMTiles extract size~~ — verified: tens of MB per city extract, trivially on-device
- [x] ~~Google Places pricing~~ — verified: $0 at our volume with IDs-only search + tight masks
- [x] ~~iOS haptics~~ — verified: none possible (26.5 patched the last hack); Android only
- [ ] iOS PWA: verify install + Declarative Web Push on the actual phones before the trip
- [ ] Trip region extract generation: local `pmtiles extract` as a build step vs on-demand Worker
- [ ] Transitous reliability under load in late July (no SLA) — snapshot legs early as hedge
