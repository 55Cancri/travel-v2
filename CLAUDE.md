# Travel-2 house rules

Rules current as of 2026-07-04. Condensed from `docs/rules/*.mdc`. Those
files remain the source of truth and carry the full rationale and examples.
Before deep work in an area, read the matching rule file:

| Area | Full rule |
| --- | --- |
| **Redesign for the ideal (Phoenix rule, rule zero)** | `docs/rules/redesign-for-the-ideal.mdc` |
| Naming + TS style | `docs/rules/typescript-style.mdc` |
| Files, folders, module shape | `docs/rules/code-organization.mdc` |
| Panda styling / atoms | `docs/rules/panda-style-reuse.mdc` |
| Layout | `docs/rules/prefer-grid-over-flex.mdc` |
| Animation | `docs/rules/framer-motion.mdc` |
| React 19 / compiler | `docs/rules/react-19.mdc` |
| Comments | `docs/rules/documentation-comments.mdc` |
| No legacy/fallback paths | `docs/rules/no-legacy-fallback-code.mdc` |
| Swallowed errors / empty catches | `docs/rules/no-swallowed-errors.mdc` |
| Deferred work | `docs/rules/no-silent-deferrals.mdc` |
| Server code never in the client bundle | `docs/rules/server-client-boundary.mdc` |
| Auth never leaks account existence | `docs/rules/no-account-enumeration.mdc` |
| Minimize D1/Workers read cost | `docs/rules/minimize-read-cost.mdc` |
| Git / PR workflow | `docs/rules/stacked-diffs.mdc` |
| Code-health tooling | `docs/rules/fallow-quality-analysis.mdc` |
| Tests (placement, what earns one, Playwright) | `docs/rules/testing.mdc` |

## Repo layout

A single bun root: a TanStack Start + Vite 7 + Panda CSS trip planner and
offline travel companion (see `OVERVIEW.md` for the vision, `TODO.md` for
the phased checklist, `HANDOFF.md` for agent handoff context). Cloudflare
infra (Alchemy config + Drizzle sync schema) exists but is dormant, not yet
wired to the running app. Local data lives in localStorage until sync lands.

## Redesign for the ideal (the Phoenix rule, rule zero)

Never let existing code inhibit a better design. Always build the most ideal
version of a thing given everything known right now, never a patch layered on
what exists to keep it working. A change that ripples into a dozen files or
tables is a win, not a cost: welcome the ripple, fold the new knowledge back
into the old code, end with one coherent design instead of strata. Embrace
deleting, merging, and splitting. If the ideal design conflicts with
something in place, never quietly design around the old thing: name the
conflict, propose the redesign, let the owner decide. "We already wrote it
this way" is never a reason. Full rule:
`docs/rules/redesign-for-the-ideal.mdc`.

## Communication: push back, surface, propose (HARD RULES)

**Raise concerns explicitly.** If anything the owner asks for cannot be done,
should not be done, or would cause other issues, say so directly and
explicitly in the response. Never silently skip it, quietly work around it,
or bury the caveat. This includes pushing back on his ideas with reasons. He
would rather hear "this part is a bad idea because X" than discover it later.

**Operational failures are fire alarms.** When something in the environment
breaks (a server won't start, a login/auth is broken, a tool can't connect, a
CLI errors for a non-obvious reason), working around it is allowed, but the
failure itself MUST be surfaced loudly and prominently in the response. Lead
with it, don't footnote it, and name exactly what failed and what the error
said. These are usually one-minute fixes on his side, and a silent workaround
buries them forever. Permission-classifier denials are the one exception
(normal, no alarm needed).

**Propose simplifications assertively.** Always look at changes wholesale, in
the greater context of the app. When a different business rule would collapse
a data structure, or two unrelated shapes could merge into one shared
structure, propose it proactively with the payoff spelled out and let the
owner decide. Ask usage questions when the answer would change a design. The
standing mantra: as few data structures as possible, flexible enough for
everything (see `OVERVIEW.md`).

## Peer models (codex, gemini): second opinions, never the driver

I remain the primary driver. Peer models run in parallel with my own
reasoning and research, never instead of it, and never as an excuse to skip
my own work.

- At natural review points (a finished feature, a design decision, risky
  logic), fire codex and gemini reviews in the background without asking,
  with NEUTRAL prompts that don't bias them toward known concerns. Collate
  the findings, fix what I agree with, push back in writing on what I don't,
  and report which reviewer caught what.
