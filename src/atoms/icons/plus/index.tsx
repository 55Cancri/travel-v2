// Stroke-weight-matched plus (same 2px stroke as the checkbox border), so the
// "Add" ghost rows never read heavier than the real rows above them. Arms
// span the same 12 grid units as the X's diagonals: the two share toolbars,
// and unequal spans read as unequal sizes at identical pixels.
export function Plus(props: { size?: number }) {
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
      <path d="M12 6v12M6 12h12" />
    </svg>
  );
}
