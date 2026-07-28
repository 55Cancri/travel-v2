// The map's paper, in both themes. Every generation's map renders on the
// same canvas, so the style lives here rather than inside one of them.
// Callers pass the current theme and hand the result straight to maplibre,
// which takes a URL and a parsed style interchangeably.

export const LIGHT_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

// Our own dark map theme. OpenFreeMap's "dark" is pure grayscale (asleep) and
// "fiord" is aggressively blue, so we take dark's layer structure and repaint
// it: warm near-black base matching the app's stone palette, night-teal water,
// dark-green parks, amber-cast motorways, and brighter warm labels for
// contrast. Paint overrides are keyed by layer id (checked against the style).
const DARK_PAINT: Record<string, Record<string, string>> = {
  background: { "background-color": "#171512" },
  landuse_residential: { "fill-color": "#1D1A16" },
  landcover_wood: { "fill-color": "#1F2B1C" },
  landuse_park: { "fill-color": "#223020" },
  water: { "fill-color": "#1D3038" },
  waterway: { "line-color": "#1D3038" },
  water_name: { "text-color": "#527884", "text-halo-color": "rgba(0,0,0,0.7)" },
  building: { "fill-color": "#211E1A", "fill-outline-color": "#2A2622" },
  "aeroway-taxiway": { "line-color": "#22201C" },
  "aeroway-runway-casing": { "line-color": "rgba(70,62,54,0.8)" },
  "aeroway-area": { "fill-color": "#1A1815" },
  "aeroway-runway": { "line-color": "#1A1815" },
  highway_path: { "line-color": "#2A2724" },
  highway_minor: { "line-color": "#2B2723" },
  highway_major_casing: { "line-color": "rgba(70,62,54,0.8)" },
  highway_major_inner: { "line-color": "#38332C" },
  highway_major_subtle: { "line-color": "#332E28" },
  highway_motorway_casing: { "line-color": "rgba(92,76,55,0.8)" },
  highway_motorway_inner: { "line-color": "#4A3E2D" },
  highway_motorway_subtle: { "line-color": "#2E2A24" },
  railway_transit: { "line-color": "#35302A" },
  railway_minor: { "line-color": "#35302A" },
  railway: { "line-color": "#35302A" },
  highway_name_other: { "text-color": "#6B6258", "text-halo-color": "rgba(0,0,0,0.9)" },
  highway_name_motorway: { "text-color": "#7D7367" },
  boundary_state: { "line-color": "#3A352F" },
  "boundary_country_z0-4": { "line-color": "#3A352F" },
  "boundary_country_z5-": { "line-color": "#3A352F" },
  place_other: { "text-color": "#8F857A" },
  place_suburb: { "text-color": "#8F857A" },
  place_village: { "text-color": "#8F857A" },
  place_town: { "text-color": "#A89F94" },
  place_city: { "text-color": "#A89F94" },
  place_city_large: { "text-color": "#C2B8AB" },
  place_state: { "text-color": "#8F857A" },
  place_country_other: { "text-color": "#A89F94" },
  place_country_minor: { "text-color": "#A89F94" },
  place_country_major: { "text-color": "#C2B8AB" },
};

type StyleJson = { layers: Array<{ id: string; paint?: Record<string, unknown> }> };
let darkStylePromise: Promise<StyleJson> | null = null;
const loadDarkStyle = () => {
  darkStylePromise ??= fetch(DARK_STYLE_URL)
    .then((res) => res.json() as Promise<StyleJson>)
    .then((style) => ({
      ...style,
      layers: style.layers.map((layer) =>
        DARK_PAINT[layer.id]
          ? { ...layer, paint: { ...layer.paint, ...DARK_PAINT[layer.id] } }
          : layer,
      ),
    }));
  return darkStylePromise;
};

// The dark style is fetched and repainted once per session, then handed out
// as a fresh COPY per caller. Maplibre takes ownership of a style object and
// mutates it in place, so two maps sharing one object (two generations, or
// one component remounting) leave the second with a style that silently
// never loads. The light style is a URL, which maplibre fetches itself, so
// it has nothing to share.
export const mapStyle = async (dark: boolean) =>
  dark ? structuredClone(await loadDarkStyle()) : LIGHT_STYLE;
