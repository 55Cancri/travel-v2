# Agent handoff: travel-2

_Updated 2026-08-06, MID-ROUND: the scout overhaul below is in progress. Resume from its checklist._

## How this file works (read me first)

This file exists so a FRESH agent with zero context or memory can resume
exactly where the last session stopped, even mid-implementation. Read
[OVERVIEW.md](OVERVIEW.md) (design vision) and [TODO.md](TODO.md) (the
authoritative checklist, keep its `Progress: N/M` counter accurate)
alongside it. Maintain it like this:

- **Write the round's PLAN here BEFORE implementation begins** (owner
  directive 2026-07-11): a `## Round:` entry opens with the planned
  work as a checklist plus the design decisions already made, THEN the
  work starts and items get checked off as they land. A session cut off
  mid-round leaves a fresh agent the exact remaining checklist, not a
  mystery diff.
- **Every work round appends a `## Round:` entry at the TOP** (newest
  first): what shipped (with file paths), what is mid-flight (the exact
  resume point: file, branch, next command, the decision already made),
  what the round queued, and what the owner still needs to verify or
  decide.
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

## Round: chevron as one bubble outline + aligned X column (planned 2026-08-07)

Owner feedback (screenshots): (1) the pin-card arrow STILL reads as its
own bordered shape, the card border runs behind it; (2) in the sidebar
the header X and the input remove X's are different sizes and not on
one vertical line ("inputs can move a little more right"); (3) wants
shortcut SUGGESTIONS ONLY (no implementation yet) for two chords that
work while focused in an input: toggle sidebar (replacing bare "s") and
toggle zoom-all-pins vs zoom-to-focused. Constraints: Dia browser owns
Cmd+S; Cmd+F/Z/X/C/V/W/T/N are out; he prefers Cmd+letter-ish, dislikes
Ctrl.

Design decided before implementation:

- Chevron root cause: the old svg's fill was only the triangle BELOW its
  base line and the stroke straddled the border row, so the border's
  lower half stayed visible across the notch no matter the offset. New
  design: the fill is a rect straddling the border (3px into the card
  interior through the full border row, spanning the slant endpoints)
  PLUS the triangle, so the crossed border segment is genuinely blanked;
  a separate stroke path draws only the two slants, endpoints on the
  border's centerline, round caps/joins. Svg becomes 12x10, offsets
  recomputed per anchor (padding-box coords, so each carries the 1px
  border conversion).
- X column: remove-X goes 16 -> 18 (all X's and pluses now 18) and the
  remove IconButton gets the same negative right margin the sidebar
  header X already uses (glyph flush with the content edge), which also
  widens the input toward the right edge, exactly the owner's hunch.
  The drawer's header plus gets the same margin so the phone sheet's
  corner glyph aligns with its rows too. AddPlaceRow keycaps stay: they
  are tuned against the single-line (full-width input) geometry, which
  this does not change.

Checklist:

- [x] pin-cards: new chevron geometry (fill blanks the border, slants
      stroke from its centerline), offsets for all four anchors
- [x] query-input: X 18 + edge-flush margin; drawer plus margin;
      sidebar header comment updated
- [x] typecheck + 72 tests + check:names + em-dash grep, committed
      9f2d458 on slice/38-scout-overhaul (pushed), merged to
      bleeding-edge
- [x] deployed to prod (website updated, travel-v2.leaftime.workers.dev)
- [x] Sol review of 9f2d458 landed (note: `--search` goes BEFORE `exec`
      in the codex CLI or it errors). It caught a REAL blocker: the two
      fill subpaths wound in opposite directions, and the nonzero fill
      rule cancels opposite windings where shapes overlap, so the outer
      half of the border row stayed transparent across the notch base.
      Fixed by winding the triangle with the rect (6428fc5, with the
      three straggler X's: route-strip and suggestion-rows joined the
      18px edge-flush column, maps-menu X went 18). Verified by
      shoelace signs, not just Sol's word. Sol's remaining note, NOT
      acted on: on classic-scrollbar systems the sidebar rows sit
      inside the scroller while the header is outside, so a visible
      scrollbar would shift row X's left of the header X. Owner is on
      macOS overlay scrollbars; revisit only if a Windows/Linux user
      appears. v1's X size={11} left alone (older surface, deliberate).
- [ ] report with shortcut suggestions (Cmd+B or Cmd+\ for sidebar,
      Cmd+0 for fit-all; Shift+letter cannot work inside inputs since
      it types capitals; no single unmodified key works inside inputs)

Resume notes for a fresh agent: the working tree lives on bleeding-edge
(HANDOFF edits stay here; code went to the slice via the stash dance:
`git stash push HANDOFF.md`, checkout slice, commit, push, checkout
bleeding-edge, merge, `git stash pop`). The owner's dev server runs via
the `travel-2` launch entry on port 5006; it has died between rounds
twice this session, restart it if down. All three launch entries pin
port 5006, so the agent-door server cannot run beside the owner's:
visual verification of the notch is delegated to the owner's HMR
session. Shortcuts are SUGGESTIONS ONLY this round, owner picks before
any implementation.

Owner: a hamburger at the top left; clicking it slides out a sidebar
where the search input and results live. The floating panel stays for
now. The sidebar animates out and in.

Decisions before implementation:

- The route strip + query lines block now renders in THREE surfaces, so
  it extracts into one component (`query-panel/line-stack.tsx`) used by
  the floating panel, the phone sheet, and the new sidebar.
- Sidebar open UNMOUNTS the floating panel: two mounted copies of the
  lines would re-run every search twice (the exact double-search bug
  just fixed on phones), and two simultaneous search surfaces is noise.
  Closing the sidebar brings the panel back; results and ticks live in
  the screen reducer and survive the swap.
- The hamburger is wide-window only (phones keep the search sheet), top
  left above the mobile maps spot. New three-bar icon at
  `atoms/icons/menu`. Sidebar: full height, left edge, spring in/out
  via AnimatePresence, no backdrop (the map stays usable beside it),
  close X in its header.

- [x] atoms/icons/menu (three bars), exported through icons door AND
      the atoms door's named list (it does not wildcard).
- [x] line-stack.tsx extraction; the floating panel consumes it (the
      phone sheet keeps its own arrangement around suggestions).
- [x] search-sidebar/: 24rem, full height, left edge, spring in/out,
      no backdrop, header with plus + close. Wired: hamburger top left
      (wide only), `docked` state, panel renders only when
      wide && !docked.
- [x] typecheck, 68 tests, check:names, dev server compiles clean.
      Pane could NOT verify visually this time: the running server is
      the real door and agent credentials only fit the fixture door.
      Owner is at the screen with HMR; his eyes are the visual check.
      Deployed; on PR #38.
- [x] Owner follow-up mid-round: the sidebar must PUSH the map right,
      not overlay it. First cut animated the wrapper's left edge, which
      the owner immediately caught flickering: a layout animation makes
      the resize observer call map.resize() EVERY FRAME of the slide.
      The push now animates as a pure transform (zero resizes
      mid-slide) and settles into real layout at the boundary, exactly
      one resize per toggle, interruption-safe in both directions. A
      gotcha worth keeping: never animate a MapLibre container's
      layout, animate a transform and settle once.
- [x] Owner: a bare "s" toggles the sidebar (he corrected an initial
      Cmd+S reading), ignored while focus is in an input, textarea, or
      contenteditable.
- [x] Round: scoped results + on-demand sweep + chevron border math
      (planned AND LANDED 2026-08-07, 72 tests, deployed). Owner flagged three things and endorsed the
      focused-input design ("results scoped to which input is
      focused"). Decisions:
      (a) INPUTS GROUP AT THE TOP, one results region below shows the
      ACTIVE line's results only. The map stays the aggregate (every
      line's ticked pins persist in their line colors), the list is the
      active query's workspace, the input color dots carry the mapping.
      Active line lives IN THE REDUCER (state becomes
      { lines, activeId }, new "focused" action; added activates the
      new line; removed falls back to a neighbor). The line's search
      effect stays with its input (all lines keep searching), only
      results RENDER for the active line. query-line.tsx splits:
      query-input.tsx (input row, search effect, Cmd+Enter, focus
      announce) + query-results.tsx (status line, sections, row
      handlers, tickingRef, highlight + keyboard). The keyboard
      listener moves to query-results (exactly one mounted, replacing
      the `primary` prop): document-level, arrows/Enter also accepted
      when the target IS a query input (aria-label match), j/k only
      outside editables. The sticky strip becomes the whole input
      GROUP + Add place row, in line-stack. The phone sheet adopts the
      same composition (suggestions, inputs, active results).
      (b) The Overpass sweep goes ON-DEMAND: no automatic sweep, no
      surprise "In this view" section. A ghost row under the engine's
      results ("Find every match in this view") asks for it per query;
      line gains sweepAsked (reset by typing), findPlaces gains a
      wantSweep gate, sweep notices only when asked.
      (c) Chevron gap root cause: absolute children position from the
      PADDING box, so every offset sat 1px (the card border) low,
      leaving one border row visible across the notch base. Offsets
      get the border baked in (above h-3, below -7, right base -9.5,
      left w-4.5).
- [x] Third Add place nudge, LANDED: the label sat half a step right
      because the button atom declares columnGap sm and a LONGHAND
      outranks a consumer's gap shorthand in the style merge; columnGap
      xs on the row closes it. Cascade trap for the standing gotchas:
      when overriding an atom's spacing, match the atom's own property
      form (longhand vs shorthand), or the atom wins silently. Deployed.
- [x] Owner's second Add place correction, LANDED: the label centered
      because the BUTTON ATOM centers its slot items (justifyItems
      start on the row fixes the cell; remember this for any grid built
      inside Button), keycaps end at the input's INNER right edge, the
      row drops an sm rhythm step below the input, and the Plus GLYPH
      itself tightened from a 14 to a 12 unit span to match the X's
      diagonals, evening every plus/X pairing in the app. Deployed.
- [x] Owner correction on the Add place row, LANDED: it is input
      furniture, not a list row. It moved INTO the sticky strip under
      the input (above the results, outside the arrow-key walk), on the
      last line only. Plus centers under the color dot, label flush
      with input text, keycap hints flush with the input's right edge,
      keycaps raised (1px sides, 3px bottom, drop shadow) with a "+"
      between Command and Return. Deployed.
- [x] Owner: an "+ Add place" ghost row below the lines, LANDED (70
      tests incl. append-order; deployed): the
      row (or Cmd+Enter from an input) appends a NEW query line and
      focuses it. Lines flip from prepend to APPEND so the fresh input
      lands below its predecessor, shift+tab walks back up naturally,
      and the ghost row reads as the list's growing edge. Right side of
      the row: keycap hints, a new Command icon and a KeyReturn icon
      (top line left to right, down, then left with the arrowhead).
      A fresh line is empty so it shows no results by construction.
      Files: atoms/icons/command + key-return, lines.ts (append),
      query-panel/add-place-row.tsx, line-stack wiring + last-input
      focus, query-line Cmd+Enter (before the plain-Enter branch, which
      would otherwise toggle the highlighted row), sheet passes the
      shortcut through.
- [x] Owner's fourth pass: the notch is REBUILT as a chevron svg whose
      base line lies on the card's border row (fill blanks the border
      segment, stroked slants rise from the line itself, rotated per
      anchor); the rotated-square approach could never truly meet the
      outline and is gone. And a never-closing door says "Open 24
      hours" / "24 hours" via an `always` flag on the verdict, from
      both grammars (Google one-period-no-close, OSM no-next-flip).
      Tested; deployed. Owner's eyes still owed to the chevron.
- [x] Owner's third pass, ALL LANDED (69 tests incl. a regression test
      for (a); deployed): (a) BUG, the checked pin vanished
      when the sweep landed/failed: each source's answer replaces the
      sections wholesale and the replacements are coordinate-less
      copies, so the tick survived but the pin could not stand; the
      reducer now carries resolved facts (coords, address, hours) over
      by id. (b) Ticking a google hit now fetches its HOURS (Enterprise
      flavor, one per tick, 30d cached): the card said nothing and the
      owner expected times; while the ask is out the card says "Loading
      times...". Finding gains spotHours + hoursKnown, verdicts unify
      in findingOpenVerdict, saves prefer spotHours and a no-hours
      answer writes hours {kind:"none"} so loading ends. (c) Card
      cosmetics: radius down a step, the notch gets a REAL border on
      its two exposed faces and sits above the card edge so the outline
      reads continuous around the arrow. (d) Checkbox slides back left
      to the input's left edge (text stays flush with input text, the
      gap absorbs the difference). (e) The input row turns sticky in
      the scroll body, so results can never scroll the input away.
      (f) Mid-round owner catch: unchecked boxes went BLACK, a
      pass-through trap now fixed in the alloy: a caller's ternary
      passes borderColor undefined on its idle branch, the spread
      overrode the alloy's ladder with undefined, and CSS's default
      border-color is currentColor. The alloy peels borderColor off and
      falls back to its ladder when the override is undefined. Lesson
      for every alloy: explicit-undefined consumer props must not
      clobber computed defaults.
