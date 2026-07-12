// Checkbox list: a checked square with its lines. Stroke draws the box
// and check so they read at toolbar size; currentColor throughout.
export function ListChecks(props: { size?: number }) {
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
      <rect
        x="32"
        y="72"
        width="84"
        height="84"
        rx="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
      />
      <path
        d="M56,116l14,14,30,-30"
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="148" y="84" width="76" height="16" rx="8" />
      <rect x="148" y="128" width="76" height="16" rx="8" />
      <rect x="32" y="188" width="192" height="16" rx="8" />
    </svg>
  );
}