- codex: invoke with live web search for research tasks
  (`codex --search exec --sandbox read-only "<prompt>"`). Match effort to
  stakes.
- The `openai` CLI reaches what codex cannot: gpt-5.5-pro (`--pro`) and deep
  research (o4-mini default, `--deep` for o3). **`--pro` is the preferred
  heavyweight second opinion**; the deep-research models are options to
  surface as suggestions when a true multi-source research sweep would pay
  off. Never run two deep jobs in parallel by default: they share the org
  TPM budget and rate-limit each other (a fanout leg died this way
  2026-07-04). `--fanout` remains for deliberate bake-offs; otherwise
  sequence deep runs one at a time. The CLI prints elapsed time, token
  usage, and estimated cost per job. `openai --help` is the complete manual.
- **Long runs never get discarded.** Deep research and gpt-5.5-pro can take
  up to ~40 minutes: launch them in a background shell, keep working, and
  when the report lands (even an hour and several topics later), deliver its
  findings to the owner tied back to the original question. A launched run
  that never gets reported back is a failure.
- **Long runs stay visible.** Pipe a long run's stdout through `tee` to the
  report file (never `> file` alone) so the harness background-task view
  streams progress instead of showing "no output yet". While actively
  working, poll at every natural pause: confirm liveness, catch failed legs
  early (a transient rate limit gets a retry, up to 3), and give the owner a
  brief status line with elapsed time. When a run lands, report its total
  duration, tokens, and cost alongside its findings.
- **A dormant agent cannot poll.** Between turns nothing runs, and the
  harness only notifies when a whole background command exits, so a
  multi-job command (fanout) reports nothing until its LAST leg ends. Before
  going idle with runs still out: arm a Monitor that watches each job's API
  status (event per terminal state + a coarse heartbeat), or launch runs as
  one command per job so every completion fires its own notification.
- **Give research subagents the Reddit route.** Reddit blocks normal
  fetching; when codex/gemini need forum evidence, either include the
  reddit-fetch technique in their prompt (append `.json` to any Reddit URL
  and curl it with a real User-Agent; codex needs
  `-s workspace-write -c sandbox_workspace_write.network_access=true` to
  curl) or fetch the threads with the skill and hand them the content.
- gemini: its `google_web_search` tool is built in but the MODEL decides
  whether to search. Always verify its output contains real cited URLs.
  Treat "based on simulated search" or uncited claims as a failed run and
  either rerun with explicit search instructions or discard (it has
  fabricated research before). Retry transient CLI errors up to 3 times.
- Report both sides: my findings first, then the peers' additions or
  disagreements, reconciled with reasons.

## Skills

- **Surface every skill loudly.** The moment a skill loads or gets applied,
  say so in chat by name ("loading the styleseed-design-review skill"), so
  the owner has attribution when he likes or dislikes a result and can tune
  the skill set.
- **CLAUDE.md reigns supreme.** If a skill's guidance conflicts with any
  rule in this file or docs/rules, HARD STOP: name the conflict and let the
  owner decide (modify the rule or remove the skill). Never silently follow
  the skill over the house rules.
- **Cycle skills when output disappoints.** If a skill-guided attempt isn't
  landing, say so and try a different relevant skill (announce it). Visuals
  are not the fallback for failed words; they ride along from the start (see
  Visual generation).
- **Credit skills in summaries.** A summary or result writeup names the
  skills that actually shaped it ("used baseline-css and frontend-design").
  If no skill was used, say nothing about skills at all.
- **Skills are living documents.** When research or a work session turns up
  a fact that updates a skill (a feature went Baseline, a tool changed, a
  technique proved wrong), fold it into the skill file in passing and say so.
- **Reddit and forums:** the `reddit-fetch` skill (curl JSON API) is the way
  into Reddit, which blocks normal fetching. Use it whenever a web search
  touches Reddit or forum content, and when codex/gemini subagents need
  Reddit evidence, fetch it with the skill and hand them the content (they
  cannot run our skills).

## Visual generation (always in the toolbox)

Both peer CLIs generate images on demand; use them freely as part of normal
back-and-forth, not just when asked:

- `gemini --image out.png "<prompt>"` (Nano Banana Pro;
  `-m gemini-3.1-flash-image` for the faster Nano Banana 2).
- `openai --image out.png "<prompt>"` (gpt-image-2, the reasoning image
  model, generally the stronger generator; `-m gpt-image-1-mini` for cheap
  and fast).

