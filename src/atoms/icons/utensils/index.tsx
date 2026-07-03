// Fork + knife for the meals tab (Phosphor: fork-knife), split so each utensil
// is its own path. The fork always stays in its outline form (it only recolors
// when the tab is active); only the knife swaps to the solid weight on `filled`.
const FORK =
  "M72,88V40a8,8,0,0,1,16,0V88a8,8,0,0,1-16,0ZM119.89,38.69a8,8,0,1,0-15.78,2.63L112,88.63a32,32,0,0,1-64,0l7.88-47.31a8,8,0,1,0-15.78-2.63l-8,48A8.17,8.17,0,0,0,32,88a48.07,48.07,0,0,0,40,47.32V224a8,8,0,0,0,16,0V135.32A48.07,48.07,0,0,0,128,88a8.17,8.17,0,0,0-.11-1.31Z";
const KNIFE_OUTLINE =
  "M216,40V224a8,8,0,0,1-16,0V176H152a8,8,0,0,1-8-8,268.75,268.75,0,0,1,7.22-56.88c9.78-40.49,28.32-67.63,53.63-78.47A8,8,0,0,1,216,40ZM200,53.9c-32.17,24.57-38.47,84.42-39.7,106.1H200Z";
const KNIFE_FILL =
  "M216,40V224a8,8,0,0,1-16,0V176H152a8,8,0,0,1-8-8,268.75,268.75,0,0,1,7.22-56.88c9.78-40.49,28.32-67.63,53.63-78.47A8,8,0,0,1,216,40Z";

export function Utensils(props: { size?: number; filled?: boolean }) {
  const size = props.size ?? 26;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={FORK} />
      <path d={props.filled ? KNIFE_FILL : KNIFE_OUTLINE} />
    </svg>
  );
}
