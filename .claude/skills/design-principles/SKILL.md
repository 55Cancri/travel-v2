---
name: design-principles
description: >-
  A portable catalog of UI design principles: type, spacing, iconography,
  motion. Grown from real lessons, written to apply to any project. Apply
  the checklist when building, changing, or reviewing any screen or
  component, before presenting it. When a flagged design issue generalizes
  beyond the component it appeared in, distill the principle and add it
  here in the same turn.
---

# Design principles

A design canon, not a project rulebook. Every entry is a general principle
that would survive being handed to a stranger on a different codebase.
Project-specific prescriptions (exact sizes, component names, screen
layouts) don't belong; when a lesson arrives wearing project details, strip
them and keep what generalizes. Entries carry the **principle**, the
mechanical **look-for** tripwires a checklist can verify, and the
**repair** pattern.

Before presenting any screen, run every look-for over the code just
touched.

## 1. Type discipline

**Principle.** Few font sizes, few weights. Each size on a screen earns a
distinct role (heading, body, support, micro label); a size without a role
is noise. A recurring text treatment becomes a named component instead of
overrides sprinkled at call sites.

**Look for.**
- Font-size or weight overrides in feature code that don't map to a role.
- Redundant overrides: a size set on something whose component already
  sets it.
- The same ad-hoc treatment hand-rolled in more than one place.

**Repair.** Collapse to the role sizes; promote the recurring treatment to
a named component.

## 2. Optical edges, not box edges

**Principle.** Space and align by what the eye sees, not by element boxes.
A control's transparent hit area is not visual margin: a 48px button around
a 24px glyph carries 12px of invisible padding, and layout that ignores it
drifts. Edges of a screen share one rhythm top and bottom.

**Look for.**
- Container padding computed without subtracting a control's internal
  padding.
- The same glyph rendered at different sizes at the same level of
  hierarchy.
- Any edge spacing not eyeballed against the opposite edge of the screen.

**Repair.** Subtract internal padding from the container's spacing and pin
one glyph size per hierarchy level.

## 3. Group with space, not lines

**Principle.** Proximity groups; separators are a last resort. A hairline
border between regions that spacing already distinguishes is chrome debt,
and it reads heaviest on small screens.

**Look for.**
- Border lines between a page and its nav/footer rows.
- Dividers inside lists whose rows already separate by padding.

**Repair.** Delete the line, adjust the spacing until the grouping reads.

## 4. Built for fingers

**Principle.** On touch screens every control is designed for a fingertip:
a hit target of roughly 44px or more, sitting on the vertical rhythm
(about two root line-heights; size targets in root-relative units so they
don't inflate with the glyph's font size), a press well with visible
padding around the glyph, and hover styling that cannot strand itself
(touch keeps :hover stuck after a tap).

**Look for.**
- Interactive targets under ~44px, or targets sized relative to their own
  font size.
- A press/hover well hugging the glyph box: it reads as a smudge, not a
  button.
- Hover styles not scoped to hover-capable devices; press feedback that
  exists only as a hover style.

**Repair.** Size targets in root line-heights, keep wells padded, scope
hover to `@media (hover: hover)`, put touch feedback on the press state.

## 5. Mobile overlays rise from the bottom

**Principle.** On a phone, an overlay panel is a bottom sheet: it slides up
within thumb reach, leaves the page visible above, carries a grabber bar
and a close button, and dismisses by grabber drag past a threshold (or a
flick), scrim tap, or Escape. Drag starts from the handle only, so it never
steals gestures from content. Side drawers are a pointer-device shape.

**Look for.**
- A mobile overlay entering from any edge but the bottom.
- A sheet missing any of: grabber, close button, scrim tap, drag-dismiss.
- Drag handlers on the whole panel instead of the handle row.

**Repair.** One shared sheet component per project; overlays compose it.

## 6. Icon silhouettes

**Principle.** An icon must read as its object at rendered size. Decorative
strokes that drift from the base shape turn it into a different glyph
(radial ticks floating off a circle read as a sun, not a gear).

**Look for.**
- Detached decorations: ticks, dots, or accents floating away from the
  base shape, or long enough to compete with it.
- Any new icon not eyeballed at its real rendered size, in every theme it
  ships in. The design-size canvas lies about how it feels at 1x.

**Repair.** Tighten decorations against the base shape, shorten them, and
re-check at rendered size before presenting.

## 7. Skeuomorphic motion follows the real mechanism

**Principle.** Motion that depicts a physical object must move the way the
object moves. A padlock shackle swings around the axis of its fixed leg,
drops into the body, and seats. An invented path reads as wrong even when
the tween is smooth.

**Look for.**
- Any animation of a real-world object where the choreography was chosen
  for tween convenience instead of taken from the mechanism.
- Single-stage tweens standing in for multi-stage mechanisms (swing, then
  drop, then impact). Stages sequence; they don't blend.

**Repair.** Write down how the physical object actually moves, stage the
animation to match, and put the impact feedback at the moment of contact.

## 8. Stroke integrity in icon motion

**Principle.** A scale transform on a stroked shape distorts its stroke
weight. Animate the geometry instead: interpolate the path's `d` between
states with identical command structure, or use transforms that preserve
stroke (translate, rotate, mirror).

**Look for.**
- Scale animations on stroked SVG elements where the two states differ in
  SHAPE, not orientation (a mirror flip via scaleX -1 to 1 is fine; a
  squash via scaleY 0.6 is not).
- Stroke width visibly changing between animation frames.

**Repair.** Define the end pose as a second `d` string with the same
commands and animate `d`.

## 9. Let the payoff land

**Principle.** A completing animation needs a beat before the screen
changes. Navigating the instant an effect finishes means it was never
seen.

**Look for.**
- Navigation (or any screen swap) in the same tick as an
  animation-complete callback.

**Repair.** Hold roughly half a second after the final effect before
moving on.
