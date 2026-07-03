// Haptic cues via the Vibration API. Android fires these; iOS Safari has no
// Vibration API and silently no-ops, so callers never branch on platform. One
// short vocabulary, centralized, so every tactile moment feels consistent.
const buzz = (ms: number) => {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  ) {
    navigator.vibrate(ms);
  }
};

export const haptics = {
  // A light confirm for a discrete tap: + buttons, back navigation. Kept above
  // ~30ms because most Android motors can't render a shorter pulse perceptibly,
  // so a 10-15ms buzz just feels like nothing.
  tap: () => buzz(35),
  // A firmer cue for grabbing a row to drag.
  grab: () => buzz(55),
};
