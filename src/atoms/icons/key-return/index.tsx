// The Return key glyph: along the top, down the right side, back left,
// ending in the leftward arrowhead. Stroke-matched to the set's 2px line.
export function KeyReturn(props: { size?: number }) {
  const size = props.size ?? 16;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 5h11a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H5" />
      <path d="M9 10l-4 4 4 4" />
    </svg>
  );
}
