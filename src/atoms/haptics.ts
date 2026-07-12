// Haptic cues via the Vibration API. Blink-only: Android Chromium
// vibrates, everything else (all of iOS included) silently no-ops, so
// call sites fire unconditionally and never branch on platform. The API
// is on/off timing with no amplitude control, so perceived intensity
// comes from pulse length, count, and gap. Two hardware facts shape the
// values: a crisp click is an 8-20ms pulse (the actuator keeps ringing
// 20-50ms after the signal stops, so a longer single pulse feels
// mushy), and two pulses need a 50ms+ gap to register as separate
// events.
const PATTERNS = {
  /** One committed action: a button press, a toggle flip. */
  tap: [10],
  /** Grabbing something to drag: firmer than a tap, still crisp. */
  grab: [25],
} as const;

export type HapticName = keyof typeof PATTERNS;

// Calls inside the gap are dropped, never queued: vibrate() cancels any
// running pattern, so queueing would corrupt the one in flight.
const MIN_GAP_MS: Record<HapticName, number> = {
  tap: 50,
  grab: 0,
};

const lastFired: Partial<Record<HapticName, number>> = {};
let reducedMotion: MediaQueryList | undefined;

export const haptic = (name: HapticName) => {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  // Chromium ignores calls from hidden pages anyway; bail first so a
  // background call cannot cancel a pattern already in flight.
  if (document.visibilityState !== "visible") return;
  reducedMotion ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotion.matches) return;
  const now = Temporal.Now.instant().epochMilliseconds;
  if (now - (lastFired[name] ?? 0) < MIN_GAP_MS[name]) return;
  lastFired[name] = now;
  navigator.vibrate(Array.from(PATTERNS[name]));
};
