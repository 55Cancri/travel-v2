import type * as React from "react";

/**
 * Fans one DOM node out to several refs. Button and Input need the node
 * twice: once for the consumer's ref and once for the atom's own ref
 * (react-aria's useButton, the click-to-focus root in Input).
 */
export const attachRefs = <T,>(...refs: Array<React.Ref<T> | undefined>) => {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    }
  };
};