- [x] Owner's second results pass, ALL LANDED (details below):
      (a) input dot gets symmetric spacing (edge->dot = dot->text, gap
      rises to the pad's 0.5lh); (b) checkbox centers under the input's
      dot and the row text sits FLUSH with the input text (indent
      calc(0.5lh + 1px - 0.35rem) from the gutter, row gap xs, the
      arithmetic lands within half a px); (c) arrows work WITHOUT input
      focus too, plus j/k (document listener on the primary line only,
      editable targets ignored so typing never triggers it, Enter acts
      unfocused as well), and ArrowUp clamps at the first row instead
      of walking off it; (d) checkbox border lifts to text-muted while
      its row is highlighted (border-strong drowns on the gray);
      (e) OWNER DECIDED the dark shell: new surface-shell token
      (white / #211E1B) for the big search surfaces (sidebar, sheets,
      floating panel), one step deeper than panel; (f) the search input
      digs a darker well (bg surface-page) so it stands out on the
      shell; (g) the stale "Centre the map here" title tooltip goes.
- [x] Owner's results-list design pass: highlight is a neutral gray
      (surface-muted) running EDGE TO EDGE (rows bleed the md gutter,
      floating panel body moved sm to md so all three search surfaces
      share the geometry), address/hours lines xs -> sm, checkbox
      thinned (1.5px border, 3-unit tick) to match text stroke, and a
      RESERVED status line under the input ("Looking for
      suggestions...", sweep notice, failure + retry, empty verdict)
      that holds its space when silent so results never jump. The
      surface-hover flag below is RESOLVED: dark value dropped to
      stone.700. HELD for owner: darkening surface-panel in dark mode
      (inputs/popovers share the token and would lose their step
      against the page); revisit if dark panels still read washed out
      with the new highlight.
- [x] Owner: "arrows do nothing". They did everything invisibly: in
      dark mode surface-hover and surface-panel are the SAME stone.800,
      so the active-row highlight had zero contrast exactly where the
      rows live. Highlight now rides accent-soft (the app's established
      highlighted-row token). FLAGGED for an owner decision, standing
      issue: every surface-hover fill on a PANEL surface is invisible
      in dark mode app-wide (icon-button hover wells in sheets, the
      sidebar, popovers). Fix candidates: darken surface-hover's dark
      value one step (stone.700, but that collides with surface-muted)
      or introduce a panel-hover token. Do not change silently, the
      token is used across the whole app.
- [x] Owner: arrow keys walk the visible result rows while focus stays
      in the input, Enter is ONE action per row (unchecked: check and
      fly; checked: uncheck, camera still). Highlight resets keyed on
      row IDS, not array identity, because resolving a google hit's
      coordinates replaces the array mid-flow and would otherwise wipe
      the highlight between the check and the uncheck. Active row shows
      surface-hover and scrolls itself into view in the branch list.
- [x] Owner: placeholder de-noised to "Search places", and the plus/X
      pair truly matched at last: the X was a FILLED Phosphor-bold
      shape beside a 2px-stroke plus, so equal nominal sizes could
      never look equal. The X redrew as a stroke icon on the plus's own
      grid (one unit narrower, diagonals read larger), consistent at
      every X site in the app.
- [x] Owner screenshot pass on the sidebar header: Escape closes the
      sidebar (deferring to any open sheet's own Escape), opening
      autofocuses the first query input, ONE type treatment on the
      header (md 550, phone sheet matched), both glyphs 18 (plus was
      visibly smaller), and the close button's inset margined away so
      its glyph aligns with the input's right edge.
- [x] Owner: the settle still "jumped". Root cause: a MapLibre resize
      keeps geography centered on the NEW canvas center, so the one
      resize per toggle shifted the world by half the sidebar width.
      The map api gained shiftBy (instant pixel pan) and both settle
      points compensate in the same frame. The full lesson for the
      standing gotchas: never animate a MapLibre container's layout
      (per-frame resizes flicker), animate a transform, settle layout
      once, and pan back half the width change at the settle.

## Round: place-drawer polish + connect feedback (planned 2026-08-06)

Owner's second phone pass, his items in his order:

1. "Closes 17:00" reads as a train timetable; he wants "5p" (compact
   12-hour: "5p", "5:30p", "12p").
2. Place drawer: name input has too much padding, the address hugs the
   input, the address wants a map-pin icon on its left, the sheet should
   carry TWO font sizes only (small labels, regular everything else,
   hours included), and Done becomes a BLUE button at input height.
3. The sheet drag handle sits too close to the drawers' top edge.
4. Connect mode: tapping the toggle then pins drew no routes for him.
   Every link of that chain reads correct on audit (canvas handlers,
   promote, chain, edge mutation, plan effect, draw effect), and the
   hidden pane blocks a live repro, so this round ships the missing
   FEEDBACK: a floating status chip while connecting (tap count, then
   the routing notice, which mobile could not see at all before). If it
   recurs, the chip pinpoints the breaking link: chip stuck at 1 after
   two taps = tap handling; chip counts but no line = plan/draw.
5. Connect toggle active = blue with a white icon (accent read as just
   another tile).
6. Search icon moves ABOVE the connect toggle.

Decisions: compact clock lives in scout's open-now (entities/osm keeps
its 24h label for the planner); blue = the focus-ring blues (blue.500,
blue.400 dark), the one blue already in the system.

- [x] compactClock in open-now.ts ("5p", "5:30p", "12p"), both OSM and
      google verdict paths, tests updated.
- [x] Place drawer: address row with MapPin icon (hours line indents to
      match its text), two type sizes only (xs labels via FieldLabel,
      md values), compact input (py 0.35lh), blue Done/Save at input
      height (blue.500, blue.400 dark).
- [x] Sheet: handle now pt sm off the top edge.
- [x] Chrome: search above connect; active connect tile blue.500 with a
      WHITE glyph. Two cascade traps found live: an IconButton color
      prop loses to the Button atom's aria-pressed color (the glyph got
      a colored span wrapper instead), and a color on the tile Block
      never reaches the svg because the button's own color interrupts
      inheritance.
- [x] Connect status chip, bottom center while connecting: "Tap pins to
      connect them" -> "1 place in the chain · tap the next" -> "N
      places connected", with the routing notice underneath (mobile's
      first sight of routing failures).
- [x] planEdges unit tests with mocked routers: walkable pair takes the
      foot router; a bus-only edge whose router answers a walking
      itinerary straightens + notices (and the mock asserts
      transitModes=BUS reached the wire). 68 tests green.
- [x] typecheck, tests, check:names, em dash grep clean. Verified in
      the pane (DOM level, map still cannot boot in a hidden pane):
      search at y50 above connect at y92, active tile rgb(59,130,246)
      with white glyph, chip renders. Deployed; on PR #38.
- [ ] The routes-not-drawing report itself remains UNREPRODUCED: every
      link of the chain audits clean and the logic layer is now
      unit-tested, so the owner should retry WITH the chip visible; the
      chip's count pinpoints the failing link if it recurs (stuck at 1
      after two taps = tap handling; counts but no line = plan/draw,
      and the notice will say which).

## Round: mobile follow-up: a tapped result becomes a pin (planned 2026-08-06)

Owner, testing on his phone: after closing the search drawer nothing he
found stands on the map, and getting back to a place means reopening the
drawer, seeing his picks, and tapping a row again. Pins must be visible
on the map whether or not the drawer is open.

