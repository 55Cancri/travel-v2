import * as React from "react";
import {
  Block,
  Indent,
  ListBullets,
  ListChecks,
  ListNumbers,
  Outdent,
  TextB,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
} from "atoms";
import { IconButton } from "alloys";
import type { LineKind, Mark } from "./lines";

type Props = {
  // With text selected the bar is about the SELECTION (format buttons,
  // pressed for the marks every selected character carries); with a
  // bare caret (null) it is about the LINE (lists, indentation).
  marks: Mark[] | null;
  onMark: (kind: Exclude<LineKind, "text">) => void;
  onFormat: (mark: Mark) => void;
  onOutdent: () => void;
  onIndent: () => void;
};

const FORMATS = [
  { mark: "bold", label: "Bold", Glyph: TextB },
  { mark: "italic", label: "Italic", Glyph: TextItalic },
  { mark: "underline", label: "Underline", Glyph: TextUnderline },
  { mark: "strike", label: "Strikethrough", Glyph: TextStrikethrough },
] as const;

// The editing controls that ride above the mobile keyboard. Fixed to the
// bottom of the LAYOUT viewport, then lifted by however much the keyboard
// shrinks the VISUAL viewport (Android Chrome keeps fixed elements under
// the keyboard by default). Buttons preserve focus so pressing them never
// closes the keyboard.
export function EditBar(props: Props) {
  const marks = props.marks;
  const [lift, setLift] = React.useState(0);
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const abort = new AbortController();
    const track = () => setLift(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    track();
    vv.addEventListener("resize", track, { signal: abort.signal });
    vv.addEventListener("scroll", track, { signal: abort.signal });
    return () => abort.abort();
  }, []);
  return (
    <Block
      position="fixed"
      bottom="0"
      left="0"
      right="0"
      grid
      gridAutoFlow="column"
      justifyContent="start"
      gap="2px"
      px="sm"
      py="2px"
      overflowX="auto"
      bg="surface-panel"
      borderTopWidth="1px"
      borderTopStyle="solid"
      borderTopColor="border-muted"
      boxShadow="0 -1px 8px rgba(28, 25, 23, 0.06)"
      style={{ transform: `translateY(-${lift}px)` }}
    >
      {/* 2rlh keeps every control at fingertip size: these are the
          primary surface while the phone keyboard is up. */}
      {marks !== null ? (
        FORMATS.map((format) => {
          const held = marks.includes(format.mark);
          return (
            <IconButton
              key={format.mark}
              preservesFocus
              size="2rlh"
              aria-label={format.label}
              aria-pressed={held}
              bg={held ? "surface-muted" : undefined}
              color={held ? "text-primary" : undefined}
              onPress={() => props.onFormat(format.mark)}
            >
              <format.Glyph size={20} />
            </IconButton>
          );
        })
      ) : (
        <>
          <IconButton
            preservesFocus
            size="2rlh"
            aria-label="Bulleted list"
            onPress={() => props.onMark("bullet")}
          >
            <ListBullets size={20} />
          </IconButton>
          <IconButton
            preservesFocus
            size="2rlh"
            aria-label="Checkbox"
            onPress={() => props.onMark("checkbox")}
          >
            <ListChecks size={20} />
          </IconButton>
          <IconButton
            preservesFocus
            size="2rlh"
            aria-label="Numbered list"
            onPress={() => props.onMark("numbered")}
          >
            <ListNumbers size={20} />
          </IconButton>
          <IconButton preservesFocus size="2rlh" aria-label="Outdent" onPress={props.onOutdent}>
            <Outdent size={20} />
          </IconButton>
          <IconButton preservesFocus size="2rlh" aria-label="Indent" onPress={props.onIndent}>
            <Indent size={20} />
          </IconButton>
        </>
      )}
    </Block>
  );
}