**Visuals are the default, not a fallback.** The owner always wants to see
the thing: diagrams, charts, swatches, mockups, and generated images ride
along WITH explanations, not only when words fail. Any time a design
direction, system, comparison, or data shape is in play, produce the visual
in parallel (launch image generation in the background and keep talking).
Judicious about which visual, never about whether. Generate, then READ the
image to judge it before presenting, and iterate. Hand-written SVGs and
mockups remain first-class alternatives; the models are for when rendering
quality or speed beats hand-rolling.

## Banned words in identifiers (HARD BANS, most-missed rules)

These words may not appear in any name you define: variables, params, fields,
functions, types, files, folders. Name the actual thing, not its relationship
to other code. The only pass is an external API's own surface (React's
`useState`, the DOM's `event.data`, a `default` export). Keep their word at
that boundary only, never thread it into names we own.

- **`state`**: every value is state, so it names nothing. `WeatherFeed` not
  `WeatherState`, `columnLayout`, `sortModel`, `dragSession`, `hoverInfo`.
  The setter destructured from `useState` is OURS: `const [volume,
  storeVolume] = React.useState(0)`, never `setVolumeState`.
- **`shared`**: names a relationship. A folder of scrubber pieces is
  `parts/`, a reused config is the `baseConfig`.
- **`data`**: emptiest noun. Use `frame`, `payload`, `record`, `rows`,
  `pixels`.
- **`type`**: emptiest discriminator. A command has a `kind`, an event a
  `name`, a node a `role`, a file a `format`. (The TS `type` keyword is
  fine.)
- **`helpers` / `utils`**: name what the bundle is: `RowAffordances`,
  `scrub-math`.
- **`common` / `core`**: name what makes it central, not that it is central.
- **`manager` / `handler`**: name the action or the owned thing:
  `uploadQueue`, `onRowClick`, `retryPolicy`.
- **`default` / `defaults`**: name the bundle: `functionArgs`, `baseDraft`.
- **`index` spelled out**: `i` for live loop counters, `idx` for kept
  positions (`insertIdx`, `siblingIdx`).
- **`Use` prefix on types**: hooks are `useFoo`, but their types are plain
  nouns: `ColumnAffordances`, not `UseColumnAffordancesResult`. No `T`
  prefix on types either.

## Files and modules

- Organize by the reader's task. Name files for what they do. **No `fns.ts`,
  `utils.ts`, `helpers.ts`, `shared.ts`, `literals.ts`**: those are syntax
  buckets. `parse-row.ts`, `staged-drafts.ts`, `rank-results.ts`.
- A module is a folder with one `index.ts(x)` as its public door. Everything
  else is a named sibling inside it. No barrel files that only re-export.
  `types.ts` only when several files in the module share the types.
- **Import discipline.** Consumers import through path aliases and a
  module's public door, never into its internals
  (`entities/review/types` is banned, `entities/review` is the door) and
  never via `../` reach-backs across layers. Barrels re-export everything a
  consumer may need, including types (`export type * from "./types"`).
  Inside a module folder, relative imports are fine: that is its private
  space.
- **One React component per file.** A file owns its one capitalized
  component plus private non-component render helpers. The moment a thing
  needs a second file it becomes a folder: `foo/index.tsx` + named siblings
  inside. Never loose helper files next to the parent, never two components
  in one file.
- **Components in disguise count.** A lowercase JSX-returning helper with
  its own layout/behavior, or an inner `function fooSection()`, IS a second
  component: spell it as a prop-fed sibling in a folder. Tripwires: a second
  non-trivial JSX unit, a look-table/action-cluster bundle, or ~300+ lines
  means promote to a folder. Don't be afraid of folders. (A hoisted helper
  that closes over live component state and would need 10+ props to extract
  may stay inside. That's cohesion.)
- **When the escalation tripwires fire, the structural split is part of the
  current work**, not a follow-up. Don't keep stacking behavior onto an
  orchestrator that already owns multiple workflow stages.
- Deep modules: small public surface, real work hidden. Don't shatter
  cohesive code into category files. Don't keep folders that hold one real
  file. Promote a helper to its own module only when a second real caller
  appears.
- **Orchestration reads as narrative.** A pipeline's entry point should read
  as its numbered stages (plan, capture, normalize, emit). Source quirks,
  retries, parsing, and math live in named step files, not inline in the
  orchestrator.
- **Boundary types are deliberate.** Where two languages or processes meet
  (client/worker, NDJSON on stdout), name the wire shapes on both sides (a
  `Wire*` prefix is fine, it makes schema drift greppable) and update both
  ends plus fixtures in the same change.
