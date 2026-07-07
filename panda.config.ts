import { defineConfig } from "@pandacss/dev";

// Rhythm: every spacing/size/radius token is a multiple of the line height, so
// vertical rhythm holds everywhere (html line-height 1.5 → 1lh = 1.5rem).
const rhythm = {
  xs: { value: "0.25lh" },
  sm: { value: "0.5lh" },
  md: { value: "1lh" },
  lg: { value: "1.5lh" },
  xl: { value: "2lh" },
  "2xl": { value: "2.5lh" },
} as const;

const rhythmValues = Object.fromEntries(
  Object.entries(rhythm).map(([key, token]) => [key, token.value]),
) as Record<keyof typeof rhythm, string>;

const colAlignments = new Set(["start", "center", "end"]);
const rowJustifications = new Set(["start", "end", "between", "center"]);
const borderStyles = new Set([
  "none",
  "hidden",
  "dotted",
  "dashed",
  "solid",
  "double",
]);

export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{js,jsx,ts,tsx}"],
  exclude: [],
  jsxFramework: "react",

  conditions: {
    extend: {
      dark: "html[data-theme=dark] &",
      notFocusWithin: "&:not(:focus-within)",
      // Button sets data-pressed from react-aria's press tracking, which
      // also covers keyboard Space/Enter and cancels on drag-off, so styles
      // ride this instead of :active.
      pressed: "&[data-pressed]",
      // Hover styling never applies to a disabled control. data-disabled
      // covers Button as="a", where the disabled attribute does not exist.
      hover: "&:hover:not(:disabled):not([data-disabled])",
    },
  },

  globalCss: {
    ":root": { colorScheme: "light" },
    "html[data-theme=light]": { colorScheme: "light" },
    "html[data-theme=dark]": {
      colorScheme: "dark",
      // No ring, no shadow in dark — the color IS the pin; colors soften a
      // step so they don't read neon against the night map.
      "--pin-dot-shadow": "none",
      "--pin-activity": "#C97355",
      "--pin-food": "#BC6386",
      "--pin-lodging": "#3B9186",
      "--pin-transport": "#6B93BF",
      "--pin-note": "#98928B",
    },
    html: {
      fontSize: "100%",
      lineHeight: "1.5",
      fontSynthesis: "none",
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
      background: "surface-page",
      // Pin colors — themed via CSS vars so map markers (plain DOM elements)
      // retheme without a JS pass. Light mode keeps a warm ring + soft drop
      // shadow (grounds dots on the pale map); dark mode gets bare color.
      "--pin-dot-shadow":
        "0 0 0 1.5px rgba(62, 48, 40, 0.5), 0 1px 3px rgba(0, 0, 0, 0.3)",
      "--pin-activity": "#C05B3F",
      "--pin-food": "#B4436C",
      "--pin-lodging": "#0F766E",
      "--pin-transport": "#3A6EA5",
      "--pin-note": "#78716C",
    },
    // Map popup theming lives in src/styles.css: maplibre's stylesheet is
    // unlayered, so layered globalCss rules here would lose the cascade.
    body: {
      minHeight: "100vh",
      margin: 0,
      color: "text-primary",
      background: "surface-page",
      fontFamily:
        '"Instrument Sans Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      // The variable font reads thin at 400; 450 is the intended body weight.
      fontWeight: "450",
    },
  },

  theme: {
    semanticTokens: {
      colors: {
        // Warm paper surfaces (stone scale, not cold gray) — a travel journal,
        // not a dashboard.
        "surface-page": {
          value: { base: "#FAF8F4", _dark: "{colors.stone.900}" },
        },
        "surface-panel": {
          value: { base: "{colors.white}", _dark: "{colors.stone.800}" },
        },
        "surface-muted": {
          value: { base: "{colors.stone.100}", _dark: "{colors.stone.700}" },
        },
        // Hover fill for small round controls — darker than surface-muted in
        // dark mode so the circle doesn't flash bright behind icons.
        "surface-hover": {
          value: { base: "{colors.stone.100}", _dark: "{colors.stone.800}" },
        },
        "surface-focus": {
          value: { base: "{colors.stone.200}", _dark: "{colors.stone.800}" },
        },
        "surface-strong": {
          value: { base: "{colors.stone.900}", _dark: "{colors.stone.100}" },
        },
        "text-primary": {
          value: { base: "{colors.stone.900}", _dark: "{colors.stone.100}" },
        },
        "text-muted": {
          value: { base: "{colors.stone.500}", _dark: "{colors.stone.400}" },
        },
        "text-on-strong": {
          value: { base: "{colors.stone.100}", _dark: "{colors.stone.900}" },
        },
        "border-strong": {
          value: { base: "{colors.stone.300}", _dark: "{colors.stone.600}" },
        },
        "border-muted": {
          value: { base: "{colors.stone.200}", _dark: "{colors.stone.700}" },
        },
        // Terracotta accent — sun-baked rooftops.
        accent: {
          value: { base: "#C05B3F", _dark: "#E08D6D" },
        },
        "accent-strong": {
          value: { base: "#A34832", _dark: "#EDA282" },
        },
        "accent-soft": {
          value: { base: "#F6E7E0", _dark: "#4A2E24" },
        },
        "text-on-accent": {
          value: { base: "{colors.white}", _dark: "{colors.stone.900}" },
        },
        danger: {
          value: { base: "{colors.red.600}", _dark: "{colors.red.400}" },
        },
        // Focus = blue, always (terracotta is content accent, not focus):
        // matches the ring used across the sibling apps.
        "focus-ring": {
          value: { base: "{colors.blue.500}", _dark: "{colors.blue.400}" },
        },
        "focus-halo": {
          value: {
            base: "color-mix(in srgb, {colors.blue.500} 25%, transparent)",
            _dark: "color-mix(in srgb, {colors.blue.400} 40%, transparent)",
          },
        },
        "text-on-danger": {
          value: { base: "{colors.white}", _dark: "{colors.stone.900}" },
        },
      },
    },
    extend: {
      tokens: {
        spacing: rhythm,
        sizes: rhythm,
        radii: rhythm,
        fontSizes: {
          xs: { value: "0.75rem" },
          sm: { value: "0.875rem" },
          md: { value: "1rem" },
          lg: { value: "1.125rem" },
          xl: { value: "1.25rem" },
          "2xl": { value: "1.5rem" },
          "3xl": { value: "1.875rem" },
        },
      },
    },
  },

  utilities: {
    extend: {
      flow: {
        values: "spacing",
        className: "flow",
        transform(value: string) {
          return { "& > * + *": { marginBlockStart: value } };
        },
      },
      grid: {
        className: "grid",
        values: { type: "boolean" },
        transform(value) {
          return value ? { display: "grid" } : {};
        },
      },
      flex: {
        className: "flex",
        values: { type: "boolean" },
        transform(value) {
          return value ? { display: "flex" } : {};
        },
      },
      cols: {
        className: "cols",
        values: { type: "string" },
        transform(value) {
          if (typeof value !== "string") return {};
          const { alignValue, columnGap, gridTemplate } = parseColsValue(value);
          return {
            display: "grid",
            ...(alignValue && {
              alignContent: alignValue,
              alignItems: alignValue,
            }),
            ...(gridTemplate && { gridTemplateColumns: gridTemplate }),
            ...(columnGap && { columnGap }),
          };
        },
      },
      rows: {
        className: "rows",
        values: { type: "string" },
        transform(value) {
          if (typeof value !== "string") return {};
          const { gridTemplate, justifyContent, justifyItems, rowGap } =
            parseRowsValue(value);
          return {
            display: "grid",
            ...(justifyContent && { justifyContent }),
            ...(justifyItems && { justifyItems }),
            ...(gridTemplate && { gridTemplateRows: gridTemplate }),
            ...(rowGap && { rowGap }),
          };
        },
      },
      size: {
        // Numbers and lengths both: size={24} for icon boxes, size="1.5rlh"
        // for rhythm-pinned hit targets.
        values: { type: "number | string" },
        transform(value: number | string) {
          return { width: value, height: value };
        },
      },
      debug: {
        className: "debug",
        values: { type: "boolean | string" },
        transform(value) {
          if (!value) return {};
          return {
            border:
              typeof value === "string"
                ? resolveDebugBorder(value)
                : "1px solid red",
            outline: "none",
          };
        },
      },
    },
  },

  outdir: "styled-system",
});

