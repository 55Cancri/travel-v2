---
name: baseline-js
description: >-
  Comprehensive catalog of Baseline JavaScript, TypeScript, DOM/HTML, and React
  19 APIs (2023-2026), with the older pattern each one replaces; full long-tail
  enumeration in reference.md. Use when writing or auditing JS/TS/React to reach
  for a modern built-in (Map.getOrInsert, Set methods, toSorted, Object.groupBy,
  Promise.withResolvers/try, iterator helpers, Temporal, using/dispose,
  structuredClone, crypto.randomUUID, URLPattern, dialog/popover/invoker, React
  19 hooks) instead of a hand-rolled equivalent.
---

# Baseline JavaScript / DOM / React

**The only test: is it Baseline?** If yes, use it — "newly" and "widely"
available both count, recency is irrelevant. If it isn't Baseline (a
Chromium-only or Safari-missing feature), don't ship it as the only path. This
app runs in a Tauri **WKWebView (JavaScriptCore)**, so *"works in Safari" ==
"works for us"*. We target `lib: ["ESNext"]`, so everything here typechecks
under `tsgo`; Baseline is the runtime gate.

Each table: the modern form on the left, the pattern it replaces on the right.

## Arrays & iteration

| Use | Instead of |
|---|---|
| `arr.toSorted(cmp)` / `toReversed()` / `toSpliced(i,n,…)` / `with(i,v)` | copy-then-mutate (`[...arr].sort()`) |
| `arr.at(-1)` | `arr[arr.length - 1]` |
| `arr.findLast(fn)` / `arr.findLastIndex(fn)` | reverse-then-find |
| `arr.flat()` / `arr.flatMap(fn)` | nested `concat` / `reduce` |
| `Array.fromAsync(asyncIterable)` | manual `for await` push loop |
| `Object.groupBy(items, fn)` / `Map.groupBy(items, fn)` | reduce-into-buckets |
| Iterator helpers: `it.map/filter/take/drop/flatMap/reduce/toArray` | materializing arrays between steps |

```ts
const ranked = rows.toSorted((a, b) => a.order - b.order);
const byKind = Object.groupBy(items, (it) => it.kind);
const firstThree = map.values().filter((v) => v.active).take(3).toArray();
```

## Map & Set

| Use | Instead of |
|---|---|
| `map.getOrInsert(key, [])` | `map.get(key) ?? (map.set(key, []), …)` |
| `map.getOrInsertComputed(key, () => mk())` | same, lazy default |
| `a.union(b)` / `a.intersection(b)` / `a.difference(b)` / `a.symmetricDifference(b)` | manual filter/merge loops |
| `a.isSubsetOf(b)` / `a.isSupersetOf(b)` / `a.isDisjointFrom(b)` | `.every(has)` loops |

```ts
const childrenByParentId = new Map<string | null, Item[]>();
for (const item of items) childrenByParentId.getOrInsert(item.parentId, []).push(item);
```

`Set` ops accept any set-like (`{ size, has, keys }`), not only a real `Set`.

## Promises & async

| Use | Instead of |
|---|---|
| `Promise.withResolvers()` → `{ promise, resolve, reject }` | `let resolve; new Promise(r => (resolve = r))` |
| `Promise.try(fn)` | `new Promise(res => res(fn()))` to catch sync throws |
| `Promise.allSettled` / `Promise.any` | manual settle tracking |
| `AbortSignal.timeout(ms)` / `AbortSignal.any([…])` | `setTimeout` + hand-wired controllers |

## Resource cleanup (`using`)

`using` / `await using` + `Symbol.dispose` / `Symbol.asyncDispose` auto-dispose
at scope exit. TS downlevels it to `try/finally`, so it is always safe here.

```ts
{
  using file = openFile(path); // file[Symbol.dispose]() runs at block end
  read(file);
} // disposed here, even on throw
```

## Strings, RegExp, numbers, binary

| Use | Instead of |
|---|---|
| `str.at(-1)` | `str[str.length - 1]` |
| `str.replaceAll(a, b)` | `str.replace(/a/g, b)` |
| `str.isWellFormed()` / `str.toWellFormed()` | manual surrogate checks |
| `RegExp.escape(s)` | hand-rolled `s.replace(/[.*+?…]/g, "\\$&")` |
| RegExp `v` flag (`/…/v`) set notation; `d` flag → `match.indices` | nested char-class hacks / manual index math |
| `Error("x", { cause })` ; `AggregateError` | attaching `.cause` by hand |
| `Float16Array` / `Math.f16round` | `Uint16Array` + manual half-float packing |
| Resizable `ArrayBuffer` (`.resize()`, `.transfer()`) | allocate-and-copy to grow a buffer |
| `Uint8Array.fromBase64/fromHex` ; `bytes.toBase64()/toHex()` | `atob`/`btoa` + char-code loops |

