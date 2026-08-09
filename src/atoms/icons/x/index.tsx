// Close/dismiss cross, stroke-matched to the Plus (same 2px stroke, round
// caps, one unit narrower in span because diagonals read larger than
// orthogonals at equal bounds). The two share toolbars, so they must
// weigh the same.
export function X(props: { size?: number }) {
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
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
