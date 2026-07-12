// Indent: a right-pointing arrow pushing a block of lines. Reads
// currentColor like the rest of the icon set.
export function Indent(props: { size?: number }) {
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
      <rect x="40" y="52" width="176" height="16" rx="8" />
      <rect x="120" y="120" width="96" height="16" rx="8" />
      <rect x="40" y="188" width="176" height="16" rx="8" />
      <path d="M40,100v56a8,8,0,0,0,12.8,6.4l37.33-28a8,8,0,0,0,0-12.8L52.8,93.6A8,8,0,0,0,40,100Z" />
    </svg>
  );
}
