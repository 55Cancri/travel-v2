// Strikethrough: the letter S with a line struck through its middle.
// Reads currentColor like the rest of the icon set.
export function TextStrikethrough(props: { size?: number }) {
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
        d="M170,76c-6,-18 -24,-28 -44,-28c-26,0 -44,14 -44,34c0,14 8,24 26,32M148,148c20,8 28,18 28,32c0,20 -20,32 -48,32c-24,0 -42,-10 -48,-28"
        fill="none"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <rect x="40" y="120" width="176" height="16" rx="8" />
    </svg>
  );
}
