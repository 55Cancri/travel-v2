// Edit affordance for plan rows — opens the item editor. Classic pencil:
// stubby body, fat 2.5 stroke, and the divider line that reads as the eraser.
export function Pencil(props: { size?: number }) {
  const size = props.size ?? 14;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M15.5 5.5a2.4 2.4 0 0 1 3.4 3.4L8.5 19.3 3.6 20.4l1.1-4.9L15.5 5.5z" />
      <path d="M13.4 7.6l3.4 3.4" />
    </svg>
  );
}
