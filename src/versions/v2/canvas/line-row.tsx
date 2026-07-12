import * as React from "react";
import { Block } from "atoms";
import { Checkbox, Numeric } from "alloys";
import { type Line, textOf } from "./lines";
import { parseSpans, renderSpans, sameSpans } from "./rich-dom";

type Props = {
  line: Line;
  // Display number when the line is numbered; markers of other kinds
  // ignore it.
  ordinal: number;
  onInput: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  onToggle: () => void;
  inputRef: (el: HTMLElement | null) => void;
};

// One canvas line. Plain text spans the full width so it sits on the
// page's left edge; marker lines carry a gutter, giving lists their
// natural indent. The content is a contenteditable div: while the user
// types, its DOM is the source of truth and state follows; when state
// changes from outside typing (formatting, conversion, split/merge) the
// sync effect rebuilds the DOM from the spans.
export function LineRow(props: Props) {
  const { line } = props;
  const plain = line.kind === "text";
  const done = line.kind === "checkbox" && line.done;
  const contentRef = React.useRef<HTMLElement | null>(null);

  React.useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // An IME's uncommitted preedit lives only in the DOM; syncing now
    // would tear it out mid-composition (the shell stamps the flag).
    if (el.dataset.composing !== undefined) return;
    if (!sameSpans(parseSpans(el), line.spans)) renderSpans(el, line.spans);
  });

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
              muted={textOf(line.spans).trim() === ""}
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
        as="div"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="false"
        aria-placeholder="Type here…"
        data-canvas-line=""
        data-placeholder="Type here…"
        ref={(el: HTMLElement | null) => {
          contentRef.current = el;
          props.inputRef(el);
        }}
        onInput={props.onInput}
        onKeyDown={props.onKeyDown}
        width="100%"
        minHeight="1.5em"
        outline="none"
        paddingBlock="0.25lh"
        fontFamily="'Inter Variable', sans-serif"
        fontSize="md"
        fontWeight={450}
        lineHeight="1.5"
        whiteSpace="pre-wrap"
        overflowWrap="anywhere"
        color={done ? "text-muted" : "text-primary"}
        textDecoration={done ? "line-through" : "none"}
        // :empty::before has no prop form; the placeholder lives there so
        // it never becomes real content.
        css={{
          "&:empty::before": {
            content: "attr(data-placeholder)",
            color: "text-muted",
          },
        }}
      />
    </Block>
  );
}