## Objects & cloning

| Use | Instead of |
|---|---|
| `structuredClone(value)` | `JSON.parse(JSON.stringify(...))` deep clone |
| `Object.hasOwn(obj, key)` | `Object.prototype.hasOwnProperty.call(...)` |
| `crypto.randomUUID()` | hand-rolled UUID from `Math.random` |

## Intl (formatting without libraries)

| Use | For |
|---|---|
| `Intl.Segmenter` | grapheme/word/sentence splitting (emoji-safe length, truncation) |
| `Intl.DurationFormat` | "1 hr 5 min" style durations |
| `Intl.RelativeTimeFormat` | "3 days ago" |
| `Intl.ListFormat` | "a, b, and c" |
| `Intl.NumberFormat` (units, compact, `roundingMode`) | currency / file sizes / percentages |

## Temporal (date & time) — polyfilled, use for all new date code

Prefer `Temporal` over `new Date` for **new** date/time code: immutable, explicit
time zones, sane arithmetic. Types come from `lib.esnext.temporal`.

`Temporal` is **not Baseline** — `undefined` in WKWebView until polyfilled — so
the `temporal-polyfill` dependency is installed and its global build is imported
once at the Atlas entry (`uis/atlas/index.tsx`: `import "temporal-polyfill/global"`).
Because that side-effect runs first, new Atlas date code just uses the global
`Temporal` with **no import**. This is the one deliberate non-Baseline opt-in.

```ts
// no import needed — the polyfill installed the global at the Atlas entry
const now = Temporal.Now.zonedDateTimeISO();
const due = now.add({ days: 3 }).toPlainDate();
const length = Temporal.Duration.from({ seconds }).round({ largestUnit: "hour" });
```

A real use lives in `uis/atlas/format-track-time.ts` (seconds → "m:ss"/"h:mm:ss").

## DOM / HTML

| Use | Instead of |
|---|---|
| `<dialog>` + `el.showModal()` + `::backdrop` | hand-built modal + focus trap + overlay |
| Popover API: `popover` attr + `popovertarget` | JS-toggled menus/tooltips |
| Invoker commands: `<button command commandfor>` | click handlers that just open/close/toggle a target |
| `dialog.requestClose()` | manual close that still runs the `cancel`/close flow |
| `<details name="…">` exclusive accordion | JS to close sibling panels |
| `inert` attribute | manual `tabindex` / `aria-hidden` juggling |
| `el.checkVisibility()` | `getComputedStyle` visibility probing |
| `el.toggleAttribute(name, force)` | get-then-set attribute |
| `input.showPicker()` | faking native date/color pickers |
| `loading="lazy"` on img/iframe | IntersectionObserver lazy-load |

## React 19

The React Compiler is **on** — never hand-write `useMemo` / `useCallback` /
`React.memo` (see `typescript-style`). Other React 19 wins:

- `ref` is a plain prop — **no `forwardRef`** for new components.
- `use(promise)` / `use(context)` — read a promise or context conditionally.
- Actions: `useActionState`, `useFormStatus`, `useOptimistic` instead of manual
  `isPending` booleans.
- `<title>` / `<meta>` / `<link>` render anywhere and hoist to `<head>`.
- `<Context>` is the provider directly (`<Ctx value={…}>`, no `.Provider`).

## NOT Baseline — do not ship as the only path

Skip these (Safari/Firefox missing) or guard behind `@supports` / feature-detect
for progressive enhancement only: customized built-in elements (`is="…"`),
`scheduler.yield`/`postTask`, cross-document View Transitions, WebGPU. (Same
spirit applies to the CSS list in `baseline-css`.) The exception list is
deliberately short — Temporal above is the only non-Baseline thing we opt into.

## Full catalog

This is the daily-use shortlist. For the **exhaustive** 2023→2026 Baseline
enumeration (workers, streams, Wasm, observability, canvas, the long tail), see
[reference.md](reference.md).
