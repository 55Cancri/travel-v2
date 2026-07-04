# Baseline JS / Web API / React — exhaustive catalog (2023 → 2026)

Everything that reached **Baseline** from 2023 through early 2026, grouped by
task. The **Year** column is when it became Baseline *newly available*. The test
is unchanged: **Baseline → use it** (this app runs on WKWebView / JavaScriptCore,
so "works in Safari" == "works for us"). Non-Baseline lives in the last section.

`SKILL.md` holds the daily-use shortlist; this file is the long tail. When a
feature is niche (Wasm, workers, observability), it's here, not in `SKILL.md`.

## Arrays & iteration

| Feature | Year | Use for / replaces |
|---|---|---|
| `toSorted` / `toReversed` / `toSpliced` / `with` ("array by copy") | 2023 | immutable transforms, no `[...a].sort()` |
| `at(-1)` (also on strings, typed arrays) | 2023 | `a[a.length - 1]` |
| `findLast` / `findLastIndex` | 2023 | reverse-then-find |
| `Object.groupBy` / `Map.groupBy` ("array grouping") | 2024 | reduce-into-buckets |
| `Array.fromAsync(asyncIterable)` | 2024 | manual `for await` push loop |
| Iterator helpers: `map/filter/take/drop/flatMap/reduce/toArray/some/every/find` | 2025 | materializing arrays between lazy steps |
| `Iterator.concat(...iterables)` | 2026 | chaining iterables without spreading to arrays |

## Map & Set

| Feature | Year | Use for / replaces |
|---|---|---|
| Set methods: `union` / `intersection` / `difference` / `symmetricDifference` | 2024 | manual filter/merge loops |
| Set predicates: `isSubsetOf` / `isSupersetOf` / `isDisjointFrom` | 2024 | `.every(has)` loops |
| `Map.prototype.getOrInsert(key, default)` / `getOrInsertComputed(key, fn)` | 2026 | the `get(k) ?? (set(k, mk()), …)` dance |

Set ops accept any set-like (`{ size, has, keys }`), not only a real `Set`.

## Promises, async & concurrency

| Feature | Year | Use for / replaces |
|---|---|---|
| `Promise.withResolvers()` → `{ promise, resolve, reject }` | 2024 | `let resolve; new Promise(r => (resolve = r))` |
| `AbortSignal.timeout(ms)` | 2024 | `setTimeout` + manual `controller.abort()` |
| `AbortSignal.any([...signals])` | 2024 | wiring one controller to several signals |
| `Promise.try(fn)` | 2025 | `new Promise(res => res(fn()))` to trap sync throws |
| `Atomics.waitAsync()` / `Atomics.pause()` | 2025 | blocking waits / spin-loop hints on shared memory |

(`Promise.allSettled` / `Promise.any` predate this window but are Baseline.)

## Resource management

| Feature | Year | Use for / replaces |
|---|---|---|
| `using` / `await using` + `Symbol.dispose` / `Symbol.asyncDispose` | 2024–25 | `try/finally` cleanup; TS downlevels it, always safe |

## Strings, RegExp, numbers, binary

| Feature | Year | Use for / replaces |
|---|---|---|
| `String.isWellFormed()` / `toWellFormed()` | 2023 | manual lone-surrogate checks |
| `RegExp.escape(s)` | 2025 | hand-rolled `s.replace(/[.*+?…]/g, "\\$&")` |
| RegExp `v` flag (set notation + string props) | (pre) | nested char-class hacks |
| RegExp `d` flag → `match.indices` | (pre) | manual index arithmetic |
| `Float16Array` / `Math.f16round` | 2025 | `Uint16Array` + manual half-float packing |
| `Math.sumPrecise(iterable)` | 2026 | float-error-free summation vs `reduce((a,b)=>a+b)` |
| Resizable `ArrayBuffer` (`.resize()`, `maxByteLength`) | 2024 | allocate-and-copy to grow a buffer |
| Transferable / `ArrayBuffer.prototype.transfer()` | 2024 | structuredClone-with-transfer dance |
| `Uint8Array.fromBase64` / `fromHex`; `bytes.toBase64()` / `toHex()` | 2025 | `atob`/`btoa` + char-code loops |
| JSON import attributes (`import x from "./x.json" with { type: "json" }`) | 2025 | `fetch`-then-parse for static JSON |
| JSON source text access (`JSON.rawJSON` / `JSON.isRawJSON`) | 2025 | string-splicing to keep big-int / precise JSON |
| `Error("x", { cause })` / `AggregateError` | (pre) | bolting `.cause` on by hand |