- Inline SVG components are icons: `atoms/icons/<name>/index.tsx`, exported
  from `atoms/icons`. Never bury one in a feature component.
- No IIFEs. Use a named function next to the call site (a `function` helper
  after a component's `return` is the one place the hoist is required).
- Pure logic separate from I/O (browser/process/file-system objects stay at
  the edges). Tagged unions over parallel booleans. Name step files for the
  stage they perform.

## TypeScript style

- No explicit return types. Let TS infer. Annotate only public API
  contracts, recursion, or intentional narrowing (prefer a cast at the
  `return` over annotating the signature).
- `const` arrows for everything except React components/hooks, which use
  `function` declarations. Helpers may sit below the export that calls them.
- **Never destructure an object argument in the parameter position.** Take
  `(props: Props)` and destructure on the first line of the body, or just
  read `props.x`.
- Import React as a namespace: `import * as React from "react"`;
  `React.useState(...)`. Never destructure hooks from `"react"`.
- Prefer `Array.from(x)` / `a.concat(b)` over `[...x]` / `[...a, ...b]`
  (spread only when `concat` would force a cast).
- Reach for Baseline APIs: `map.getOrInsert`, `toSorted`, Set ops,
  `Object.groupBy`, `array.at(-1)`. Ships on WKWebView, so Baseline means
  usable.
- Consolidate related state: a string-union phase over parallel booleans, a
  `useReducer` with named transitions when fields change together. Two
  unrelated booleans stay two booleans.
- Imperative DOM listeners: one `AbortController` signal, `abort()` as
  cleanup. Never keep named handlers just for `removeEventListener`.
- **Never the `void` operator** (HARD BAN). Fire-and-forget is a plain call:
  `runScan(id)`, not `void runScan(id)`. Never weaken a lint rule that
  enforces it. (The `void` *type* in `() => void` annotations is fine.)

## Dates: `Temporal`, never `Date` (HARD BAN)

No `new Date`, `Date.now()`, or `Date` methods in code we own. The polyfill
is `temporal-polyfill/global`, imported first at the entry. It is NOT
installed in this repo yet: the first change that touches date logic
installs it and adds that entry import in the same PR.
`Temporal.Now.instant().epochMilliseconds` for a clock read;
`Temporal.Instant.fromEpochMilliseconds(ms)
.toZonedDateTimeISO(Temporal.Now.timeZoneId())` to display. Databases store
epoch-ms integers, converted at the display boundary. The only `Date`
allowed is one an external library forces, converted at that single
boundary.

## React 19

The React Compiler is on. **Do not write `useCallback` / `useMemo` /
`React.memo` for performance**: plain functions and inline literals. Keep a
manual memo only for a concrete identity contract (effect dep, ref callback,
imperatively attached listener, reference-compared library API, context
value the compiler bails on), with a one-line comment naming that consumer.
Know the modern primitives: `useSyncExternalStore`, `useEffectEvent`,
`useTransition`, `useDeferredValue`, `useOptimistic`, `useActionState`,
`use()`.

## UI: atoms + Panda props

- Build from the wrapped atoms (`Block`, `Text`, `Button`, `Input`, ...),
  never raw `<div>`/`<span>`/`<button>` with inline styles or CSS modules in
  feature code. Atoms carry motion wiring, tokens, and the typed prop API.
- Style atoms with **props**, not `className={css(...)}` (that loses the
  cascade race, see "The cascade contract" in `panda-style-reuse.mdc`).
  Conditions are props (`_hover`, `_focusVisible`, `_disabled`, `_dark`,
  `_before`/`_after`); responsive values are object syntax. Never write
  `"&:hover"`, `_dark: {...}`, or `_disabled: {...}` blocks inside
  `css={{...}}`: those ARE the prop forms, so nest them
  (`_hover={{ bg: "...", _dark: { bg: "..." } }}`). `whiteSpace`,
  `fontVariantNumeric`, `minW` etc. are props too.
- `css={{...}}` is last-resort residue for selectors with no prop form
  (markup-specific `:has()` one-offs, descendant selectors like
  `"&:hover span"`, ancestor-state selectors keying off a parent's
  data-attribute, `@supports`). If every key could be a prop, use props.
- **Panda extracts statically.** A style prop fed a runtime variable
  silently emits nothing. Enumerable values get inline literals in both
  ternary branches; open-ended/computed values use raw `style={{...}}` (or
  `_motion.style`).
- Spacing/sizes/radii ride the lh rhythm tokens (`xs`...`2xl`). Colors come
  from semantic tokens (`surface-*`, `text-*`, `border-*`).
- **`neutral.100` is banned as a surface/fill (HARD BAN).** The light-mode
  page is `gray.50`/`neutral.50`, and `neutral.100` is one barely
  perceptible step above it that disappears against the canvas. Any fill
  sitting on the page must be `neutral.200` or darker (that's why
  `surface-muted` is `neutral.200`). `neutral.100` as *text* on a dark
  surface is fine. This survives any future palette change: adjacent
  surfaces always get a real contrast step.
- **No flat white surfaces sitting directly on the page.** A white card on
  the `gray.50` canvas reads muddy. Reserve white/`surface-panel` for
  *elevated* surfaces that carry a shadow (popovers, modals, inputs). Group
  on-page content with spacing and proximity, not a flat filled card.
- **Stop and ask** when an atom can't express the design, when you'd reach
  for a raw element/CSS module, or when an atom wants a new prop/slot/
  variant. Name the gap and the options. Don't silently work around it.
- Layout: **grid over flex** (`<Block grid rows="auto 1fr auto">`). Overlays
  via a single grid cell (`gridArea="1 / 1"` + `placeSelf`), not
  position-absolute math. Flex only where grid genuinely can't (e.g.
  wrapping variable-width children).

