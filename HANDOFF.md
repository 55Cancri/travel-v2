# Agent handoff: travel-2

_Updated 2026-07-11 after the UI-versioning + house-rules round._

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
