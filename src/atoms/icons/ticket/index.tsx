// Booking marker for plan-row detail lines (confirmation codes, phone):
// a stub ticket with notched edges and a perforation line. Stroke weight
// matches the sm text these lines carry.
export function Ticket(props: { size?: number }) {
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
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5V7z" />
      <path d="M14 5v2.3M14 10.9v2.2M14 16.7V19" />
    </svg>
  );
}
