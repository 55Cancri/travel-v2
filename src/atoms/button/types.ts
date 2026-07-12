import type { MotionProps } from "framer-motion";
import type { LongPressEvent, PressEvent } from "react-aria";
import type * as React from "react";

import type { HapticName } from "../haptics";
import type * as _tt from "../types";

export type As = _tt.ButtonElement;

export type Props<T extends _tt.ButtonElement = "button"> = _tt.PolymorphicProps<
  T,
  {
    _motion?: MotionProps;
    /** Leading slot, typically an icon. Replaced by the loader while isLoading. */
    start?: React.ReactNode;
    /** Trailing slot. Replaced by the loader when loadingPlacement="end". */
    end?: React.ReactNode;
    isLoading?: boolean;
    loadingPlacement?: "start" | "end" | "replace";
    /** Custom loader node; the built-in Spinner renders when omitted. */
    loadingIndicator?: React.ReactNode;
    /**
     * react-aria's unified activation event: fires for pointer release over
     * the target (with drag-off cancel), Enter/Space, and screen-reader
     * virtual clicks. Prefer it over onClick, which also still works.
     */
    onPress?: (event: PressEvent) => void;
    /**
     * Fires after a sustained press (~500ms hold). A hold that triggers it
     * suppresses the release's onPress, so one control can tap-activate
     * and hold-reveal without double firing.
     */
    onLongPress?: (event: LongPressEvent) => void;
    /**
     * Pressing never moves focus to the button, so whatever the user was
     * editing keeps its caret and the mobile keyboard stays open. For
     * toolbar buttons that act on a focused input.
     */
    preservesFocus?: boolean;
    /**
     * The tactile cue a press fires. Every press taps unless a call site
     * names a different cue or silences it with false (for a handler
     * that sometimes suppresses its own action, where a buzz would lie).
     */
    haptic?: HapticName | false;
  }
>;
