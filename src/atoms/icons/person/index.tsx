// Account / person glyph. Stroked with currentColor so it inherits the field's
// muted text color.
export function Person(props: { size?: number }) {
  const size = props.size ?? 18;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3.5" />
      <path d="M18 20a6 6 0 0 0-12 0" />
    </svg>
  );
}
