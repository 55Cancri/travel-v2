// Edit affordance for plan rows. Just the pencil, no framing box: a slim
// diagonal body with the divider line that reads as the metal ferrule.
export function Pencil(props: { size?: number }) {
  const size = props.size ?? 14;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17.2 3.4a2.55 2.55 0 0 1 3.6 3.6L7.3 20.5 2.5 21.7l1.2-4.8L17.2 3.4z" />
      <path d="M14.8 5.8l3.6 3.6" />
    </svg>
  );
}