Diagnosis: ticked pins DO persist across drawer close (the line state
lives in the screen, not the sheet). What actually happened is the
gesture gap: on a phone the natural press is the result ROW, and a row
press only flew the camera; the pin existed only behind the small
checkbox. So the owner flew somewhere, nothing was pinned, and the map
looked empty. A second fault sat underneath: the desktop panel is only
CSS-hidden on phones, so its copies of every query line stayed mounted
and ran duplicate searches (the promise-joined client cache absorbed the
Google spend, but the Overpass sweep ran twice).

Design, decided before implementation:

- **Pressing a result row pins AND flies, one behavior on every width.**
  The checkbox stays as the explicit toggle (and the only way to
  UN-show), but the row press routes through the same guarded
  ensure-shown path (in-flight set stops a double tap from un-toggling).
- **One search surface mounted per width.** The panel mounts only on
  wide windows (a matchMedia hook), the drawer only exists on narrow
  ones; CSS-hiding a component whose effects fire network requests was
  the wrong tool. Closing the drawer aborts an in-flight sweep and a
  reopen relaunches it; the answered results and ticks live on in the
  screen's reducer either way.

- [x] query-line: ensureShown shared by tick and row press; row press
      pins then flies; checkbox remains the un-show.
- [x] scout index: useWideWindow hook (matchMedia, 768px), panel
      conditionally mounted, drawer/panel never both live.
- [x] Verified in the pane: at 375px the panel is absent from the DOM
      and the search button shows, at 1280px the panel mounts (the hook
      re-rendered live across the resize). Typecheck, 66 tests,
      check:names clean. Pin persistence across sheet close follows
      from the reducer living in the screen; the owner's phone is the
      final check. Deployed.

## Round: scout overhaul: Google search, tooltips, drawers, connector, maps (planned 2026-08-06)

Owner ask, translated to product terms, all accepted for this round:

1. **Search must localize.** Typing "Hotel Hoy Paris" while the map sits on
   Amsterdam must surface the Paris hotel, never a wall of Amsterdam
   hotels. A city name in the query scopes results there. Fresh results
   replace stale ones wholesale, nothing accumulates.
2. **Search must feel like a payment form's address field** (instant,
   typo tolerant, name or address, "281" starts completing a street).
   DECIDED by owner 2026-08-06: Google Places Autocomplete (New) becomes
   the primary engine, proxied through our worker with KV cache and
   monthly ceilings exactly like the ratings route. Overpass keeps only
   its real job, "every branch inside this view", demoted to a clearly
   labeled second section. Photon leaves scout (v1 planner keeps it).
3. **Every shown pin carries a persistent mini tooltip card**: name line
   (custom label wins, then resolved place name, then street), and an
   hours line ("Closes 21:00", or the day's hours). Cards dodge each
   other but always point at their pin. DECIDED: hours come from OSM tags
   for free, plus one Google hours fetch when a place gets pinned (own
   small ceiling, 30 day KV cache).
4. **Mobile gets drawers** (bottom sheets animating up). A search icon
   opens the search drawer: results stream as you type, and until typing
   starts it suggests saved, recent, and common searches (typing filters
   them). Tapping a pin or its card opens the place drawer: rename,
   color swatches, save into the current map. DECIDED: desktop keeps the
   floating panel, mobile gets the drawers, internals shared.
5. **Connector mode**: a mode toggle, then tapping pin A then pin B draws
   a routed edge between them. Tapping an edge opens a drawer to filter
   its transport modes (walk, bus, tram, train, metro, ferry) and the
   route redraws under that filter. Verified against the MOTIS spec: the
   plan endpoint takes `transitModes` (comma separated, e.g. TRAM,BUS).
6. **Multiple named maps**: a menu lists them, create, rename, drag to
   reorder, delete with confirm. Saved searches persist across maps.

### Design decided before implementation

**Billing shape (verified against Google pricing docs 2026-08-06):**

- NO autocomplete session tokens, deliberately. A session terminated by a
  Pro or Enterprise details call bills at the priciest SKU (Enterprise +
  Atmosphere, only 1k free events per month). Sessionless autocomplete
  keystrokes ride the Essentials tier (10k free per month) and the KV
  cache absorbs repeats. At two users this stays at $0.
- Autocomplete field mask asks only for placeId, text, structuredFormat,
  types. The suggestion's mainText IS the display name, so details never
  needs displayName (that would move details from Essentials to Pro).
- Details come in two flavors on one route: `locate` (location +
  formattedAddress, Essentials SKU, 10k free) fetched when a Google row
  is ticked, tapped, or flown to, and `hours` (adds regularOpeningHours,
  currentOpeningHours, utcOffsetMinutes, Enterprise SKU, 1k free)
  fetched ONCE when a place is pinned into a map. Separate monthly
  ceilings: autocomplete 9000, locate 9000, hours 800. All cached 30
  days in the existing PLACE_CACHE KV.

**Search result model:** `Finding` gains `source: "google"`, a `placeId`,
and OPTIONAL coordinates (Google suggestions carry none until a details
call). Ranking across sources dies: Google ranks itself, so the panel and
drawer render two sections, "Places" (Google, replaces wholesale per
answer) then "In this view" (Overpass sweep, replaces wholesale when it
lands). No cross-source merge, no cross-source dedupe against hits that
have no coordinates yet. Result rows without coordinates resolve them on
first interaction, then fly.

**Hours become a two-format union** (`PlaceHours`): `{ kind: "osm", raw }`
keeps the existing opening_hours grammar and parser, `{ kind: "google",
periods, utcOffsetMinutes, weekdayText }` wraps what details returns.
`open-now.ts` grows a verdict path for the google kind. One display shape
(OpenVerdict) feeds rows, cards, and drawers.

**Scout documents** (new store `entities/scout-maps`, localStorage key
`travel2:scout:v1`, same module-store pattern as trips, mutation surface
is the future sync seam):

- Shape: `{ version: 1, activeMapId, mapOrder, maps, searches }`.
- `ScoutMap = { id, name, camera?, places: Record<id, SavedPlace>,
  placeOrder: string[], edges: Edge[] }`.
- `SavedPlace = { id, label, color, lng, lat, address?, hours?,
  sourceRef?, savedAtMs }` (sourceRef keeps the google placeId or osm id
  for a later hours refresh).
- `Edge = { id, fromId, toId, modes: RideMode[] }`,
  `RideMode = walk | bus | tram | train | metro | ferry`.
- `searches = { saved: SavedSearch[], recents: { query, lastMs, count }[] }`.
  Recents cap at 30. "Common" is derived, count >= 3 by count desc, no
  separate storage.
- Ephemeral search lines and ticks stay in the session reducer, NOT in
  the document. Saving via the place drawer promotes a pin into the map.
  Becoming a connector endpoint ALSO promotes it (an edge needs stable
  endpoints), with the line color and its found name as defaults.

**Route graph replaces the waypoint chain** (rule zero). Cmd-click on
desktop drops a "spot" node (a SavedPlace with a generic label) and
chains an edge from the previous node, exactly what connector taps do on
mobile, one model. Each edge routes independently: walkable distance and
walk-only modes go to the foot router, longer hops go to Transitous with
`transitModes` derived from the edge's modes (bus -> BUS,COACH, tram ->
TRAM, metro -> SUBWAY, train -> HIGHSPEED_RAIL,LONG_DISTANCE,NIGHT_RAIL,
REGIONAL_RAIL,SUBURBAN, ferry -> FERRY). Edges are clickable (a wider
invisible hit layer under the drawn line) and open the edge drawer.

**Pin cards** render as absolutely positioned HTML in an overlay div over
the canvas (NOT maplibre markers, batch collision math needs them all in
one place). Projected via map.project on every map move (cheap under ~60
pins) plus data changes. Greedy anchor pick per card (above, right, left,
below) against already placed rects, saved places first. A card that fits
nowhere overlaps above its pin rather than vanishing. Cards carry the
name and hours lines and a notch pointing at the pin. The symbol layer
keeps icon-only pins (its text labels and the hover popup retire, the
cards replace both). Tap a card or pin: place drawer.

**Sheet primitive** at `versions/v3/scout/sheet/` (framer-motion spring,
backdrop, drag handle, dismiss on backdrop tap and Escape), used by the
search, place, and edge drawers and the maps menu. Desktop keeps the
floating panel for SEARCH, but place, edge, and maps UI use the same
sheets on both platforms (desktop has no equivalent surface today).

**Mobile chrome** (below md breakpoint the floating panel hides): map
menu button top left, search + connector buttons top right under the
version picker.

### Checklist (live, check off as each lands, top to bottom)

Phase A, worker search routes:
- [x] `src/routes/api.search.ts`: GET q + lat/lng bias, door-gated,
      Places New `places:autocomplete` (sessionless), locationBias
      circle 20km, KV cache `google:ac:{q}:{lat.2}:{lng.2}` 30d,
      ceiling counter `google:ac:{yyyy-mm}` cap 9000, wire shape
      `{ hits: [{ placeId, name, area, kinds }] }` (area = secondaryText).
- [x] `src/routes/api.place-details.ts`: GET id + wantHours flag,
      door-gated, locate mask location,formattedAddress (+ hours mask
      regularOpeningHours,currentOpeningHours,utcOffsetMinutes when
      asked), KV cache `google:pd:{id}:{0|1}` 30d, ceilings
      `google:pd:{yyyy-mm}` 9000 / `google:hours:{yyyy-mm}` 800, wire
      shape `{ lng, lat, address, hours? }`.
