// Caret-left: the caret-right glyph mirrored, for "step back" affordances.
// Reads currentColor like the rest of the icon set.
const CARET_RIGHT_PATH =
  "M184.49,136.49l-80,80a12,12,0,0,1-17-17L159,128,87.51,56.49a12,12,0,1,1,17-17l80,80A12,12,0,0,1,184.49,136.49Z";

export function CaretLeft(props: { size?: number }) {
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
      <path transform="translate(256 0) scale(-1 1)" d={CARET_RIGHT_PATH} />
    </svg>
  );
}
