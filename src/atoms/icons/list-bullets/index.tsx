// Bulleted list: three dots with their lines. Reads currentColor like
// the rest of the icon set.
export function ListBullets(props: { size?: number }) {
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
      <circle cx="52" cy="64" r="14" />
      <circle cx="52" cy="128" r="14" />
      <circle cx="52" cy="192" r="14" />
      <rect x="92" y="56" width="124" height="16" rx="8" />
      <rect x="92" y="120" width="124" height="16" rx="8" />
      <rect x="92" y="184" width="124" height="16" rx="8" />
    </svg>
  );
}