- [x] Verified live in dev against the real key, through the agent door:
      "hotel hoy paris" with an Amsterdam bias returns Hôtel HoY (Rue
      des Martyrs, Paris) FIRST (the owner's exact failing case),
      "nemo science" returns NEMO Science Museum first, "281 Rue Saint"
      completes house numbers instantly. Locate flavor returns
      coords + address; hours flavor returns 7 periods + weekdayText +
      utcOffsetMinutes 120 for NEMO. Noted in passing: current (holiday
      adjusted) hours can disagree with the regular weekday sentences
      (NEMO opens summer Mondays), which is exactly why verdicts use
      periods and the week overview uses weekdayText.

Phase B, search rework (desktop panel immediately benefits):
- [x] `entities/place-search`: client fetchers for both routes with
      in-memory caches (a hours answer also satisfies later bare
      locates), signal optional on the spot fetcher.
- [x] `find-places.ts`: google primary + overpass sweep, two sections
      (`places` + `nearby` on LineResults), wholesale replacement per
      source, cross-source rank/merge deleted. `Finding` gains placeId +
      optional coords (engine hits are born without them). Photon left
      scout; `entities/geocode` stays for the v1 planner only.
- [x] `lines.ts`: sections on the line, ticks survive re-answers only
      for findings that returned, `allToggled` scopes to the sweep and
      leaves engine ticks alone, new `located`/`locateFailed` actions
      write resolved coords back into the hit. `lineFindings` helper.
- [x] `query-line.tsx`: Places rows always visible, sweep rows under an
      "In this view (N)" disclosure, first interaction (tick or fly)
      resolves coords through the details route then acts.
      `open-now.ts` returns unknown for hits without coords/hours.
- [x] Unit tests: lines.test.ts (replacement, tick survival, allToggled
      scoping, located write-back), 13 pass with find-places tests.
- [x] Live check PASSED, screenshots taken: map on Amsterdam, typed
      "hotel hoy paris", Hôtel HoY (Rue des Martyrs, Paris) is the sole
      Places hit while 120 Amsterdam sweep matches sit folded under
      "In this view". Ticking resolved the real street address, pinned
      it, and flying landed the camera in Paris.

Phase C, scout documents store:
- [x] `entities/scout-maps`: types + store + mutations (createMap,
      renameMap, moveMap, deleteMap, switchMap, rememberMapCamera,
      savePlace, updatePlace (shallow merge, the drawer's write path),
      removePlace (drops touching edges), addEdge (directional, dedupes,
      refuses self), setEdgeModes (never empty), removeEdge, noteSearch,
      saveSearch, forgetSearch, commonSearches, activeMap, readScoutDb),
      localStorage key `travel2:scout:v1`, useScoutDb hook, PIN_COLORS
      is now the ONE palette (lines.ts LINE_COLORS deleted in its favor).
- [x] Unit tests (store.test.ts, 8): edge cleanup on place removal,
      delete falls back to a survivor and the last map self-replaces,
      recents bump case-insensitively, common excludes saved queries.
      Suite at 60 pass, typecheck clean.

Phase D, route graph + edge modes:
- [x] `route.ts` reworked: planEdges routes each document edge on its
      own (walk-only or short+walk-allowed goes to the foot router,
      otherwise Transitous restricted to the edge's modes via the
      MOTIS_MODES table), legs carry edgeId, straight-line fallback
      counts into the notice. `transit.ts` fetchRide takes transitModes
      and keys its cache on them. VERIFIED LIVE against Transitous by
      hand (curl with a UA header, python urllib gets 403 without one):
      default answered a Sprinter train, BUS forced buses 42+65, TRAM
      answered empty for that pair (the straight-fallback case).
- [x] `map-canvas.tsx`: two pin populations (search + saved) through one
      paint path with saved under search, route drawn from edge legs
      with an invisible 22px hit twin (opacity 0.001, fully transparent
      lines can be culled from hit testing), presses report upward
      (search pin, saved pin, edge, Cmd-click spot drop with pin hits
      excluded), per-document camera (opening prop + onCameraRest, the
      old travel2:scout-camera localStorage key is gone), api gains
      jumpTo for map switches.
- [x] `index.tsx`: scout documents wired (useScoutDb + activeMap),
      route replans keyed on a routing-only signature (camera rests and
      renames must not replan), connect-mode compass toggle under the
      version picker, chain ref (Cmd-click and connect taps share it,
      reset on toggle-off and map switch), search pins promote to saved
      places on connect (reusing a place already promoted via
      sourceRef), spot nodes get "Spot N" labels and cycling colors,
      RouteStrip now counts connections (Clear = clearEdges, Undo =
      last edge), recents record on tick/fly (not on keystrokes, which
      would fill recents with fragments). `open-now.ts` verdicts take
      any spot-shaped value so saved places reuse them.
- [ ] BLOCKED ON VISIBLE PANE: live checks of Cmd-click spot chaining,
      connect-mode taps, edge press, per-map camera. The preview pane
      went hidden mid-round (document.hidden true, the known rAF freeze,
      maps cannot finish loading). Code is typecheck-clean and 60 tests
      pass. When the pane is visible again: reload localhost:5006, v3,
      Cmd-click two spots, expect a routed line + Route strip, press
      the line (selection state exists, drawer lands in Phase F),
      compass toggle then tap two pins.

Phase E, pin cards:
- [x] `versions/v3/scout/pin-cards/`: overlay of persistent mini cards
      (name + hours line + color dot + notch), imperative positioning
      (React renders on data change only, transforms written straight
      to the DOM per rAF-coalesced map move, greedy anchor pass
      above/right/left/below at rest). Rendered inside MapCanvas over
      the map div. DECIDED: saved places always get cards; shown search
      pins join only while total shown pins <= 12 (CARD_CAP), else a
      big sweep keeps the old symbol labels + hover popup (cards would
      wallpaper the map). Saved pins never carry symbol text. Card
      press routes like a pin press (connect chains, else the place
      drawer once it exists).
- [x] Google hours: `attach-google-hours.ts` fires once when an engine
      hit is promoted into a document (fire and forget, card gains its
      line when the answer lands). `open-now.ts` gained
      googleOpenVerdict (weekly periods + UTC offset, no tz database,
      handles week wrap and the no-close always-open convention),
      placeOpenVerdict (both grammars), googleTodayLine (card fallback
      line). 6 new tests incl. the Saturday-night week wrap. Suite 66
      pass, typecheck + check:names clean ("common" is a banned stem,
      the store exports are frequentSearches / FREQUENT_SEARCH_FLOOR).
- [ ] BLOCKED ON VISIBLE PANE: visual check of card placement,
      collision dodging, and notch orientation.

Phase F, drawers + mobile chrome:
- [x] `sheet/`: bottom sheet primitive (backdrop, spring up, grab
      handle with real drag-down dismiss, Escape + backdrop close,
      half/tall sizes).
- [x] `search-drawer/`: the SAME line state as the desktop panel in a
      tall sheet, suggestion sections on top (Saved with forget ✕,
      Often searched, Recent, all filtered live by the typed text, plus
      a "Save ... for later" row), tapping a result to fly closes the
      sheet so the landing is visible.
- [x] `place-drawer/`: two lives, one editor: a SAVED place edits the
      document per keystroke (name, swatch color, remove), a search
      FINDING is a draft that enters the document on "Save to map"
      (with the google hours fetch riding along). Address + live hours
      line shown.
- [x] `edge-drawer/`: "A to B" title, mode chips (walk/bus/tram/train/
      metro/ferry) writing setEdgeModes immediately so the route
      redraws behind the sheet, last-chip-stays-lit matching the
      store's never-empty rule, remove connection.
- [x] `maps-menu/`: list with place counts, + New map, active map
      renames inline, other rows switch on press, delete confirms with
      the place count (instant when empty, same shape as city delete).
- [x] Chrome wiring: pin/card presses open the place drawer when not
      connecting (search pins open the finding draft), edge press opens
      the edge drawer, search + maps icon buttons on narrow windows
      (panel hidden below md), maps button also on wide windows (only
      way to switch documents), one sheet open at a time.
- [ ] RAISED, needs a decision: drag-to-reorder maps in the menu is NOT
      built. The only drag-reorder hook lives inside the v1 planner and
      reaching across generations for it would be an import reach-back;
      promoting it to a shared module is its own small round. The menu
      ships without reorder (create/rename/switch/delete all work).
- [ ] BLOCKED ON VISIBLE PANE: visual pass over all four sheets, mobile
      breakpoint check, connect-mode gesture run-through.

Phase G, round close:
- [x] typecheck clean, 66 tests pass, check:names clean, em dash grep
      clean over every touched file.
- [x] Sol review (167k tokens) + gemini review both ran; every finding
      dispositioned. NOTE for a fresh agent: `codex exec --search`
      fails, the flag goes BEFORE exec (`codex --search exec`).
      FIXED (committed on slices 36/38, merged, redeployed): Google
      current-hours misuse (regular weekly schedule only now, a dated
      holiday window must not repeat from a 30 day cache), budget
      counter comment had the failure direction backwards + counter
      writes are try/caught so a KV per-key write refusal cannot 500 a
      search, double-tap tick race, stale-answer reducer guards
      (toggled/locateFailed/allToggled ignore findings a newer answer
      replaced), walk-only itineraries rejected on edges whose modes
      exclude walking, total-failure judged against sources that ran,
      budget notice no longer promises sweep results that failed,
      "Nothing anywhere" waits out the sweep, Places eyebrow, pin cards
      born hidden until placed + canvas-bounds anchor choice + side
      notch centered, promise-holding caches (simultaneous identical
      asks join one paid call), weekday line matched by name, transit
      cache key empty-list fallback, mobile route strip in the search
      drawer.
      PUSHED BACK (accepted risks, named): no Durable Object for atomic
      budget counting (two door-gated users, ceilings sit 1000/200
      under the free tiers, the undercount slack is the design); hours
      fetched only when a place enters a document (owner's cost
      decision, ticked-but-unsaved pins show OSM hours or none); the
      12-pin card cap falling back to labels is deliberate; no schema
      validation on the scout store (same trust level as the trips
      store); no per-card ResizeObserver; no languageCode/regionCode
      forwarding (two English users; queue if that ever changes); the
      defensive source-implies-layer rebuild checks (failure mode
      requires a mid-add throw that has never been observed).
- [x] Sliced and pushed as a stack on slice/35-scout-search-speed:
      PR #36 (search API), PR #37 (scout documents store), PR #38
      (scout overhaul: search rework + graph + cards + drawers, big by
      necessity: the lines.ts section-shape change ripples through
      canvas and screen, so splitting further would leave mid-stack
      commits that do not compile). Stack merged back into
      bleeding-edge.
- [x] Deployed prod (https://travel-v2.leaftime.workers.dev), only the
      known-benign website-build churn, no other [deleting] lines.
- [x] TODO.md: 8 scout lines checked + the maps-reorder follow-up
      added, Progress 54 / 91.
- [x] Owner's first mobile pass (2026-08-06) flagged four search-sheet
      cuts, all fixed same turn and deployed: the sheet stands at a
      fixed 85dvh from open (measured: 690px on an 812px viewport,
      empty), streaming results cannot resize it, addresses wrap (the
      Button atom's max-content slot track clamped to the row, a trap
      worth remembering for any long text inside a Button), and the
      add-line plus lives in its own header row so it no longer slides
      corners when the suggestion block appears. On slice/38.
- [ ] Close this round entry after the owner's remaining visual pass
      (pane was hidden most of the round, see the BLOCKED items above;
      address wrapping specifically still needs his eyes, the pane
      could not produce search results to measure).

### Resume protocol for this round

Work happens in the working tree on `bleeding-edge`, uncommitted until a
phase is complete, then sliced into a PR branch per the workflow rules.
If you are a fresh agent picking this up mid-round: `git status` to see
which files are in flight, diff them against this checklist, finish the
first unchecked item, and keep checking things off. The owner expects
frequent interruptions this round (laptop closing, connectivity), so
after EVERY completed checklist item, update this file in the same edit
batch as the code.

## Round: make scout search feel instant (planned 2026-07-29)

Owner: "google's search results load so quick. why is it so slow in this
app? Takes like 5s+ to show address results and searching 'Nemo Science'
didn't give me any results."

MEASURED FIRST, both faults are mine:

- Photon (the geocoder) answers in **0.09s**. The same query on Overpass
  took **9.9s**. `findPlaces` used `Promise.allSettled` and rendered
  nothing until BOTH returned, so a 90ms answer waited on a ten-second
  one. Plus a flat 600ms debounce on top.
- The Overpass regex matched the WHOLE typed phrase as one substring.
  The museum's OSM name is just `Nemo` (tourism=museum), so
  "Nemo Science" could never match it. Google tokenizes; we did not.
  Confirmed by querying name~"nemo": `Nemo | museum` is right there.

DESIGN DECIDED BEFORE IMPLEMENTATION:

- **Results stream per source instead of arriving as one batch.**
  `findPlaces` takes an `onResults` callback and calls it as each source
  lands: the geocoder within ~100ms, the map sweep when it finishes. The
  line reports `sweeping` so the panel can say more is still coming.
- **Overpass is not a search index and stops being treated as one.** Its
  real value is "every branch inside this view", which is exactly what
  the owner asked for with media markt, so it stays. But it gets its own
  delay INSIDE findPlaces (the whole call aborts on the next keystroke,
  so that wait doubles as the sweep's debounce) and the typing debounce
  drops to 250ms for the fast half.
- **The sweep queries ONE token, the longest, and ranks client-side by
  how many tokens a name contains.** Overpass speaks POSIX ERE with no
  lookahead, so an all-words-in-any-order regex is not available. One
  selective token plus local ranking is what makes "Nemo Science" reach
  a place called "Nemo".
- **A street is not a place.** "Anemoonstraat" substring-matches "nemo".
  An element carrying `highway` and no POI category drops out.
- **A tick survives a re-search.** `answered` now intersects the shown
  ids with the new findings instead of clearing them, which it has to do
  anyway now that one search reports twice.

- [x] find-places streams per source, filters streets, ranks locally,
      and holds the sweep back on its own delay with a HARD DEADLINE.
- [x] lines.ts preserves ticks across an answer and carries `sweeping`.
- [x] query-line debounce down to 150ms; renders partial results.
- [x] Verified live, measured in dev on "Nemo Science": geocoder rows at
      2.2s with "Still sweeping the map for more matches", then the sweep
      lands at 7.2s with **Nemo the museum ranked first** and the notice
      clears. Before this round the same query returned nothing at all.
- [x] typecheck, 47 tests, check:names.
- [ ] Scoped Sol pass on this round's diff.

### The word-anchor idea was wrong, and the fix is the interesting part

The plan said query Overpass for the single longest word. That is wrong
in exactly the case the owner reported: for "Nemo Science" the longest
word is "science", and the museum is named "Nemo", so anchoring on the
longest word misses it just as surely as the whole phrase did. Overpass
now gets an ALTERNATION of every typed word (`nemo|science`), which
POSIX ERE can express, and the ranking sorts out which matches answer
the phrase.

Ranking then had its own trap. Word coverage alone puts "Bar of NEMO
Science Center" ABOVE the museum, because the bar's name contains both
typed words and the museum's contains one. A `wikidata`/`wikipedia` tag
is the nearest thing OSM has to prominence, and it is the same signal
the trip planner already uses to tell a landmark from a lawn fixture, so
it now carries weight. Verified: "Nemo" comes back first.

### Bug: an effect must not be keyed on what its own result changes

Streaming results introduced a self-defeating loop that took three
measured attempts to see. The line's search effect depended on
`line.query`, and the FIRST reported result set `line.query`, which
re-ran the effect, whose cleanup aborted the search that was still
running its second half. The map sweep was killed during its 600ms
delay and never issued a single request, while `sweeping` stayed true
forever because the abort suppressed the final repaint. Symptom: a
spinner and "still sweeping" that never ended.

`query` existed ONLY to stop the effect re-running, so it is gone from
the line entirely. A ref records `runId:text` for what was launched.

Also added, because the same investigation showed nothing bounded it: the
sweep now carries a 20s deadline via `AbortSignal.any`, so a public
instance that never answers cannot leave the line spinning.

### Still unexplained, and stated rather than hidden

First results land at ~2.2s in dev, but the geocoder request itself
takes ~50ms and the debounce is now 150ms. Instrumenting `fetch` showed
the request does not even START until ~1s after the keystroke. That gap
is dev-mode overhead (Vite, StrictMode double-effects, Panda runtime)
which was NOT isolated. Production is likely faster and has NOT been
measured, because prod needs the owner's own door password.

## Round: scout polish + Cmd-click routes (planned 2026-07-29)

Owner ask, in his order:

1. Pressing plus adds the new line at the TOP of the panel, not the
   bottom.
2. "Show all" becomes a disclosure. Ticking it collapses the result
   rows into one row reading [checkbox] [caret] "Show all (N)"; the
   caret flips right/down and toggles the rows back open. Spacing has
   to let the caret slot in naturally. Opening and closing animates
   height plus a fade.
3. Show where the owner is: detect location as a "you are here", or
   let him drop his own marker.
4. The pin icon reads as a circle stacked on a triangle (an ice cream
   cone). The head must flow into the point as one curve.
5. Cmd-click a series of map points and draw a route between them,
   using transit / cycling / walking. v1 already does this for a day.
6. LATER, his word: save a path, name it, edit it, untick points, drag
   to reorder them in a list, on its own input separate from search.
7. Maybe: bus stops, metro and train lines shown on the map by
   default, if it is cheap.

DESIGN DECIDED BEFORE IMPLEMENTATION:

- **The two network clients behind routing leave v1** the same way the
  OSM ones did last round: `fetchRoadRoute` (the OSRM foot router) and
  `fetchRide` (Transitous transit itineraries) become
  `entities/routing/`. What stays in v1 is `planDayRoute`, which is
  shaped around a trip DAY and its vias, and is not v3's problem. v3
  writes its own much smaller planner over the same two clients.
- **The walk-or-ride split is the reusable idea, not the code.** Legs
  under `WALK_LIMIT_METERS` road-route as a walk chain, longer ones ask
  transit. That constant moves with the clients.
- **Cmd-click is additive and ordered**: each Cmd-click appends a
  waypoint, the route redraws, and the waypoints render as small
  numbered dots distinct from search pins. Plain click keeps doing
  nothing to the route, so no accidental waypoints.
- **Location uses maplibre's own GeolocateControl** (already mounted in
  v3) rather than a hand-rolled watcher, because it already owns the
  permission prompt, the accuracy ring, and the "you are here" dot.
  Cmd-click waypoints double as the self-placed markers he offered as
  the alternative, so both halves of item 3 land.
- **The pin becomes one path, not two shapes.** The head's tangent has
  to meet the tip, so the outline is a circle arc whose end angles are
  computed FROM the tip position (not a fixed 135/45), joined by the
  two tangent lines. That is the only way the curve flows into the
  point instead of a cone.
- **The disclosure animates height**, which the house motion rule
  normally forbids. Naming the conflict: the rule targets continuous
  animation, and it sanctions `layout` for real layout changes. A
  one-shot 300ms open / 200ms close of a list IS a real layout change
  and is exactly what the owner asked for, so it stands.
- Items 6 and 7 are NOT in this round. 6 the owner called "later". 7 he
  asked whether it is cheap: it is cheapish (v1 already has
  `fetch-bus-network` and `fetch-stop-board`), but it wants its own
  round and its own answer about what "by default" costs on Overpass.

- [x] `entities/routing/` (road.ts = the OSRM client, geometry helpers,
      WALK_LIMIT_METERS; transit.ts = Transitous whole) + v1 repointed.
      `fetchRoadRoute` now takes plain coordinate pairs rather than a
      trip's own waypoint union, which is what let a network client stop
      depending on one screen's data model.
- [x] Plus adds at the top (verified: the new blue line appeared above
      the existing one).
- [x] Show-all disclosure. Verified: ticking show-all folded seven rows
      into the single row [checkbox][caret][Show all (7)], the caret
      turned, and pressing it opened them again.
- [x] Pin silhouette redrawn from the TANGENT points off the tip.
      Verified on screen: the head runs into the point as one curve.
- [x] Cmd-click waypoints + drawn route. Verified: three numbered dots
      and a walking path following real streets between them, plus a
      route strip in the panel with Undo and clear.
- [x] `MotionConfig reducedMotion="user"` added at the document root.
      The house motion rule required it and nothing had it, which the
      first real animation in the app made worth fixing.
- [x] typecheck, 39 tests, check:names.
- [ ] Geolocate "you are here": the control is mounted but this browser
      reports no geolocation support, so it is UNVERIFIED here. Needs
      the owner's own device.
- [ ] Scoped Sol pass on this round's diff.
- [ ] NOT visually re-confirmed after the last two edits (splitting the
      route into a dashed walk layer and a solid ride layer, and moving
      the map's ready gate from "load" to "style.load"). Both typecheck;
      the pane kept collapsing to 0x0 and further checks were noise.

### Bug found while verifying this round

- The map's ready flag hung off maplibre's `load` event, which waits for
  the first RENDERED frame. A container with no size (a background tab,
  a collapsed pane) never produces one, so the map stayed permanently
  un-ready: no pin layer, no route layer, and every typed search
  silently skipped. It now hangs off `style.load`, which is the actual
  precondition for adding sources and layers.
- `line-dasharray` is the one paint property maplibre will not drive
  from a feature, so the first attempt at "walks dashed, rides solid"
  would have failed silently. The route is now two filtered layers over
  one source.

## Round: version dropdown + v3 "map scout" (planned 2026-07-28)

Owner ask, verbatim in intent: turn the version switcher into a dropdown
and add a generation v3 that is a draggable, resizable wide input
floating on top of a map. Typing "media markt" on a line lists every
match, each checkable (plus a show-all), and the checked ones pin onto
the map with pin icons that carry today's open/closed state ("closed",
"closes at 8pm"). The next line takes a specific address and pins that
too. DESIGN DECIDED BEFORE IMPLEMENTATION:

- **Reading of the ask (stated, because it changes the shape):** ONE
  floating panel that holds a STACK of query lines, draggable by its
  grip and resizable from its corner, rather than N independently
  floating inputs. "On the next line" reads as the same surface, and
  five separately-dragged boxes over a map is chaos. If the owner
  wanted separate floating inputs, that is a small change to this
  design, not a rewrite.
- **The picker becomes a real dropdown** and cycling dies. catalog.ts
  predicted this ("a menu earns its place only if the catalog ever
  grows past" two or three generations); three generations plus the
  owner's ask is that moment. Anchor positioning is not Baseline, so
  the menu is an absolutely-positioned Block in a relative wrapper,
  dismissed by outside-press and Escape through one AbortController.
- **Data-source machinery leaves v1 and becomes version-neutral.**
  Generations are self-contained in their SCREENS, but the Overpass
  HTTP client, the OSM opening_hours grammar, and the Photon geocoder
  are infrastructure, and v3 is the second real caller. They move to
  `entities/osm/` (overpass + opening-hours) and `entities/geocode/`,
  v1's overlays and item-row import from the new doors. Copying them
  into v3 would be the rule-zero violation.
- **`opening-hours.ts` grows a `nextChange`** (minutes until the
  open/closed state flips) because "closes at 8pm" needs a boundary,
  not just a boolean. `isOpenAt` gets rewritten on the same new
  `effectiveSpans` helper so one place owns "which spans apply on day
  N", instead of two parallel readings of the rule list.
- **A line's query hits two sources at once,** because the owner's two
  examples want different ones and he should never have to say which:
  Overpass name/brand/operator regex inside the viewport (this is what
  makes "all the Media Markts, pinpointed" work, and it is the only
  source carrying `opening_hours`), plus Photon (addresses, and named
  places outside the view). One merged, deduped result list.
- **Open/closed rides the pin itself,** not just the popup: the pin
  icon is drawn in the line's color, a closed place gets the muted
  fill plus a red ring, and the collision-managed label under the pin
  reads "Media Markt / closes 8pm" or "/ closed". Full detail (hours,
  address, links) lives in the hover popup.
- v3 ships `draft: true`, so `latestUiVersion` stays v1 and only a
  deliberate flip reaches it. Its Planner renders the same scout
  screen, so a device flipped to v3 on a trip URL is not dead-ended.

- [x] `entities/osm/` (overpass.ts, opening-hours.ts + `nextChange`,
      index door) and `entities/geocode/`; v1 imports repointed. A THIRD
      module came out of v1 unplanned: `entities/map-style/` (the light
      URL, the dark repaint, and `mapStyle(dark)`), because v3 needed
      the same paper and copying 60 lines of DARK_PAINT into it would
      have been the rule-zero violation. map-pane.tsx shrank by 74.
- [x] `picker.tsx` rewritten as a dropdown; cycling deleted.
- [x] v3 catalog entry + `v3/trips-shelf`, `v3/planner` (both render
      the one screen v3 has).
- [x] `v3/scout/`: map-canvas, query-panel (drag + resize + remembered
      frame), query-line, find-places, open-now, pin-icons, lines.ts
      (the reducer).
- [x] Verified live: search returned 63 Albert Heijn branches each
      reading "Open · closes 10pm"; show-all pinned them with labels
      reading "Albert Heijn / closes 10pm"; a result press centred the
      map; a second line found "Dam 1" through the geocoder in its own
      color; drag and resize both held and persisted; dark theme
      repaints map and panel.
- [x] `bun test src` (37 pass), typecheck, `bun run check:names`.
- [x] Sol review pass. Two full-diff runs at high effort exited 0 with
      NO final answer (see the gotcha below); a third, scoped to just
      v3 + entities/osm and capped at two tool calls, delivered eight
      real defects. All eight are fixed in commit 0cf031d: the pin
      effect painting into a mid-swap style, theme swaps resolving out
      of order, the panel's live frame being reset by a re-render
      mid-drag, moving in a narrow window baking in the shrunken size,
      a second refresh press being a no-op, words typed before the map
      loaded never searching, and `nextChange` naming an already-past
      closing time inside the repeated DST hour.

### Gotcha: Sol dies silently on big diffs

`codex exec -m gpt-5.6-sol` at high effort, pointed at a ~1700 line
diff and left free to explore the repo, ran for minutes and exited 0
having emitted only its tool-call transcript: no final message at all.
It did this twice. A trivial prompt on the same CLI answered fine, so
the CLI is healthy; the run is being cut off by scale. What worked was
narrowing hard: one saved diff file, an explicit "do not explore the
repository", a two-tool-call budget, and a word cap. Scope Sol per
feature area rather than per round, which is what CLAUDE.md already
advises for large rounds, and treat a run that returns no verdict as a
failed run rather than a clean review.

### Bugs found and fixed while verifying (all mine except the last two)

- The map container was styled `position:absolute; inset:0`, which
  maplibre-gl.css overrides with its own unlayered `position:relative`
  on the element it claims: the container computed to zero height and
  the map never showed. It is now a raw div with inline 100%/100%,
  the same shape v1 uses, with the reason written down.
- Maplibre sizes its canvas at construction and its own `trackResize`
  only reacts to later CHANGES, so a map built before the stylesheet
  landed kept the 400x300 fallback canvas forever. v3 now owns a
  ResizeObserver (`trackResize: false`), which reports the current
  size the moment it starts watching.
- The panel fitted itself to `window.innerWidth` at mount and wrote
  the result back to its stored frame. In a window that has not been
  laid out yet (0x0) that pinned it to minimum size in a corner,
  permanently. The authored frame is now separate from the fitted one.
- The grip row's pointerdown preventDefault swallowed presses on the
  add-line button inside it. A press starting on a button is no
  longer a drag.
- **Pre-existing, from code this round moved:** `loadDarkStyle()`
  memoized ONE style object and handed the same reference to every
  caller. Maplibre takes ownership of a style object and mutates it,
  so the second map to ask (two generations, or one remount) got a
  style that silently never loaded. `mapStyle` now hands out
  `structuredClone`s.
- **Pre-existing, from code this round moved:** the Overpass client
  retried HTTP statuses but not fetch rejections, and a connection
  the public instance simply drops (its commonest way of shedding
  load) surfaced as an instant hard failure. Those now retry on the
  same backoff, with aborts still passing straight through.


## Round: haptics on the edit bar, redesigned from the v6 story (planned 2026-07-12)

Owner ask: pressing the edit-bar buttons (checkbox, numbered, indent,
outdent, and the rest) must vibrate; stockpile-v6's haptics module is
the reference. DESIGN DECIDED BEFORE IMPLEMENTATION (adoption is design
work, per-item verdicts in the round report):

- The haptics module is REDESIGNED on the v6 story (pattern vocabulary,
  per-name rate caps, visibility + reduced-motion gates, crisp 8-25ms
  pulses) and RELOCATED from entities/haptics to src/atoms/haptics.ts,
  because haptics is interaction wiring and atoms may not reach into
  entities. API becomes haptic("tap" | "grab"); the old
  haptics.tap()/grab() object dies. v6's tick/confirm/warn/reject
  patterns and its localStorage kill switch are NOT ported (no
  consumers, no settings UI yet; each is a one-line add later).
- The Button ATOM fires haptic("tap") on every press by default, with
  a `haptic` prop (name to change the cue, false to silence), so no
  feature code ever sprinkles vibration calls on buttons again. Link
  gets the same default on click (it has no press wiring to hook).
- All 12 manual call sites sweep away: calls inside Button/Checkbox/
  IconButton presses are deleted (the atom covers them), the
  drag-reorder grab converts to haptic("grab"), and the city chip
  keeps a manual tap under haptic={false} because its press handler
  suppresses the action after a drag and the buzz must not lie.

- [x] atoms/haptics.ts + atoms door export; delete entities/haptics.
- [x] Button default-tap + haptic prop; Link click tap.
- [x] Sweep the 12 call sites (picker, trips-shelf x2, item-editor x2,
      planner index x5, use-drag-reorder, section).
- [x] Verify in browser by instrumenting navigator.vibrate: checkbox,
      numbered, indent, outdent each fired exactly one [10] tap while
      the action applied and focus held; the version pill and a trip
      Link buzz and still navigate; the visibility gate proven live
      (the pane reports hidden, zero calls until the state is shimmed
      visible).
- [x] slice/32-haptics off slice/31-rich-text: commit e2bc91e, PR #32
      (base slice/31), merged to bleeding-edge, deployed, fresh asset
      probed 200 on prod. Sol review verdict recorded below when it
      lands.

OWNER FOLLOW-UP (same day): asked for a buzz on checking/unchecking a
line's checkbox. Already covered: the Checkbox alloy presses through
the Button atom, so the deployed build vibrates on both check and
uncheck. Re-verified live with instrumented vibrate (two clicks, two
[10] pulses, done state flipped true then false). No code change; if
his phone stays silent there, it is the cached pre-haptics bundle.

SOL VERDICT (post-deploy): conformance pass, sweep complete, SSR safe,
the Link wrap keeps router navigation. Accepted its hardening nit
(vibrate probed as a function, 1bde00e, redeployed). PUSHED BACK on
its one P2 (the delete-city button buzzes at press even if the
confirm dialog is then cancelled): under the shipped model the buzz
acknowledges the PRESS (input received), like Android system touch
feedback, not the outcome; the chip is the only exception because its
"press" can be the ghost tail of a drag, not a real tap. If the owner
feels a cancelled delete should not have buzzed, the fix is one line
(haptic={false} on that button plus a manual tap after confirm).

BONUS PROOF: a stale-HMR module mid-edit crashed Canvas once in dev,
and the UiVersionRescue boundary caught it and recovered the app,
which was the queued "rescue boundary never exercised" item. The
crash was HMR ghosting (it referenced an identifier that no longer
exists in any file), gone after reload, current code verified clean.

## Round: verify italics + contextual bar end to end (planned 2026-07-12)

Owner reports italics STILL not visible on his device and asked to
confirm the contextual bar (selection = B/I/U/S, bare caret = line
controls) is implemented, deployed, and working. Found on arrival:
commit 4b34c2a carries the italic face + contextual bar, but the
working tree holds an UNCOMMITTED follow-up (syncTextSelected recompute
on focus, bar spacing tweak) that never shipped. PLAN:

- [x] Read the rich-text render path (rich-dom.ts) and confirm the
      italic mark actually maps to font-style italic with the Inter
      italic face loaded. (Yes: italic renders as <i>, computed
      font-style italic, family Inter Variable.)
- [x] Run the local dev server, apply italic to selected text, verify
      the slant VISUALLY (screenshot), and verify the bar swaps
      between format buttons (selection) and line controls (caret).
      (All verified: real slant on screen, bar swaps both directions,
      marks stack (i+b), storage records spans correctly, focus stays
      on the line through bar presses.)
- [x] Commit the follow-up to slice/31 (PR #31): 1b6f7ea, pushed,
      merged to bleeding-edge (646d9d3), pushed.
- [x] Deploy, verify on prod: deployed clean (no [deleting] lines);
      prod serves the new build's hashed CSS with the italic
      @font-face and the inter-latin-wght-italic woff2 (both 200).
- [x] Sol background review of the follow-up diff: conformance pass,
      no blocking defect. Its two accepted findings (the selection
      probe ran before the programmatic selection landed; a
      selectionchange straggling in after blur could re-show the
      format bar) are FIXED in 39e5f64. Its stale-closure concern was
      checked against the real compiler output and is not a bug; the
      identity contract is now named in a comment on syncTextSelected.
- [x] BONUS, queue burn-down: the format buttons now show PRESSED for
      the marks the whole selection carries (the aria-pressed nit
      queued by the rich-text audit): marksOver in lines.ts (tested,
      including agreement with applyMark's toggle threshold),
      selectedMarks replaces the textSelected boolean, edit-bar
      renders the four buttons from one FORMATS table with
      aria-pressed + a surface-muted fill. Commit 39e5f64 on
      slice/31 (PR #31), merged to bleeding-edge (8a6d6b6), deployed,
      browser-verified (Italic pressed on italic text, Bold
      press/unpress live-updates, caret returns line controls). Sol
      review of this commit: pass on all three verdicts, zero defects;
      its one note (no DOM-level component tests for the bar) joins
      the standing test-infra gap, which now needs a happy-dom vs
      Playwright decision before bar behavior can get automated
      coverage.

VERIFICATION GOTCHA (cost an hour, do not relearn): the in-app browser
automation CANNOT create native text selections (double-click,
drag-select, and shift+arrow all fail silently in the contenteditable),
and its screenshot-coordinate clicks mismap near the bottom bar. Use
getSelection().setBaseAndExtent(...) in page JS to build the selection
(it fires the same selectionchange the app listens to) and click bar
buttons by read_page REFS, never by screenshot coordinates. Ref clicks
exercise the full react-aria press path and preservesFocus correctly.

If the owner STILL sees no italics on his phone after this deploy, the
remaining suspects are his browser cache (hard refresh) or the phone
sitting on UI v1 rather than v2.

## Round: bar polish and a real italic face (planned 2026-07-12)

Owner feedback after phone testing rich text. PLAN, before the work:

- [x] **Italics render for real.** Inter Variable's default fontsource
      file is upright-only (font-style: normal), so <i> had no italic
      face to match and the browser did not synthesize one. Import
      @fontsource-variable/inter/wght-italic.css alongside, verify the
      slant VISUALLY (screenshot), not just by computed style.
- [x] **Compact bar**: shrink the gap between icon buttons (2px) and
      the group separators (xs), buttons keep their 2rlh hit size.
- [x] **Contextual bar**: a document selectionchange listener tracks
      whether the active line carries a non-collapsed selection; with a
      selection the bar shows ONLY the format buttons (B I U S), else
      ONLY the line controls (lists + indent/outdent).
- [x] Verify, test, follow-up commit on slice/31 (PR #31), merge,
      deploy.

## Round: rich text on the canvas (planned 2026-07-12)

SOL MAX AUDIT (landed after deploy; fix round COMPLETE, all accepted
items fixed, tested, browser-verified, and redeployed same round): CRITICAL: native paste/drop inserts live HTML into the
contenteditable, bypassing renderSpans, so pasted markup with equal
text/marks survives the parse-compare guard (XSS surface; fix: model-
level plain-text paste, multiline paste spawning lines, drop prevented,
belt on insertFromPaste beforeinput). SHOULD-FIX, all accepted: marks
get a canonical order+dedupe so multi-mark spans round-trip and the
focused DOM never rebuilds spuriously; the load boundary normalizes
noncanonical rich records and dedupes line ids; the LineRow DOM-sync
guard and Enter both respect in-flight composition (dataset flag +
keyCode 229); arrow hops probe a real character rect when the caret
rect is missing and use the selection END for downward hops; bun:test
(built into bun, ZERO new deps, settling the stalled test-infra
decision) lands with lines.test.ts over the span algebra + migration.
NITS: checkbox whitespace muting restored, aria-placeholder/textbox
semantics added; backward-selection direction and aria-pressed states
QUEUED. PUSHED BACK: cross-line selection editing needs a document-
level selection model (own round, queued); separate per-line hosts
already fence most cross-line editing.


Owner approved inline formatting (bold/italic/underline/strikethrough)
with "whatever keeps all the existing functionality". DESIGN DECIDED
BEFORE IMPLEMENTATION:

- Per-line CONTENTEDITABLE replaces the per-line textarea. No editor
  framework (Lexical/ProseMirror would replace our whole line model and
  add a heavy dependency); the existing engine (lines, kinds, indents,
  split/merge, edit bar, IME beforeinput path) stays ours.
- Data: a line's `text: string` becomes `spans: { text, marks[] }[]`
  with marks from "bold" | "italic" | "underline" | "strike". The
  localStorage load MIGRATES old `{ text }` records to single-span
  lines at the boundary (one-time rewrite, no legacy branches in
  runtime code). Storage key stays `travel2:v2:canvas`.
- DOM is built programmatically from spans (createTextNode + mark
  wrappers), NEVER innerHTML strings, so user text cannot inject
  markup. During plain typing the DOM is source of truth (parse back
  to spans on input); a line only re-renders from state when state
  changed from OUTSIDE typing (formatting, conversion, split/merge),
  guarded by comparing serialized forms. Caret restores by text
  offset.
- Known, accepted tradeoff: browser-native undo history degrades with
  manual DOM management (queued as future work, not silently lost).

PLAN CHECKLIST (all landed, browser-verified, deployed as PR #31
stacked on #30):

- [x] `lines.ts`: Span/Mark types, span algebra (text length, split at
      offset, concat with adjacent-equal normalization, applyMark over
      a range with all-marked-toggles-off semantics), claimMarker over
      leading span text, isLine for the new shape + the load migration.
- [x] New `rich-dom.ts`: renderSpans(el, spans) via DOM nodes,
      parseSpans(el), selectionOffsets(el), setSelection(el, start,
      end), and rect-based first/last visual line detection for arrow
      hops (replaces the textarea mirror in caret-line.ts, which gets
      deleted).
- [x] `line-row.tsx`: contenteditable div (data-canvas-line moves to
      it), :empty::before placeholder, same marker gutter.
- [x] `index.tsx`: engine reworked to selection offsets (split,
      backspace ladder, hops), input parsing with composition tracking
      (compositionstart/end delegated on the shell, parse on end),
      applyMark plumbing, and Cmd/Ctrl+B / I / U (+Shift+X strike)
      shortcuts with the browser's own contenteditable defaults
      suppressed.
- [x] `edit-bar.tsx`: four new format buttons (preservesFocus) after
      the list/indent groups; bar scrolls horizontally if the phone is
      narrower than the button row. Four new icons in atoms/icons:
      text-b, text-italic, text-underline, text-strikethrough.
- [x] Verify heavily in browser (the risky bits: caret restoration
      after formatting, parse fidelity, Enter/backspace at offsets,
      marker triggers still firing, checkbox toggle, persistence
      migration from old records). Sol review. New slice/31-rich-text
      stacked on slice/30 (PR base slice/30). Merge, push, deploy.

If interrupted mid-round: the working tree lives on bleeding-edge;
check which checklist items' files exist and typecheck; the design
above is settled, do not re-litigate it.

## Round: canvas toolbar, markers polish, font (planned 2026-07-11, late night)

Owner feedback on the first canvas build. Planned first, then all
items landed, verified with real clicks, and deployed (follow-up on
PR #30):

- [x] **Icon-only edit bar, condensed.** Indent/outdent lose their text
      labels and become the classic glyphs (three lines + arrow right /
      arrow left). New buttons for bullet list, checkbox, and numbered
      list that convert the FOCUSED line on press (pressing the line's
      current kind toggles it back to plain text). All buttons are
      IconButton alloys with preservesFocus so the keyboard stays open.
      New icons under `src/atoms/icons/`: indent, outdent,
      list-bullets, list-checks, list-numbers (256-viewBox
      currentColor, matching the set).
- [x] **Bullets read black**: the bullet dot (and the ordinal, for
      coherence) move from text-muted to text-primary.
- [x] **Remove the marker hint line** from the v2 shelf ("Markers as
      you type…"). The typed shortcuts themselves STAY.
- [x] **Left-align plain text with the page**: the marker gutter
      renders only for marker lines, so a plain text line's textarea
      starts at the same left edge as the "v2" title (list items keep
      their natural gutter indent).
- [x] **Canvas font**: the canvas text tries Inter Variable
      (@fontsource-variable/inter, canvas-scoped import so it rides the
      v2 chunk), crisper than Instrument Sans at dense list sizes. App
      chrome keeps Instrument Sans. One-prop revert if the owner
      dislikes it.
- [x] Verify in browser, Sol review, follow-up commits on slice/30
      (PR #30), merge to bleeding-edge, deploy. Sol verdict: zero
      runtime defects; its two nits (numbered gutter overflow past two
      digits, checkbox-list icon consistency) were fixed same round.
      Its no-tests should-fix remains blocked on the queued test-infra
      decision.

DECIDED AND DEFERRED (needs its own round, raised to the owner):
inline text formatting (bold/italic/underline/strikethrough over a
selection). Lines are plain strings in a textarea, which cannot render
mixed inline styles; real inline marks need the line editor rebuilt on
contenteditable (or an overlay-mirror hack not worth shipping). The
toolbar therefore ships WITHOUT formatting buttons this round: dead
buttons are worse than absent ones. Owner input wanted on the
contenteditable round's priority.

## Round: the v2 canvas editor (2026-07-11, night)

The owner's design brief for v2's start: an editable canvas with typed
markers, indents, vertical rhythm, and indent/outdent buttons riding
above the phone keyboard that never close it. DONE, deployed to prod
(PR #30, stacked on #29):

- `src/versions/v2/canvas/`: `lines.ts` (Line record: id/text/indent/
  kind/done; marker claiming; the numbering walk), `line-row.tsx`
  (marker gutter + auto-growing textarea, one shared text column),
  `edit-bar.tsx` (fixed bottom bar, visualViewport-lifted above the
  Android keyboard), `caret-line.ts` (wrapped-line caret math),
  `index.tsx` (state, localStorage persistence under
  `travel2:v2:canvas`, the key engine).
- Markers: "- " bullet, "[] "/"[ ] " checkbox (tap to toggle, strikes
  through), "N. " numbered with automatic renumbering per indent run.
  Enter splits and inherits; Enter on an empty marker line demotes it;
  Backspace at start climbs marker -> indent -> merge. Tab/Shift-Tab
  and the edit-bar buttons indent/outdent.
- The Button atom gained `preservesFocus` (react-aria's
  preventFocusOnPress): edit-bar presses never move focus, so the
  keyboard stays open. Verified: the bar (which hides on blur) stays up
  through a press that applies its action.
- **Android IME hard-won lesson**: keydown on mobile IMEs (and the
  browser automation driver, which is how it surfaced) can carry
  unusable key values, so Enter and backspace-at-start ALSO answer
  through a DELEGATED NATIVE beforeinput listener on the canvas shell
  (insertLineBreak / deleteContentBackward). React's onBeforeInput is
  a synthetic that does NOT see native beforeinput, so the listener is
  imperative (AbortController). A handled keydown cancels its
  beforeinput, so desktop never double-fires. Both paths are exercised
  in the test plan.
- Canvas content is per device and NOT synced or tied to trips yet
  (deliberate: it is a feel prototype for the editor).

SOL REVIEW (landed same round, fixes deployed): the audit's critical
was real: mutations ran inside setState updater functions, which React
may replay, so a spawned line's minted id could differ from the focus
target. Mutations now compute at event time from a live linesRef and
setState receives a plain value. Also fixed: Enter ignores IME
composition (nativeEvent.isComposing), Enter consumes a selection,
stored JSON is validated per line (isLine) with indent clamping, and
the edit bar hides when focus lands on a non-line control (the row
checkbox now preserves focus on toggle, so checking items mid-edit
keeps the keyboard open). Pushed back on: keydown/beforeinput dedup for
a WebView that ignores preventDefault (condition the design rules out).

GOTCHA (bit twice today): `bun run deploy` while a dev server runs
regenerates `.alchemy/local/wrangler.jsonc` from raw .env, hot-swapping
the RUNNING dev door to the real credentials and dropping the session.
After deploying mid-session, restart the dev launch config you were
using.

AWAITING: owner's phone test (markers, keyboard bar, focus retention on
his Galaxy).

## Round: generation v2 opens as a blank canvas (2026-07-11, later)

The owner is starting the v2 UI design. DONE:

- `src/versions/v2/`: blank trips shelf + blank planner, both carrying
  the picker, the planner linking back to the shelf. Catalog gained the
  entry plus a `draft` flag: the picker reaches a draft, but fresh
  devices land on the newest SHIPPED generation (v1) until the flag is
  dropped. Verified locally: fresh device lands on v1, the pill flips
  both screens to v2 and back in place. PR #29 (stacked on #25).
- **Dual-React crash fixed** (would have hit any dev machine): the dep
  optimizer discovered `react/compiler-runtime` in a late second pass
  after the TS7 lockfile change and handed it its own React copy, so
  every route crashed with "null useMemoCache" / invalid-hook errors.
  vite.config.ts now pre-declares react, react-dom, and
  react/compiler-runtime so one optimizer pass shares one React. If it
  ever recurs: `rm -rf node_modules/.vite` and restart.
- **The agent door**: agents may not type the owner's real door
  password, so `.claude/launch.json` gained `travel-2-agent-door` (the
  full dev server with ALLOWED_EMAILS/APP_PASSWORD overridden to
  fixture values `agent@local` / `fixture-door-not-a-secret`). Agent
  sessions drive the app through it; `travel-2` keeps the real door.
  Both fixes rode slice/27 (PR #27).
- Real `.env` landed, prod deployed and redeployed (v2 + picker live).
  TypeScript 7 done earlier in the day (see previous round).
- KNOWN ALCHEMY CHURN, looks scary but is benign in exactly this
  shape: because dev and deploy share stage "prod", a `bun run dev`
  after a deploy prints `[updating] website` and `[deleting]
  website-build` (state bookkeeping only; the deployed worker keeps
  serving, verified live both times). A `[deleting]` line for anything
  OTHER than website-build, or any prod-named resource during a
  non-prod-stage run, is still the kill-it-immediately case.

NEXT (the v2 design itself): the blank canvas awaits the owner's
direction. When real v2 work starts, revisit whether map-pane internals
(dark style table, overlays) become version-shared entities, and give
the routes' Suspense a small skeleton fallback (a generation flip
blanks briefly during the chunk fetch).

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
- **Peer review round applied** (GPT-5.6 Sol high-effort audit + gemini
  inline-diff review, both on the full diff). Fixed from their findings:
  the AI-binding conditional is now DEV-ONLY (Sol caught that a deploy
  authenticated a way the probe cannot see would silently ship prod
  without AI), the credential probe also accepts CLOUDFLARE_API_KEY and
  the XDG wrangler path, `src/versions/rescue.tsx` is a version-neutral
  error boundary in both routes so a crashed generation really can be
  escaped (both reviewers caught that the picker inside a crashed lazy
  screen never renders; the boundary is keyed by generation id so
  flipping away clears it), the choice store now hears the cross-tab
  `storage` event and clears its in-memory override, the scanner
  handles multiline destructuring, rest elements, template literals,
  and kebab-case file names, and store.ts param renames (`data` to
  `snapshot`, `index` to `afterIdx`) plus the Button atom's `type` local
  (now `buttonKind`) cleared the violations Sol found beyond the
  scanner's reach. Pushed back on: gemini's `versions/*` wildcard alias
  suggestion (door-only imports are deliberate house discipline).

FOR THE OWNER (verify / decide):

- [x] **RESOLVED: the real `.env` landed on this machine** (owner copied
      it 2026-07-11). Prod deployed from here the same day:
      https://travel-v2.leaftime.workers.dev serves, root redirects
      logged-out visitors to the door. Owner login on prod still
      unverified by owner's own hands.
- [x] **TypeScript 7 upgrade** (owner ask 2026-07-11): typescript
      ^7.0.2, the native compiler. Whole tree typechecks unchanged.
- [ ] Review the versioning design: the picker is a cycling pill on the
      trip shelf header. Fine for 2-3 generations, becomes a menu if the
      catalog grows. Placement and the pill treatment are open to taste.
- [ ] The dark map theme and blue focus rings remain visually
      unconfirmed by the owner (carried from the pre-pull handoff).
- [x] **PR stack created** (owner said create them, 2026-07-11): PRs
      #25 (UI versioning), #26 (banned-names scanner), #27 (keyless
      dev), #28 (TypeScript 7), based in review order on the snapshot
      branch `stack-base-2026-07-11` (bleeding-edge as of the round's
      start), since this work builds on the whole open stack's
      integration and no single open slice is an honest base. Each PR
      diff shows exactly its own files. Retarget to main as the earlier
      stack merges; the snapshot branch is deletable once #25 retargets.
      Docs follow-ups ride the existing slice/10-house-rules-refresh PR.

QUEUED BY THIS ROUND:

- [x] Slice this round into PRs (four slice branches pushed; PR
      creation blocked on the base problem, see the round report).
- [x] GPT-5.6 Sol background review of the round's diff (findings
      applied, see above).
- [ ] When a second UI generation starts: copy v1, then consider
      whether map-pane internals (dark style table, overlays) should
      become version-shared entities instead of duplicating. Give the
      routes' Suspense a small skeleton fallback at the same time (a
      generation flip currently blanks for the chunk fetch; moot with
      one generation).
- [ ] Rename `ContainerRef.type` to `kind` (its own tiny round: the
      sweep crosses files owned by several open slices, so it must
      land after the current PR stack merges; ContainerRef is
      ephemeral, no data migration needed).
- [ ] The banned-names scanner is a tripwire, not a proof (Sol):
      params, type fields, and the Use/T prefixes escape regex. An
      AST-based rewrite (ts-morph or the TS compiler API) would close
      it; needs a decision on adding the dependency.
- [ ] No test infra exists yet (no vitest/test script). Sol flags the
      scanner and the version-choice store as the surfaces that most
      earn tests; needs the test-framework decision first.
- [ ] The rescue boundary is code-reviewed but not exercised (crashing
      a generation on purpose needs a throwaway broken catalog entry;
      cheap to do when v2 scaffolding exists).

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
