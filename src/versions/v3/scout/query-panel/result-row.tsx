import * as React from "react";
import { Block, Button, Text } from "atoms";
import { Checkbox } from "alloys";
import type { Finding } from "../find-places";
import { openLine, openVerdict } from "../open-now";

// One found place: a checkbox that puts it on the map, and a press target
// that flies the camera to it. Three lines at most, in falling importance,
// so a list of forty branches stays scannable. `active` is the keyboard
// highlight: the input's arrow keys walk the rows while focus stays in
// the field, so the row shows the standing rather than taking focus.
export function ResultRow(props: {
  finding: Finding;
  checked: boolean;
  active: boolean;
  now: Temporal.Instant;
  onToggle: () => void;
  onFocus: () => void;
}) {
  const verdict = openVerdict(props.finding, props.now);
  const hours = openLine(verdict);
  const detail = [props.finding.category, props.finding.address].filter(Boolean).join(" · ");

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    // The branch list scrolls inside its own box; the highlight must not
    // walk out of view.
    if (props.active) rootRef.current?.scrollIntoView({ block: "nearest" });
  }, [props.active]);

  return (
    <Block
      ref={rootRef}
      grid
      cols="auto 1fr"
      alignItems="start"
      gap="sm"
      py="sm"
      px="xs"
      mx="-0.25lh"
      borderRadius="xs"
      bg={props.active ? "surface-hover" : "transparent"}
    >
      {/* Nudged onto the first line's optical centre: the checkbox is a
          square box beside text that sits on a taller line box. */}
      <Block pt="0.15rem">
        <Checkbox
          checked={props.checked}
          onToggle={props.onToggle}
          label={`Show ${props.finding.name} on the map`}
        />
      </Block>
      <Button
        type="button"
        onPress={props.onFocus}
        w="100%"
        minW={0}
        px={0}
        // The button centres its slots by default, which would let each
        // row's left edge drift with the length of its text.
        justifyContent="start"
        // The button's own slot track is max-content, which would size
        // the row to its longest address and overflow sideways; a
        // clamped track makes long addresses WRAP instead.
        gridAutoColumns="minmax(0, 1fr)"
        borderRadius="xs"
        title="Centre the map here"
      >
        {/* The button lays its own slots out in a column, so the row's
            lines stack inside one child of it. */}
        <Block grid justifyItems="start" minW={0} w="100%" textAlign="start">
          <Text fontSize="sm" fontWeight="550" color="text-primary">
            {props.finding.name}
          </Text>
          {hours ? (
            <Text
              fontSize="xs"
              fontWeight="550"
              color={verdict.phase === "closed" ? "danger" : "text-muted"}
            >
              {hours}
            </Text>
          ) : null}
          {detail ? (
            <Text fontSize="xs" color="text-muted">
              {detail}
            </Text>
          ) : null}
        </Block>
      </Button>
    </Block>
  );
}
