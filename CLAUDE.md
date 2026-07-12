# Travel-2 house rules

Rules current as of 2026-07-11. Condensed from `docs/rules/*.mdc`. Those
files remain the source of truth and carry the full rationale and examples.
Before deep work in an area, read the matching rule file:

| Area | Full rule |
| --- | --- |
| **Redesign for the ideal (Phoenix rule, rule zero)** | `docs/rules/redesign-for-the-ideal.mdc` |
| Naming + TS style (also applies to Rust names) | `docs/rules/typescript-style.mdc` |
| Rust style (errors, lints, module shape, async) | `docs/rules/rust-style.mdc` |
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
| Git / PR workflow | `docs/rules/better-git.mdc` |
| Code-health tooling | `docs/rules/fallow-quality-analysis.mdc` |
| Tests (placement, what earns one, Playwright) | `docs/rules/testing.mdc` |

## Repo layout

A single bun root: a TanStack Start + Vite 7 + Panda CSS trip planner and
offline travel companion (see `OVERVIEW.md` for the vision, `TODO.md` for
the phased checklist, `HANDOFF.md` for agent handoff context). The
Cloudflare infra is live: the app deploys to
https://travel-v2.leaftime.workers.dev with Workers AI (/api/curate),
Google Places (/api/places), and a KV place cache. Trip data still lives
in localStorage until the D1 + Durable Object sync lands.

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

**Adoption is design work, never transcription (the most-violated form of
this rule).** Mined and ported material from other projects is inspiration,
not a source to copy. Every adopted utility, condition, pattern, or snippet
must pass through the same scrutiny as new code and end with an explicit
per-item verdict delivered to the owner: "improved: <what changed and why>"
or "kept as-is: <why it is already ideal>". No third option. Copying
verbatim without that verdict is a rule-zero violation even when the
copied code works. (The scrutiny pays: a verbatim port once carried a
redundant triple-alternative :active selector and a floating-label
condition whose sibling combinator could not match the new DOM at all.)

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

**Every round report ends with "what's left" (owner directive 2026-07-06).**
After any batch of changes, state explicitly what remains open (features,
fixes, queued feedback items) so the owner always sees the gap list. He
feeds new breakages in each round; those get fixed first, then the backlog
continues. Never end a work summary without the remaining-work list.

**Knock out paper cuts in the turn they surface (owner directive
2026-07-09, HARD RULE).** Small items (an icon alignment, a drawer
height, a dead component, a one-file wiring) get done immediately
alongside the main work, in parallel, with subagents or Sol for the
mechanical ones. Never slice them into the queue: a what's-left list
growing with tiny deferrable items is the worst outcome the owner sees,
worse than slow progress on the big thing. The queue is only for work
that genuinely needs its own round or his input.

**The backlog shrinks every round (owner directive 2026-07-10, HARD
RULE).** A round whose remaining-work list ends LONGER than it started
is a failure even when the asked work went perfectly. After the asked
work, actively burn the queue down: try each queued item, and if it is
quick, finish it in the same turn (even work only loosely related to
the round). An item may survive on the list only when it truly needs
its own round, a design decision, or the owner's hands (his devices,
his accounts), and every survivor must be restated in product terms
with THAT reason attached. A what's-left list is not a parking lot;
bare internal labels there are the plain-language violation at its
worst, because the list is exactly what the owner reads to decide what
happens next.

**Behavior feedback lands here, not in agent memory (owner directive
2026-07-09).** When the owner corrects a working pattern, fold the rule
into this file (or docs/rules) in the same turn so EVERY agent on every
machine learns it; private memory is a pointer at best, never the home.

