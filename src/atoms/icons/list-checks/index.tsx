// Checkbox list: two checked squares with their lines, so it reads as a
// list of checkboxes at toolbar size. Stroke draws the boxes and checks;
// currentColor throughout.
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
        x="34"
        y="42"
        width="72"
        height="72"
        rx="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
      />
      <path
        d="M54,80l12,12,26,-26"
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="136" y="70" width="86" height="16" rx="8" />
      <rect
        x="34"
        y="142"
        width="72"
        height="72"
        rx="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
      />
      <path
        d="M54,180l12,12,26,-26"
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="136" y="170" width="86" height="16" rx="8" />
    </svg>
  );
}