## Motion

Atoms are motion components. Pass motion props through `_motion` on the atom
instead of raw `motion.div` in feature code. Animate transforms, never
width/height/top/left (use `layout` / `layoutId` for real layout changes,
and know the scale-distortion corrections). Motion values over React state
for continuous/high-frequency values. `AnimatePresence mode="popLayout"`
when siblings must reclaim an exiting element's space. Wrap UI roots in
`<MotionConfig reducedMotion="user">`. Enter ~300ms, exit ~200ms.

## Comments and writing

Default to silence. Comment only what the code cannot say: cross-file
coordination, why a deliberate-looking choice is correct, what breaks if a
line changes, platform quirks (name the bug). Plain language a new hire gets
on first pass. Never: restating code, change annotations ("bumped from 18"),
value-tweak paragraphs, field comments the type already explains, section
banners, speculative "someone might wonder". Comments describe the code as
it is NOW. Never write history-only comments (what a file used to be
called, that an implementation used to be wrong, that a migration
happened). That story lives in commits and PRs. Headers are 1-3 sentences,
and narrative goes inline next to the lines it explains.

**No em dashes (HARD BAN, zero exceptions).** No em dash character and no
double-hyphen `--` standing in for one, anywhere we write: comments, docs,
commit messages, PR bodies, UI strings, chat replies. Use a comma, colon,
period, or parentheses. When editing a file that already contains one,
proactively rewrite it out in passing (no repo-wide sweeps). Also avoid
semicolons in prose (comments, docs, chat): prefer a period and a new
sentence.

## No quiet failure paths (HARD BANS)

Three faces of one rule: code never hides a failure, and neither do I.

**No legacy / fallback code.** One shape per piece of data. Migrations
rewrite old data, and production code never branches on pre-migration
shapes. No `Legacy*`/`old*` coercion helpers, no key-presence sniffing, no
`// backwards compat` branches, no `null` as a "processed but empty"
sentinel (absent vs present only), no silent catch-and-return-default in
extractor paths. Legitimate fallbacks handle conditions that always exist
(offline, missing hardware), not conditions a migration removes. Never paper
over a failure with a "safe" default. Fix the root cause at the
data/source/logic level.

**Errors are surfaced, never swallowed (zero tolerance).** `.catch(() => {})`,
`.catch(() => null)`, empty `catch {}`, and any catch whose body neither
surfaces nor handles the error are banned, no exceptions, not even
"temporarily". This exact pattern has caused real production bugs (h3's
`useSession` swallows its unseal error and returns an empty session, the
kind of thing that strands a logged-in user). Every catch must surface the
error through the feature's real error path (error state, onError callback,
error response), log it with context (`console.warn("[voice] paste prefetch
failed:", error)`, named subsystem + the error object), or convert it to a
defined alternative value the caller interprets. Filtering an expected
rejection is allowed only by matching the SPECIFIC error with a comment
naming why it's normal (e.g. `audio.play()`'s AbortError on pause), then
surfacing the rest. Cleanup in a catch (clearing a slot) doesn't count as
surfacing. **Enforce on sight:** when touching any file, scan it for
empty/no-op catches and fix them without being asked. If a third-party
library swallows errors, route around that lossy path.

