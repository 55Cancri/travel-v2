import * as React from "react";
import { Block } from "atoms";
import { Checkbox, Numeric } from "alloys";
import type { Line } from "./lines";

type Props = {
  line: Line;
  // Display number when the line is numbered; markers of other kinds
  // ignore it.
  ordinal: number;
  onChange: (text: string, caret: number) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onToggle: () => void;
  inputRef: (el: HTMLTextAreaElement | null) => void;
};

// One canvas line. Plain text spans the full width so it sits on the
// page's left edge; marker lines carry a gutter, giving lists their
// natural indent. The canvas reads in Inter, chosen over the app face
// for crispness at dense list sizes.
export function LineRow(props: Props) {
  const { line } = props;
  const plain = line.kind === "text";
  const done = line.kind === "checkbox" && line.done;
  return (
    <Block
      grid
      cols={plain ? "1fr" : "minmax(1.6rem, max-content) 1fr"}
      columnGap={plain ? undefined : "xs"}
      alignItems="start"
      // Indentation is a per-line runtime value, so it rides a raw style.
      style={{ paddingLeft: `${line.indent * 1.5}rem` }}
    >
      {plain ? null : (
        <Block grid placeItems="center" h="1.5lh">
          {line.kind === "bullet" ? (
            <Block w="0.32rem" h="0.32rem" borderRadius="9999px" bg="text-primary" />
          ) : null}
          {line.kind === "checkbox" ? (
            <Checkbox
              checked={line.done}
              muted={line.text.trim() === ""}
              onToggle={props.onToggle}
              label="Done"
              preservesFocus
            />
          ) : null}
          {line.kind === "numbered" ? (
            <Numeric fontSize="md" fontFamily="'Inter Variable', sans-serif" color="text-primary">
              {props.ordinal}.
            </Numeric>
          ) : null}
        </Block>
      )}
      <Block
        as="textarea"
        data-canvas-line=""
        ref={props.inputRef}
        value={line.text}
        placeholder="Type here…"
        rows={1}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
          props.onChange(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
        }
        onKeyDown={props.onKeyDown}
        width="100%"
        border="0"
        outline="none"
        background="transparent"
        padding="0"
        paddingBlock="0.25lh"
        margin="0"
        fontFamily="'Inter Variable', sans-serif"
        fontSize="md"
        fontWeight={450}
        lineHeight="1.5"
        resize="none"
        overflow="hidden"
        _placeholder={{ color: "text-muted" }}
        color={done ? "text-muted" : "text-primary"}
        textDecoration={done ? "line-through" : "none"}
        style={{ fieldSizing: "content" } as React.CSSProperties}
      />
    </Block>
  );
}