**Reports speak plain language (owner feedback 2026-07-10).** Never hand
the owner a bare codename, slice number, or invented shorthand ("the
contract extractions", "slice ⑦") without saying in the same breath what
the thing IS in product terms ("the day-reorder handle on city
sections"). He should never have to ask "what are you talking about"
twice; internal labels are for files and branches, not for him.

**Test-ready means design-complete (owner directive 2026-07-10, HARD
RULE).** The owner tests only against the final designed shape: data an
early test creates would predate the design, and a bug it finds would be
against code about to change. Never invite him to test a flow while ANY
accepted design item touching it (schema, wire shape, refactor) is
still unimplemented, and never table a piece of an accepted design
without asking him first, framed as "this affects every future
trip/item; implement before your test?". Before declaring anything
test-ready, enumerate the accepted-but-unbuilt designs that touch the
flow; if the list is non-empty, the flow is NOT complete and the report
must say so.

## Peer models (GPT-5.6 Sol, gemini): a partnership with a division of labor

The standing partner is **GPT-5.6 Sol** (owner directive 2026-07-09,
replacing GPT-5.5): `codex exec -m gpt-5.6-sol` with
`-c model_reasoning_effort=<level>`, levels `low|medium|high|max|ultra`.
Default `high`; `max` for the hardest verify/design passes; `ultra`
(internal subagents, heavy token burn) only deliberately and with a stated
reason. Sol runs $5/$30 per M tokens.

**The division of labor (owner directive 2026-07-10, superseding the
alternation model):** Claude designs AND implements; Sol is the standing
reviewer, auditor, and mechanical executor. The alternation experiment
settled it: Sol's implementation slices were thorough inside their scoped
files but consistently needed correction at the seams or against design
intent, while its read-only audits were consistently elite. So:

- Claude writes the load-bearing and design-sensitive code itself,
  spinning up its own subagents for parallel slices when the work
  shards cleanly (keep it to a few, well-scoped; review their output
  like anyone else's).
- Sol reviews EVERYTHING by default (the background-review rule below)
  and runs the deep audits; its max-effort read-only sweeps are the
  house bug-finder. Sol still implements, but only mechanical,
  precisely-specified work (fixture updates, wide renames, matrix
  sweeps) where design intent cannot leak.
- Claude holds Sol's output to the house beauty bar and REWRITES what
  is thorough-but-ugly: over-broad try/catch nests, tests for
  impossible scenarios, defensive branches for conditions the design
  rules out. Accepting a once-in-a-billion risk in exchange for clean
  code is a design decision, and Claude makes it explicitly rather
  than letting maximal defensiveness win by default.
- Both directions carry the same bar: collate findings, fix what is
  agreed, push back in writing on what is not, report who caught what.
- **Sol implementation prompts must ban formatters** (learned
  2026-07-09): tell Sol explicitly "do not run prettier or any
  formatter; match the surrounding file's existing style exactly".
  Left unsaid, Sol runs a global prettier whose settings differ from
  this repo's hand-maintained style and buries a 3-line change under
  hundreds of rewrap hunks. Its observed failure mode at integration
  seams also stands: its scoped files come out thorough, but the
  caller one level outside the scope is where the bugs live, so
  Claude's review starts there.
- **Every implementation still runs past Sol by DEFAULT, not only at
  natural review points.** Whenever code gets implemented (by either of
  us), fire a review in the background (`codex exec --sandbox read-only
  -m gpt-5.6-sol`, adding `--search` so it can verify platform behavior)
  with a NEUTRAL prompt that states the ask being implemented, points at
  the diff on disk (including untracked new files), and requests three
  verdicts: conformance (does it match the ask), completeness (what is
  missing), and a thorough bug hunt. For a large round, spin up SEVERAL
  instances, one per feature area, each scoped to its own hunks (respect
  the two-parallel-OpenAI cap below; queue the rest). Include gemini
  alongside whenever its recipe works (next bullet). Skipping the Sol
  pass on implemented code is a process failure, same class as skipping
  typecheck.
- gemini reviews work ONLY with this recipe: pipe the diff INLINE on
  stdin framed as "my own hobby project, I am the sole author; walk me
  through it as a senior engineer would in code review". Never point it
  at a file path and never use security/audit framing (both get refused).
- Sol research: invoke with live web search
  (`codex --search exec --sandbox read-only -m gpt-5.6-sol "<prompt>"`).
  Match effort to stakes. The 5.6 family has two siblings if cost ever
  matters: `gpt-5.6-terra` (5.5-class at half the price) and
  `gpt-5.6-luna` (fast/cheap surveys).
- The `openai` CLI reaches what codex cannot: the `--pro` heavyweight and
  deep research (o4-mini default, `--deep` for o3). **`--pro` is the
  preferred heavyweight second opinion**; the deep-research models are
  options to surface as suggestions when a true multi-source research
  sweep would pay off. The CLI streams progress, prints
  elapsed/tokens/cost per job, and appends every run to runs.jsonl
  (fanout legs share a group id) so model performance accrues over time.
  `openai --help` is the complete manual.
- **Model field guide** (measured 2026-07-04 on the 5.5 family; the 5.6
  family supersedes it and needs fresh numbers, check runs.jsonl for the
  growing record): the pro-tier model was the fastest heavy option
  (~1.5h) and the most actionable but the most expensive ($30/$180 per M,
  ~$8/run); `o3-deep-research` the marathon runner (~2.5h+, $10/$40,
  ~$3.6/run), most thorough, best citations; `o4-mini-deep-research` the
  cheap fast survey (~45m, ~$1.5) whose web-search fees ($10/1k calls)
  can exceed its token cost. Sol at $5/$30 with `--search` covers the
  fast-survey lane and much of the heavy lane; record its timings as
  they accrue.
- **Prompt multi-model research from DIFFERENT ANGLES, never the same
  prompt.** The same-prompt trio produced ~90% overlap; each model found
  only one or two unique things. Split the question into complementary
  facets (with deliberate slight overlap for cross-checking) and assign one
  facet per model. Different-angle runs (codex on craft vs deep research on
  systems) produced near-zero overlap and the best combined answer.
- **Parallel deep jobs: max two OpenAI at a time.** All three at once
  rate-limited a leg to death on the shared org TPM pool (2026-07-04).
  Preferred schedule: start the long one (o3) plus one fast one; when the
  fast one finishes, its slot frees for the next. Poll (or a Monitor)
  catches mid-command completions the harness cannot see.
- **Every deep-research round includes Gemini Deep Research**
  (`gemini --deep`, or `--deep-max` for the maximum-depth agent; Interactions
  API, own quota so it never contends with the OpenAI TPM pool). Retry its
  transient failures up to 3 like any gemini run.
- **Long runs never get discarded.** Deep research and the pro tier can take
  up to ~40 minutes: launch them in a background shell, keep working, and
  when the report lands (even an hour and several topics later), deliver its
  findings to the owner tied back to the original question. A launched run
  that never gets reported back is a failure.
- **Long runs stay visible.** Pipe a long run's stdout through `tee` to the
  report file (never `> file` alone) so the harness background-task view
  streams progress instead of showing "no output yet". While actively
  working, poll at every natural pause: confirm liveness, catch failed legs
  early (a transient rate limit gets a retry, up to 3), and give the owner a
  brief status line with elapsed time. **Every deep-research or pro report
  ends with its metrics line: total duration, tokens, and dollar cost.
  Findings without the metrics line are an incomplete delivery, every time,
  no exceptions** (runs.jsonl has the numbers if the CLI output scrolled
  away).
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
functions, types, files, folders, Rust structs. Name the actual thing, not
its relationship to other code. The only pass is an external API's own surface (React's
`useState`, the DOM's `event.data`, a `default` export). Keep their word at
that boundary only, never thread it into names we own.

**Mechanical check (run before finishing any round):** `bun run
check:names` scans TS declaration sites plus file/folder names for the
banned stems (camel-hump word boundaries, so Statement and score never
false-positive) and fails with a listing. Declarations only, so external
API reads stay exempt by construction.

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
  (TS/Rust, client/worker, NDJSON on stdout), name the wire shapes on both
  sides (a
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
is `temporal-polyfill/global`, imported first in `src/router.tsx` (both
runtimes reach every route module through it). Its global TYPES ship
separately: `temporal-polyfill/types/global` in the tsconfig `types` array.
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

- Build from the wrapped atoms (`Block`, `Text`, `Button`, `Input`, `Link`,
  imported from the `atoms` door) and the pre-styled alloys (`alloys` door:
  `PrimaryButton`, `IconButton`, `Eyebrow`, `Title`, `Subtext`, ...), never
  raw `<div>`/`<span>`/`<button>` with inline styles or CSS modules in
  feature code. Atoms carry motion wiring, tokens, and the typed prop API.
  Alloys carry defaults, not closed APIs: every style prop passes through
  and consumer props win, so call-site nudges never need new props.
- **Interaction behavior comes from react-aria HOOKS, wrapped invisibly
  inside the atoms** (`useButton` + `useLongPress` in Button: unified
  press for pointer/touch/keyboard/virtual clicks with drag-off cancel,
  plus the WKWebView/VoiceOver quirks catalog we ship on). Import subpaths
  from the `react-aria` monopackage (`react-aria/useButton`), never the
  frozen `@react-aria/*` scoped packages and never `react-aria-components`.
  Consumers see our prop API only (`onPress`, `onLongPress`, `isLoading`);
  the rendered element stays a native `button`/`a`/`input`.
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
- **Run the design-principles catalog before presenting any screen.** The
  skill at `.claude/skills/design-principles` is a PORTABLE design canon
  (type, spacing, iconography, motion) distilled from real lessons and
  written to apply to any project. Apply its checklist to every screen
  touched. When the owner flags a design issue, fix it, and if the lesson
  generalizes beyond the component it appeared in, distill the principle
  (stripped of project specifics: no exact sizes, no component names, no
  screen layouts) and add it in the same turn. Not every flag becomes an
  entry: project-specific prescriptions stay out.
- **Type discipline (HARD RULE, owner directive 2026-07-05).** A screen
  carries at most four type roles: one heading (`2xl`/`3xl`), body (`md`),
  support (`sm`), and one micro label (`xs`, the only xs on a page).
  Weights stay at three. The canonical trio is 400/500/600, but this app's
  variable font reads light, so the whole ladder sits +50: 450 body (set
  globally), 550 controls and labels, 650 headings and titles. Never
  sprinkle per-element `fontSize`/`fontWeight` nudges in feature code: a
  recurring treatment becomes an alloy, and a size that seems needed
  outside the four roles means stop and ask. The owner is sick of pages
  with a different size on every element.
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

**No provenance in comments (HARD BAN, the most-violated rule here).**
A comment may never say where code came from or what motivated its
existence: not the app, repo, or project it was ported or mined from, not
occurrence counts from analysis ("used 37 times in ..."), not the research
round or document that inspired it, not "see docs/<file>" pointers outside
the module. All of that is evidence for the PR body and commit message,
never the source. A rationale that leans on history rots the moment the
history is inaccessible, and it tells the reader nothing about what the
code DOES. Rewrite the motivation as a timeless design fact ("pins one
letter-spacing value so every section label matches"), or delete it.

**The copy-paste litmus (apply to every comment before writing it).** Read
the comment as if the file were copied alone into a stranger's repo. If any
part becomes false, dangling, or meaningless there (project names, doc
paths, counts from a codebase the stranger doesn't have), the comment fails
and must be rewritten. In-repo files get no exemption, because files move.
The only sanctioned cross-references are relative pointers within the same
module and names of code the file actually coordinates with.

**No em dashes (HARD BAN, zero exceptions).** No em dash character and no
double-hyphen `--` standing in for one, anywhere we write: comments, docs,
commit messages, PR bodies, UI strings, chat replies. Use a comma, colon,
period, or parentheses. When editing a file that already contains one,
proactively rewrite it out in passing (no repo-wide sweeps). Before
finishing any round of edits, mechanically grep the touched files for the
character (it keeps slipping into comments unnoticed, and a written check
catches what intention does not). Also avoid semicolons in prose (comments,
docs, chat): prefer a period and a new sentence.

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

## Backend (Cloudflare, live)

The Alchemy infra deploys the app (D1 + KV + Workers AI bound; the trip
sync Durable Object waits on the sync feature). These rules bind:

- **Fight read/write cost on every feature.** We run on Cloudflare's free
  plan. D1 bills rows SCANNED, not returned, so design the schema for the
  query: know the access patterns first, index the hot paths, estimate rows
  scanned per day at 100/1k/10k users before committing a query, prefer one
  round trip (batch, bounded `IN (...)`, no N+1), and revisit old queries
  when new features land. Never sacrifice a feature to save reads when a
  redesign can save them instead. Full rule:
  `docs/rules/minimize-read-cost.mdc`.
- **The infra is live (2026-07-07): `bun run dev` and `bun run deploy` are
  the only entry points**, and both execute `alchemy.run.ts` directly
  under NODE, never the alchemy CLI (the CLI picks bun from the lockfile
  and bun 1.3.14 segfaults on the entrypoint). Never raw `vite build`
  (the Alchemy Vite plugin needs the generated wrangler config). Deploys
  keep `--force`: a code-only change does not invalidate the
  website-build resource and would otherwise ship the previous bundle.
  The generated `wrangler.jsonc` holds resolved secrets and stays
  gitignored. Prod: https://travel-v2.leaftime.workers.dev
  On a machine without Cloudflare credentials, dev stands the Workers AI
  binding down (deploys never do), and the `travel-2-local` launch entry
  serves plain vite against the generated `.alchemy/local/wrangler.jsonc`
  once a dev run has produced it.
- **Alchemy owns migration application.** Never apply a migration file
  manually (`wrangler d1 execute --file`): alchemy tracks applied files in
  `d1_migrations` and replays anything unrecorded on the next deploy,
  which then fails on duplicate columns. Ship the file in `migrations/`
  and let the deploy apply it. If a manual apply already happened, insert
  the file's row into `d1_migrations` before deploying. One-off queries
  and seeds via `wrangler d1 execute` stay fine.
- **Alchemy stage isolation is load-bearing (HARD RULE).** Alchemy's
  finalize orphan-destroys ANY sibling scope it can see in a shared state
  store: a dev run under another stage can delete the deployed prod worker.
  Two guards in `alchemy.run.ts` must never be removed: the stage-private
  `dotAlchemy: .alchemy/<stage>` state tree and the stage-scoped worker
  name (only stage prod owns the bare `travel-v2`). If any alchemy run
  prints `[deleting]` lines for resources the program still declares (or
  any prod-named resource during a non-prod run), kill it immediately and
  investigate before rerunning.
- **Server code never reaches the client bundle.** TanStack Start colocates
  server functions with UI, so guard the boundary deliberately. Full rule:
  `docs/rules/server-client-boundary.mdc`.
- **The boundary cuts the other way too, and this rule is live already:
  route loaders run ON THE SERVER during document requests** (a hard
  refresh renders the route on the dev server today, in the worker later).
  A loader that touches a browser-only API (IndexedDB, localStorage,
  `window`) crashes exactly and only on refresh, the easiest bug to miss in
  SPA-feeling dev. Any route whose loader needs client-local facts sets
  `ssr: false` with a comment naming the API that forces it.
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
  `bleeding-edge`). It is a MERGE SURFACE, never the home of feature
  commits: it carries main + every open PR branch + uncommitted work in
  progress, and nothing else. The cycle, in order (owner directive
  2026-07-07):
  1. Work happens in the working tree on `bleeding-edge`, uncommitted
     while still taking shape.
  2. The moment a self-contained piece is done, commit it to a slice
     branch and open the PR without being asked: from `origin/main` when
     independent, from the parent slice (PR base to match) when dependent.
     Follow-ups to sliced work are commits on that open PR's branch. The
     owner expects to SEE a stack of open PRs at all times; feature
     commits that exist only on bleeding-edge are the failure this rule
     exists to prevent.
  3. Merge each PR branch back into `bleeding-edge` right after pushing it
     (merge, never rebase, same for open PR tips and `main` whenever they
     move), so it always carries the latest code regardless of merge
     status, and push it.
  4. **The working tree LIVES on `bleeding-edge`** (owner directive,
     2026-07-06). The owner tests the running app from this tree
     continuously, so any minute it sits on another branch is a minute his
     app is silently missing features. Branch work (slicing, PR fixes) is
     one tight excursion: switch, commit, push, merge back into
     `bleeding-edge`, return. Never develop, verify, or pause on a slice
     branch.
  5. Redeploy prod (`bun run deploy`) after every completed work round so
     the owner can test the live app immediately. Deploying to prod is
     STANDING-APPROVED (owner directive 2026-07-11: "you can always
     deploy to prod, you should be deploying prod frequently"); never
     treat a deploy as needing fresh authorization.
- **PRs are plain `git` + `gh`, honestly based** (the owner's BetterGit app
  is the only merge path: it reviews, squash-merges, restacks, retargets,
  and heals). A PR's GitHub base must be the branch it was actually built
  on: an independent slice branches from `origin/main` with base `main`, a
  dependent slice branches from its parent slice's branch with the base set
  to match. Never commit on `main`. Commit message = PR body (motivation,
  `## Changes`, `## Test plan`). 150-400 LOC per PR grouping related work.
  Fix review feedback in place on the PR branch, don't stack fixup PRs.
  After the owner merges (fast, out of order, often mid-slicing): hands
  off. Never rebuild, rebase, or force-push open slice branches; fetch,
  read the new state, fast-forward `main`, re-merge into `bleeding-edge`,
  and continue. Full rule: `docs/rules/better-git.mdc`.
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
