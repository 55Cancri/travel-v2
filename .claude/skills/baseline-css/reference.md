# Baseline CSS — exhaustive catalog (2023 → 2026)

Every CSS / HTML-styling feature that reached **Baseline** from 2023 through
early 2026, grouped by task. **Year** = when it became Baseline *newly
available*. Express each the Panda way (a style prop, a condition, or a `css={{}}`
residue — see `panda-style-reuse`). `SKILL.md` holds the daily-use shortlist;
this file is the long tail.

The test is unchanged: **Baseline → use it** (ships on WKWebView, so "works in
Safari" == "works for us"). Non-Baseline lives in the last section.

## Selectors, scoping & nesting

| Feature | Year | Use for / replaces |
|---|---|---|
| `:has(...)` relational selector | 2023 | JS toggling modifier classes off descendants |
| Native nesting (`&`) | 2023 | Sass / `cx`-composed selectors |
| `:is()` / `:where()` | (pre) | long comma selector lists (`:where` = 0 specificity) |
| `:nth-child(... of S)` | 2023 | filtering then counting in JS |
| `:dir(ltr/rtl)` | 2023 | direction-attribute selectors |
| `:user-valid` / `:user-invalid` | 2023 | `:valid`/`:invalid` firing before interaction |
| `:state(...)` (custom-element internals) | 2024 | class flags on custom elements |
| `@scope` (scoped styles + donut scoping) | 2025 | BEM-ish prefixing to bound a block (now Baseline) |
| `:open` (dialog/details/select popups) | 2026 | `[open]` attr selectors |

## Layout

| Feature | Year | Use for / replaces |
|---|---|---|
| Container queries (`@container`, `cqi`/`cqw`/`cqb`) | 2023 | viewport `@media` for component width |
| Container **style** queries (`@container style(--x: y)`) | 2026 | prop-driven variants without extra classes |
| Subgrid (`grid-template-*: subgrid`) | 2023 | duplicating track sizes per child |
| Two-value `display` (`display: inline flex`) | 2023 | single-keyword display guessing |
| `align-content` in block & table layouts | 2024 | flex/grid wrappers just to center a block |
| `align-self`/`justify-self`/`place-self` on abspos | 2025 | margin-auto centering of absolute elements |
| `transform-box` | 2024 | wrong transform origin on SVG/box |
| Anchor of overflow / `overflow: clip` + `overflow-clip-margin` | 2023 | JS clamping |

## Typography & text

| Feature | Year | Use for / replaces |
|---|---|---|
| `text-wrap: balance` (headings) | 2024 | manual `<br>` in titles |
| `text-wrap: pretty` (body) | 2024 | orphan-fixing JS |
| `text-wrap` shorthand / `white-space-collapse` | 2024 | `white-space` combos |
| Hyphenation + `hyphenate-character` | 2023 | manual `&shy;` |
| `font-size-adjust` | 2024 | fallback-font size drift |
| `font-synthesis-weight/style/small-caps` | 2023 | accidental faux-bold/italic |
| `font-variant-alternates` | 2023 | OpenType alternates via font hacks |
| `text-indent: each-line` / `hanging` | 2026 | first-line JS indent hacks |
| `text-decoration-skip-ink: all` | 2026 | underline clutter under descenders |
| Spelling/grammar text decorations | 2025 | styling native squiggles |
| `baseline-shift` | 2026 | sub/superscript via `vertical-align` hacks |
| `font-family: math` + MathML | 2023/26 | image-rendered formulas |
| Custom highlights (`::highlight()` + Highlight API) | 2026 | wrapper `<span>`s for find/annotate |
| `ruby-align` / `ruby-position` | 2024 | manual ruby positioning |

## Color

| Feature | Year | Use for / replaces |
|---|---|---|
| `color-mix(in oklch, a, b)` | 2023 | preprocessor color math |
| Relative color `oklch(from var(--c) l c h / a)` | 2024 | hand-computed tint/shade tokens |
| `oklch()` / `oklab()` / `lab()` / `lch()` | 2023 | sRGB hex only |
| `color()` (display-p3 etc.) | 2023 | clipped wide-gamut color |
| `light-dark(a, b)` | 2024 | duplicated `prefers-color-scheme` blocks |
| `contrast-color(c)` | 2026 | manual black/white-on-bg picking |
| Gradient interpolation (`in oklch`, hue interp) | 2024 | banded sRGB gradients |
| `color-gamut` / `dynamic-range` media queries | 2023 | shipping only sRGB |
| `accent-color` | (pre) | repainting checkboxes/radios |
| `print-color-adjust` | 2025 | print backgrounds dropping out |

## Custom properties, functions & animation

| Feature | Year | Use for / replaces |
|---|---|---|
| `@property` (typed, animatable custom props) | 2024 | non-animatable raw `--vars` |
| `round()` / `mod()` / `rem()` | 2024 | JS math for layout values |
| `abs()` / `sign()` | 2025 | sign/abs via `max()` tricks |
| Trig (`sin/cos/tan/atan2…`) / exponential (`pow/sqrt/log…`) | 2023 | precomputed magic numbers |
| `calc()` keywords (`infinity`, `pi`, `e`, `NaN`) | 2024 | hardcoded large/irrational values |
| `linear()` easing | 2023 | approximated cubic-beziers for bounces |
| `animation-composition` | 2023 | overwriting transforms instead of adding |
| `@starting-style` | 2024 | JS to animate first paint / `display:none`→shown |
| `transition-behavior: allow-discrete` | 2024 | JS to transition `display`/`visibility` |
| View transitions (same-document) + `view-transition-class` + `::view-transition-*` | 2025 | crossfade/morph JS (we use Framer Motion) |
| `:active-view-transition` | 2026 | styling during an active transition |
| `shape()` for `clip-path`/`offset-path` | 2026 | `path()` string math |
| `rect()` / `xywh()` clip shapes | 2024 | `inset()`/`polygon()` for rectangles |
| Individual transforms (`translate`/`rotate`/`scale`) | 2023 | packing into one `transform` |

## Sizing, units & viewport

| Feature | Year | Use for / replaces |
|---|---|---|
| `clamp()` / `min()` / `max()` | (pre) | media-query size steps |
| `dvh` / `svh` / `lvh` (dynamic viewport) | (pre) | `vh` + JS for mobile chrome |
| `lh` / `rlh` units | 2023 | px multiples of line-height |
| `cap` unit | 2023 | cap-height alignment via magic px |
| `rcap` / `rch` / `rex` / `ric` (root font-relative) | 2026 | recomputing `ch`/`ex` per element |
| `aspect-ratio` | (pre) | padding-box ratio hacks |
| `contain-intrinsic-size` + `content-visibility` | 2023/25 | manual offscreen virtualization sizing |
| `zoom` | 2024 | transform-scale layout reflow hacks |

## Forms, scrolling & misc

| Feature | Year | Use for / replaces |
|---|---|---|
| Popover (`popover` attr, `::backdrop`) | 2025 | JS show/hide + outside-click + ESC |
| Invoker commands (`command`/`commandfor` on `<button>`) | 2025 | click handlers wiring buttons to popovers/dialogs |
| `::details-content` | 2025 | wrapper div to animate disclosure body |
| Mutually exclusive `<details name>` | 2024 | JS accordion close-siblings |
| `scrollbar-gutter` / `scrollbar-width` / `scrollbar-color` | 2024/25 | layout shift on scrollbar appear; custom scrollbar JS |
| `::target-text` / scroll-to-text-fragment | 2024 | JS highlight of linked text |
| `@starting-style` + `transition-behavior` (combo) | 2024 | enter/exit animations without a lib |
| `contenteditable="plaintext-only"` | 2025 | stripping rich paste by hand |
| `field-sizing` — **NOT** baseline yet (see below) | — | auto-growing inputs |
| Vertical form controls (`writing-mode` on controls) | 2024 | rotated wrappers around inputs |
| `backdrop-filter` | 2024 | layered blur element hacks |
| `image-rendering: crisp-edges` | 2026 | blurry upscaled pixel art |
| `image-set()` / responsive image preloading | 2023 | `srcset`-in-CSS hacks |
| `paint-order` | 2024 | stroke-over-fill via duplicate text |
| Screen Wake Lock | 2025 | video hacks to keep screen on |

## NOT Baseline — avoid (or `@supports`-guard for enhancement only)

- **Anchor positioning** (`anchor()`, `position-anchor`, `@position-try`) — Safari/FF missing.
- **`field-sizing: content`** — Safari missing.
- **Scroll-driven animations** (`animation-timeline`, `scroll()`, `view()`) — use Framer Motion.
- **`text-box-trim` / `text-box-edge`** — Firefox missing.
- **Cross-document view transitions** — same-document is Baseline; cross-document isn't.
- **`@function` / custom CSS functions** — too new, not across engines.

Re-check before adding: Baseline status moves. Confirm on the MDN Baseline
banner or web.dev Baseline year pages.

## Leveling up color in Panda

(Full tips live in `SKILL.md`.) The short version: define a base in `oklch`,
derive tints/shades with `color-mix` and relative color in the **token
definitions**, halve dark-mode with `light-dark()`, and keep call sites on
semantic tokens.
