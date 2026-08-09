// Three bars, the sliding-panel handle. Reads currentColor like the rest
// of the icon set.
export function Menu(props: { size?: number }) {
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
      <rect x="40" y="60" width="176" height="16" rx="8" />
      <rect x="40" y="120" width="176" height="16" rx="8" />
      <rect x="40" y="180" width="176" height="16" rx="8" />
    </svg>
  );
}
