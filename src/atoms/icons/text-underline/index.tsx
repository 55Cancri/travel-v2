// Underline: the letter U over its line. Reads currentColor like the
// rest of the icon set.
export function TextUnderline(props: { size?: number }) {
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
        d="M76,44v72a52,52,0,0,0,104,0V44"
        fill="none"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <rect x="60" y="200" width="136" height="16" rx="8" />
    </svg>
  );
}
