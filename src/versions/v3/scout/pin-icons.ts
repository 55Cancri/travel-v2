// The map's pins, drawn to a canvas. Every query line carries its own color
// and every pin one of three verdicts, and maplibre wants a registered image
// per combination, so the pins are generated rather than shipped.
//
// One silhouette across all three verdicts: a decoration that changed the
// shape would read as a different object, so the verdict rides the FILL
// instead. Solid with a punched-out centre means open on hours we actually
// read, plain solid means hours unknown, and hollow means shut. A hollow pin
// takes the map's own background in the current theme, which is what makes
// it read as empty rather than as a pale pin.

export type PinPhase = "open" | "closed" | "unknown";

const PIN_WIDTH = 26;
const PIN_HEIGHT = 34;
// Drawn at 2x and registered with a matching pixelRatio, so the pin stays
// crisp on retina screens.
const SCALE = 2;
const OUTLINE = 2;

// The map's own paper under each theme, and the ring that lifts a pin off
// it. The ring stays white in both, the way a sticker reads on any surface.
const backdrop = (dark: boolean) => (dark ? "#171512" : "#FFFFFF");
const RING = "#FFFFFF";

export const pinImageId = (color: string, phase: PinPhase, dark: boolean) =>
  `scout-pin:${color}:${phase}:${dark ? "dark" : "light"}`;

export const pinImage = (color: string, phase: PinPhase, dark: boolean) => {
  const canvas = document.createElement("canvas");
  canvas.width = PIN_WIDTH * SCALE;
  canvas.height = PIN_HEIGHT * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new ImageData(canvas.width, canvas.height);
  ctx.scale(SCALE, SCALE);

  const radius = PIN_WIDTH / 2 - OUTLINE;
  const cx = PIN_WIDTH / 2;
  const cy = radius + OUTLINE;
  const tipY = PIN_HEIGHT - OUTLINE;
  // Where the flanks leave the head. Taking the TANGENT points from the tip
  // (rather than two fixed angles) is the whole difference between a
  // teardrop and a circle sitting on a triangle: at the tangent the flank
  // and the curve share a direction, so the outline turns into the point
  // with no corner to catch the eye.
  const fromTip = Math.acos(radius / (tipY - cy));
  ctx.beginPath();
  // Clockwise from the lower-left tangent, the long way over the top, to
  // the lower-right one; the two flanks then close the shape at the tip.
  ctx.arc(cx, cy, radius, Math.PI / 2 + fromTip, Math.PI / 2 - fromTip);
  ctx.lineTo(cx, tipY);
  ctx.closePath();

  const hollow = phase === "closed";
  ctx.fillStyle = hollow ? backdrop(dark) : color;
  ctx.fill();
  ctx.lineWidth = OUTLINE;
  ctx.lineJoin = "round";
  ctx.strokeStyle = hollow ? color : RING;
  ctx.stroke();

  // A punched centre marks the pins whose hours we actually read, so an
  // untagged place never passes itself off as confirmed-open.
  if (phase === "open") {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = RING;
    ctx.fill();
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};