const resolveRhythmValue = (value: string) =>
  rhythmValues[value as keyof typeof rhythm] ?? value;

const resolveTrackValue = (value: string) => {
  if (/^\d+$/.test(value)) return `${value}fr`;
  if (value === "m" || value === "mx") return "max-content";
  return resolveRhythmValue(value);
};

const resolveGapValue = (value: string) => {
  const rhythmValue = resolveRhythmValue(value);
  if (rhythmValue !== value) return rhythmValue;
  if (/^\d+$/.test(value)) return `${value}px`;
  return value;
};

const splitTemplateValue = (value: string) => {
  const [templatePart = "", gapPart = ""] = value
    .split("/")
    .map((part) => part.trim());
  return { templatePart, gapPart };
};

const parseColsValue = (value: string) => {
  const { templatePart, gapPart } = splitTemplateValue(value);
  const templateWords = templatePart.split(/\s+/).filter(Boolean);
  const firstWord = templateWords[0];
  const alignValue =
    firstWord && colAlignments.has(firstWord) ? firstWord : undefined;
  const rawTemplate = alignValue ? templateWords.slice(1) : templateWords;
  return {
    alignValue,
    columnGap: gapPart ? resolveGapValue(gapPart) : "",
    gridTemplate: rawTemplate.map(resolveTrackValue).join(" "),
  };
};

const parseRowsValue = (value: string) => {
  const { templatePart, gapPart } = splitTemplateValue(value);
  const templateWords = templatePart.split(/\s+/).filter(Boolean);
  const firstWord = templateWords[0];
  const justifyValue =
    firstWord && rowJustifications.has(firstWord) ? firstWord : undefined;
  const rawTemplate = justifyValue ? templateWords.slice(1) : templateWords;
  return {
    gridTemplate: rawTemplate.map(resolveTrackValue).join(" "),
    justifyContent: justifyValue === "between" ? "space-between" : justifyValue,
    justifyItems:
      justifyValue && justifyValue !== "between" ? justifyValue : undefined,
    rowGap: gapPart ? resolveGapValue(gapPart) : "",
  };
};

const resolveDebugColor = (value: string) => {
  const color = value.trim();
  if (color.startsWith("#") || color.includes("(")) return color;
  if (!color.includes(".") && !color.includes("-")) return color;
  return `var(--colors-${color.replace(/\./g, "-")})`;
};

const resolveDebugBorder = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const style = parts.find((part) => borderStyles.has(part)) ?? "solid";
  const color = parts.find((part) => !borderStyles.has(part)) ?? "red";
  return `1px ${style} ${resolveDebugColor(color)}`;
};
