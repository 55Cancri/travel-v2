---
name: baseline-css
description: >-
  Catalog of Baseline CSS features (:has, nesting, subgrid, container queries,
  text-wrap balance/pretty, color-mix, light-dark, relative color, @property,
  dynamic viewport units) with the older pattern each replaces, a short list of
  NOT-yet-Baseline features to avoid, and concrete tips for a richer color
  system in Panda. Use when writing or auditing CSS / Panda styles.
---

# Baseline CSS

This repo styles through **Panda CSS** (tokens + style props; see
`panda-style-reuse`). Express these the Panda way (a prop, a condition, or a
`css={{}}` residue). **The only test: is it Baseline?** ✅ Baseline → use it
(this app ships on WKWebView, so "works in Safari" == "works for us"). 🚫 not
Baseline → don't ship it as the only path.

## ✅ Baseline: use freely

| Feature | Replaces |
|---|---|
| `:has(...)` parent/sibling selector | JS toggling modifier classes |
| Native nesting `&` | Sass / `cx`-composed selectors |
| `:is()` / `:where()` | long comma selector lists |
| `:focus-visible`, `:user-valid` / `:user-invalid` | `:focus` + JS, validity classes |
| Subgrid (`grid-template-*: subgrid`) | duplicating track sizes per child |
| Container queries `@container` + `cqi`/`cqw` | viewport `@media` for component width |
| Logical props (`inline`/`block`, `inset`) ; `aspect-ratio` ; flex `gap` | physical sides, padding-box ratios, margin hacks |
| `text-wrap: balance` (headings) / `pretty` (body) | manual `<br>` / orphan JS |
| `color-mix(in oklch, a, b)` | preprocessor color math |
| `light-dark(a, b)` | duplicated `@media (prefers-color-scheme)` blocks |
| Relative color `oklch(from var(--c) l c h / .5)` | hand-computed tint/shade tokens |
| Wide-gamut `oklch()` / `oklab()` / `color()` | sRGB hex only |
| `contrast-color(c)` auto black/white text on a fill (Baseline Newly Available 2026-04: Safari 26, Chrome 147. Enhancement-only until that's our floor) | hand-picked `on-*` tokens |
| `@property` (typed, animatable custom props) | non-animatable raw `--vars` |
| `@scope` (scoped + donut styles) | BEM-ish prefixing to bound a block |
| Popover / Invoker (`popover`, `command`/`commandfor`) | JS show/hide + outside-click + ESC |
| Dynamic viewport `dvh` / `svh` / `lvh` | `vh` + JS for mobile chrome |
| `clamp()` / `min()` / `max()` | media-query size steps |
| `accent-color` ; `::backdrop` | custom-painted controls / overlay divs |

We already lean on container queries and `:has()`. Use **subgrid**,
**container queries**, and **`text-wrap`** more: they're first choices, not
exotic.

## 🚫 NOT Baseline: avoid (or `@supports`-guard for enhancement only)

Anchor positioning (`anchor()`, `position-anchor`, `@position-try`),
`field-sizing: content`, scroll-driven animations (`animation-timeline`,
`scroll()`, `view()`), `@function`, cross-document view transitions. For
motion, keep using **Framer Motion** (see the motion rules), not
scroll-driven CSS.

Two sanctioned non-Baseline enhancements (both degrade by being ignored):

- `corner-shape: squircle` / `superellipse()` (Chromium 139+ only, 2026-07):
  Safari/Firefox drop the property at parse time and render the normal
  `border-radius`, so subtle squircles ship safely with zero fallback code.
  Never reach for clip-path squircle polyfills (they kill borders and
  per-element rendering).
- `text-box-trim` / `text-box-edge: cap alphabetic` (Chrome 133+, Safari
  18.2+; Firefox missing keeps it off Baseline): BOTH our shipping engines
  (WKWebView + Chromium) have it, so cap-height trimming for lh-rhythm text
  is fully usable here; non-target browsers just show the old leading.

## Leveling up color in Panda

Today the palette is the default 50→900 notches picked by hand. Three Baseline
moves make the system richer without abandoning semantic tokens:

1. **Derive shades from one base instead of hand-picking 11 notches.** Define a
   base in `oklch` and generate tints/shades with `color-mix`, so the ramp is
   perceptually even and edits stay in one place:

   ```ts
   // panda.config token values
   accent:      "oklch(62% 0.19 256)",
   "accent.hover":  "color-mix(in oklch, {colors.accent}, black 12%)",
   "accent.subtle": "color-mix(in oklch, {colors.accent}, white 85%)",
   ```

2. **State variants via relative color**: bump lightness off the base token
   rather than minting a new hex:

   ```ts
   "surface-focus": "oklch(from {colors.surface-page} calc(l - 0.04) c h)",
   ```

3. **Halve dark-mode duplication with `light-dark()`** in the semantic token
   layer, so call sites stay theme-agnostic:

   ```ts
   "text-primary": "light-dark(oklch(20% 0 0), oklch(96% 0 0))",
   ```

Keep call sites on semantic tokens (`surface-*`, `text-*`, `accent`); do the
color math in the **token definitions**, never inline at the component. `oklch`
is the right space because equal lightness steps look equal to the eye (unlike
hsl), which is what makes a generated ramp read as a coherent scale.

## Full catalog

This is the daily-use shortlist. For the **exhaustive** 2023→2026 Baseline CSS
enumeration (typography, scoping, sizing units, the long tail), see
[reference.md](reference.md).

## Verify a rule is present

Panda only emits CSS for literals it reads at build time. To confirm a rule
shipped, grep `document.styleSheets` for the literal (see `panda-style-reuse`
"How to verify a rule is actually present"). Empty result = Panda never saw it.
