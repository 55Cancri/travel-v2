// Edit affordance for plan rows. A fat, compact pencil, no framing box:
// the width comes from the GEOMETRY (a wide diagonal body with a rounded
// cap and a short converging tip), not from stroke weight, so it reads
// chunky without blobbing at small sizes. The cross line is the band
// where the tip meets the body.
export function Pencil(props: { size?: number }) {
  const size = props.size ?? 14;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 20 L4.6 13.6 L14.6 3.6 A4.1 4.1 0 0 1 20.4 9.4 L10.4 19.4 Z" />
      <path d="M4.6 13.6 L10.4 19.4" />
    </svg>
  );
}