## Objects, language & misc

| Feature | Year | Use for / replaces |
|---|---|---|
| `structuredClone(value)` | (pre) | `JSON.parse(JSON.stringify(...))` deep clone |
| `Object.hasOwn(obj, key)` | (pre) | `Object.prototype.hasOwnProperty.call(...)` |
| `crypto.randomUUID()` | (pre) | hand-rolled UUID from `Math.random` |
| `URL.canParse(str)` | 2023 | `try { new URL(str) } catch {}` validity probe |
| `URLPattern` | 2025 | regex route matchers (now Baseline — moved out of "avoid") |

## Intl (formatting without a library)

| Feature | Year | Use for |
|---|---|---|
| `Intl.Segmenter` | 2024 | grapheme/word/sentence splits (emoji-safe length, truncation) |
| `Intl.DurationFormat` | 2025 | "1 hr 5 min" style durations |
| `Intl.RelativeTimeFormat` | (pre) | "3 days ago" |
| `Intl.ListFormat` | (pre) | "a, b, and c" |
| `Intl.NumberFormat` (units, compact, `roundingMode`/`roundingPriority`) | (pre) | currency / file sizes / percentages |

## Temporal (date & time) — polyfilled

Temporal is **not Baseline** (undefined in WKWebView). We ship it via the
`temporal-polyfill` dependency, imported once at the Atlas entry
(`uis/atlas/index.tsx` → `import "temporal-polyfill/global"`). Types come from
`lib.esnext.temporal`, so new Atlas date code uses the global `Temporal` with no
import. This is the one deliberate non-Baseline opt-in.

```ts
const time = Temporal.Duration.from({ seconds }).round({ largestUnit: "hour" });
const due = Temporal.Now.plainDateISO().add({ days: 3 });
```

## DOM — elements & attributes

| Feature | Year | Use for / replaces |
|---|---|---|
| `<dialog>` + `showModal()` + `::backdrop` | (pre) | hand-built modal + focus trap + overlay |
| `dialog.requestClose()` | 2025 | programmatic close that still fires `cancel`/close flow |
| Popover API (`popover`, `popovertarget`) | 2025 (CSS side) | JS-toggled menus/tooltips |
| Invoker / command attributes (`command`, `commandfor`) | 2025 | click handlers that just open/close/toggle a target |
| `<details name="…">` exclusive accordion | 2024 | JS to close sibling panels |
| `inert` attribute | 2023 | manual `tabindex` / `aria-hidden` juggling |
| ARIA attribute reflection (`el.ariaLabel = …`) | 2023 | `setAttribute("aria-label", …)` |
| Form-associated custom elements (`ElementInternals`) | 2023 | hidden-input shims for custom controls |
| Declarative Shadow DOM (`<template shadowrootmode>`) | 2024 | JS-only shadow attach for SSR'd components |
| `loading="lazy"` on img/iframe | 2023 | IntersectionObserver lazy-load |
| `getHTML()` / `setHTMLUnsafe()` / `Document.parseHTMLUnsafe()` | 2024–25 | `innerHTML` round-trips (declarative-shadow aware) |

## DOM — APIs & events

| Feature | Year | Use for / replaces |
|---|---|---|
| `el.checkVisibility()` | 2024 | `getComputedStyle` visibility probing |
| `el.toggleAttribute(name, force)` | (pre) | get-then-set attribute |
| `input.showPicker()` | (pre) | faking native date/color pickers |
| `scrollend` event | 2025 | debounced `scroll` to detect scroll finish |
| `document.caretPositionFromPoint()` | 2025 | non-standard `caretRangeFromPoint` |
| Selection composed ranges (`getComposedRanges()`) | 2025 | selection logic that ignored shadow boundaries |
| `ToggleEvent.source` (popover/details) | 2026 | tracking which invoker opened a popover |
| Async Clipboard (`navigator.clipboard.read/write`) | 2024 | `execCommand("copy")` |
| `ClipboardItem.supports(type)` | 2025 | try/catch probing clipboard MIME support |
| Constructed stylesheets (`adoptedStyleSheets`) | 2023 | injecting `<style>` per component |
| Imperative slot assignment (`slot.assign(...)`) | 2023 | name-attribute slot wiring |

