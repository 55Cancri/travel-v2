// Address marker for plan-row detail lines: the classic teardrop pin.
export function MapPin(props: { size?: number }) {
  const size = props.size ?? 14;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 21.5s-7.5-6.1-7.5-11.4a7.5 7.5 0 0 1 15 0c0 5.3-7.5 11.4-7.5 11.4z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}
