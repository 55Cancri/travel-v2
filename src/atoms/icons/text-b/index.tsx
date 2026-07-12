// Bold: the letter B drawn as strokes. Reads currentColor like the rest
// of the icon set.
export function TextB(props: { size?: number }) {
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
      <path
        d="M84,52v152M84,52h58a34,34,0,0,1,0,68H84M84,120h66a40,40,0,0,1,0,84H84"
        fill="none"
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