## Canvas & graphics

| Feature | Year | Notes |
|---|---|---|
| `ctx.reset()` | 2023 | clear + reset all canvas state |
| `ctx.roundRect()` | 2023 | manual arc/line rounded rects |
| `createConicGradient()` | 2023 | conic gradients on canvas |
| `OffscreenCanvas` + worker rendering | 2023 | main-thread canvas work |
| `createImageBitmap()` | 2023 | decode images off-thread |
| `willReadFrequently` ctx hint | 2024 | faster repeated `getImageData` |
| `requestVideoFrameCallback()` | 2024 | per-video-frame work vs rAF guessing |
| WebGL/WebGL2 color management | 2024 | wide-gamut WebGL output |

## Workers, modules & storage

| Feature | Year | Notes |
|---|---|---|
| JS modules in workers (`new Worker(url, { type: "module" })`) | 2023 | `import` inside workers |
| JS modules in shared & service workers | 2026 | same for shared/service workers |
| Shared workers | 2026 | one worker shared across tabs |
| `requestAnimationFrame()` in workers | 2023 | timed work off main thread |
| Origin Private File System (OPFS) | 2023 | large local file storage |
| Storage Manager (`navigator.storage.estimate/persist`) | 2023 | quota inspection |
| Notifications / push from service workers | 2023 | background notifications |

## Network, streams & compression

| Feature | Year | Notes |
|---|---|---|
| HTTP/3 | 2024 | transport (server-side concern, listed for completeness) |
| Compression Streams (`CompressionStream` gzip/deflate) | 2023 | hand-rolled gzip in JS |
| Zstandard compression (`DecompressionStream("zstd")`, `Accept-Encoding`) | 2026 | smaller payload decompression |
| Readable byte streams (BYOB readers) | 2026 | zero-copy chunked reads |
| WebTransport | 2026 | low-latency datagrams/streams over HTTP/3 |
| Fetch priority (`fetch(url, { priority })`, `fetchpriority` attr) | 2024 | hinting resource importance |

## Observability, performance & security

| Feature | Year | Notes |
|---|---|---|
| Event Timing API / `event` PerformanceObserver | 2025 | INP / input-latency measurement |
| Largest Contentful Paint API | 2025 | LCP measurement |
| Server Timing (`PerformanceServerTiming`) | 2023 | surfacing backend timings |
| Reporting API (`ReportingObserver`) | 2026 | catching deprecations / interventions |
| CSP violation reports (`SecurityPolicyViolationEvent`, report-to) | 2026 | logging CSP breaks |
| Trusted Types | 2026 | DOM-XSS-safe sinks (`innerHTML` policies) |

## WebAssembly (listed for completeness)

| Feature | Year |
|---|---|
| Garbage collection (Wasm GC) | 2024 |
| Tail call optimization | 2024 |
| Typed function references | 2024 |
| Extended constant expressions | 2024 |
| Branch hinting | 2026 |
| Fixed-width SIMD | 2023 |

## React 19

The React Compiler is **on** — never hand-write `useMemo` / `useCallback` /
`React.memo` (see `typescript-style`).

| Use | Instead of |
|---|---|
| `ref` as a plain prop | `forwardRef` for new components |
| `use(promise)` / `use(context)` | conditional hook gymnastics |
| `useActionState` / `useFormStatus` / `useOptimistic` | manual `isPending` + rollback booleans |
| `<title>`/`<meta>`/`<link>` rendered anywhere (hoist to `<head>`) | head-management libs |
| `<Context value={…}>` directly | `<Context.Provider>` |
| document metadata + async script dedupe | manual head juggling |

## NOT Baseline — do not ship as the only path

Guard behind `@supports` / feature-detect for progressive enhancement only:

- **`scheduler.yield()` / `scheduler.postTask()`** — Safari missing.
- **Customized built-in elements (`is="…"`)** — Safari missing; use autonomous custom elements.
- **Cross-document View Transitions** (same-document VT *is* Baseline 2025, but we use Framer Motion anyway).
- **WebGPU** — not across all engines.
- **`navigator.scheduling.isInputPending()`** — Chromium-only.

Re-check before adding: Baseline status moves. When in doubt, confirm on the MDN
page's Baseline banner or the web.dev Baseline year pages.
