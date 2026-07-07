// Edit affordance for plan rows. A chunky rounded pencil, no framing box:
// bold body drawn point-down-left with the band that separates the eraser
// cap near the top end.
export function Pencil(props: { size?: number }) {
  const size = props.size ?? 14;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17.8 3.1a3.1 3.1 0 0 1 4.4 4.4L7.6 22.1 2.3 23.4l1.3-5.3L17.8 3.1z" />
      <path d="M15.1 5.8l4.4 4.4" />
    </svg>
  );
}
