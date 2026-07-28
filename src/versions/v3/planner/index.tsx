import { Scout } from "../scout";

// v3 draws no line between browsing trips and planning one: a device that
// flips to this generation while sitting on a trip URL gets the same map
// rather than a dead end.
export function Planner() {
  return <Scout />;
}