**No silent deferrals.** Implement the whole feature or stop and raise the
gap BEFORE deferring: name the missing piece, the symptom, the proposed
scope, and ask. Never ship "a future worker handles this" when no such
worker exists. Trace flows end-to-end (UI to server to durable effect to
projection to UI) before claiming done.

## Backend (Cloudflare, currently dormant)

The Alchemy + Drizzle infra exists but is not wired to the app yet. These
rules bind the moment it is:

- **Fight read/write cost on every feature.** We run on Cloudflare's free
  plan. D1 bills rows SCANNED, not returned, so design the schema for the
  query: know the access patterns first, index the hot paths, estimate rows
  scanned per day at 100/1k/10k users before committing a query, prefer one
  round trip (batch, bounded `IN (...)`, no N+1), and revisit old queries
  when new features land. Never sacrifice a feature to save reads when a
  redesign can save them instead. Full rule:
  `docs/rules/minimize-read-cost.mdc`.
- **Builds run through `alchemy dev` / `alchemy deploy`, never raw
  `vite build`** (the Alchemy Vite plugin needs the generated wrangler
  config first). Until the infra is wired, `bun run dev` / `bun run build`
  remain the entry points.
- **Server code never reaches the client bundle.** TanStack Start colocates
  server functions with UI, so guard the boundary deliberately. Full rule:
  `docs/rules/server-client-boundary.mdc`.
- **Auth never leaks account existence** (register and login give uniform
  responses whether or not the email exists). Full rule:
  `docs/rules/no-account-enumeration.mdc`.
- **Guard the system against abuse, never against people.** Assume a
  logged-in contributor could go rogue: rate limits, per-actor caps, and
  result-size limits ship WITH the feature. Guards are mechanical and
  content-neutral.
- **Maintain the Domain Vocabulary.** As data structures land, keep a
  ubiquitous-language section (domain terms with one-line meanings plus a
  naming pool of preferred concrete words) in this file or `OVERVIEW.md`,
  and never invent synonyms for an existing term unless the domain model
  changes first.

## Workflow

- **`bleeding-edge` is the standing integration branch** (a universal
  convention across the owner's projects: every repo has `main` plus
  `bleeding-edge`). It always carries main + every open PR branch + feature
  work in progress. The cycle, in order:
  1. Day-to-day work accumulates **uncommitted** in the working tree on
     `bleeding-edge`. Do NOT commit or push it, not after a feature, not
     after a review round.
  2. The owner tests the feature and iterates through feedback rounds,
     still uncommitted.
  3. Only when he says to slice: cut the work into PRs targeting `main`.
  4. Then merge those PR branches back into `bleeding-edge` (merge, never
     rebase, same for open PR tips and `main` whenever they move), so it
     always has the latest code regardless of merge status. Pushing
     `bleeding-edge` is fine at this point, after the PRs exist, never
     before.
- **PRs are plain `git` + `gh`** (the owner's BetterGit app manages stacks
  and merges on his side). Never commit on `main`. Commit message = PR body
  (motivation, `## Changes`, `## Test plan`). 150-400 LOC per PR grouping
  related work. Fix review feedback in place on the PR branch, don't stack
  fixup PRs. Expect the owner to merge PRs on GitHub within minutes and in
  any order: fetch and reconcile before mutating branches.
- **Code-health tooling:** Fallow is not wired into this repo yet. When it
  is, run `bun run fallow:audit -- --changed-since main` after substantial
  JS/TS changes (see `fallow-quality-analysis.mdc`).
- **Testing:** unit tests live beside the code. E2E tests go in a single
  `e2e/` directory at the root. Test behaviors, not implementation. Every
  test must earn its place. Failure modes are a parameterized matrix, not
  copy-paste. Playwright uses semantic locators + web-first assertions,
  never `waitForTimeout`. Full rule: `docs/rules/testing.mdc`.
- **Supply-chain gate:** `bunfig.toml` sets `minimumReleaseAge = 259200`
  (72 h). Never remove it to force a fresh-off-the-press version.
- **Durable knowledge goes in committed files, not just agent memory.**
  Behavioral rules belong here in CLAUDE.md, and longer design/context docs
  belong in `OVERVIEW.md` or `docs/`, so any agent on any machine can pull
  the repo and get up to speed.
