// Numbered list: digit glyphs drawn as strokes (no <text>, which would
// ride the page font) with their lines. Reads currentColor.
export function ListNumbers(props: { size?: number }) {
  const size = props.size ?? 16;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/* "1": a stem with a serif foot and lead-in stroke */}
      <path
        d="M40,60l16,-10v54M40,104h32"
        fill="none"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* "2": open hook into a flat base */}
      <path
        d="M40,166a18,18,0,0,1,32,10c0,10,-8,16,-32,32h34"
        fill="none"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="104" y="70" width="112" height="16" rx="8" />
      <rect x="104" y="178" width="112" height="16" rx="8" />
    </svg>
  );
}
