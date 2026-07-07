// Side-effect CSS imports (fontsource ships styles only, no types).
declare module "@fontsource-variable/instrument-sans";
declare module "*.css";

// tz-lookup ships untyped: coordinates in, IANA zone id out. Throws on
// non-finite input.
declare module "tz-lookup" {
  const tzLookup: (lat: number, lng: number) => string;
  export default tzLookup;
}
