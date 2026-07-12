import * as React from "react";
import {
  animate,
  motionValue,
  type AnimationPlaybackControls,
  type MotionProps,
  type MotionValue,
} from "framer-motion";
import { flushSync } from "react-dom";
import { haptic } from "atoms";

// Hand-rolled drag-to-reorder, extended for VARIABLE-HEIGHT rows (detail cards,
// note lines). Every row's `y` is a MotionValue WE own, keyed by ROW ID — the
// only thing driving transforms, so React's keyed reorder on drop can never
// paint a stale offset (the flicker). All row heights are measured once at grab
// time; from there:
//   - the drop slot advances when the pointer crosses each row's MIDPOINT
//   - passed siblings shift by the LIFTED row's height (not their own)
//   - the lifted row settles at the summed heights of the rows it passed
// The atomic invariant is unchanged: zero every offset, then commit the reorder
// and clear drag state in ONE flushSync.

const DRAG_SPRING = { type: "spring", stiffness: 700, damping: 42 } as const;
const DROP_SPRING = { type: "spring", stiffness: 560, damping: 38 } as const;

type RowAnim = {
  y: MotionValue<number>;
  target: number;
  controls: AnimationPlaybackControls | null;
};

type Drag = {
  activeId: string;
  fromIndex: number;
  toIndex: number;
  heights: number[];
  releasing: boolean;
};

// How far (signed) the lifted row travels when dropped at toIndex: the summed
// heights of every row it passed over.
const liftedOffset = (d: Drag) => {
  let total = 0;
  if (d.toIndex > d.fromIndex) {
    for (let k = d.fromIndex + 1; k <= d.toIndex; k++) total += d.heights[k];
  } else {
    for (let k = d.toIndex; k < d.fromIndex; k++) total -= d.heights[k];
  }
  return total;
};

// Which slot the pointer offset lands in: advance one row at a time, crossing
// each candidate's midpoint (accounting for the heights already passed).
const slotForOffset = (d: Drag, dy: number) => {
  const { heights, fromIndex } = d;
  if (dy > 0) {
    let acc = 0;
    let idx = fromIndex;
    for (let k = fromIndex + 1; k < heights.length; k++) {
      if (dy > acc + heights[k] / 2) {
        acc += heights[k];
        idx = k;
      } else break;
    }
    return idx;
  }
  let acc = 0;
  let idx = fromIndex;
  for (let k = fromIndex - 1; k >= 0; k--) {
    if (-dy > acc + heights[k] / 2) {
      acc += heights[k];
      idx = k;
    } else break;
  }
  return idx;
};

const defaultMeasure = (target: HTMLElement) => {
  const rowEl = target.closest("[data-item-row]") as HTMLElement | null;
  const listEl = rowEl?.parentElement;
  if (!listEl) return [];
  return Array.from(listEl.querySelectorAll(":scope > [data-item-row]")).map(
    (el) => el.getBoundingClientRect().height,
  );
};

export function useDragReorder(opts: {
  ids: string[];
  onCommit: (fromIndex: number, toIndex: number) => void;
  // "y" = vertical rows (default); "x" = horizontal chips.
  axis?: "x" | "y";
  // Returns each item's size along the axis, in ids order. Defaults to
  // measuring [data-item-row] siblings' heights.
  measure?: (target: HTMLElement) => number[];
}) {
  const axis = opts.axis ?? "y";
  const measure = opts.measure ?? defaultMeasure;
  const [drag, storeDrag] = React.useState<Drag | null>(null);
  const dragRef = React.useRef<Drag | null>(null);
  dragRef.current = drag;
  const idsRef = React.useRef(opts.ids);
  idsRef.current = opts.ids;
  const commitRef = React.useRef(opts.onCommit);
  commitRef.current = opts.onCommit;
  const anims = React.useRef(new Map<string, RowAnim>());
  const startY = React.useRef(0);
  const pointerY = React.useRef(0);
  const frame = React.useRef(0);
  const controllerRef = React.useRef<AbortController | null>(null);

  const getAnim = (id: string) => {
    let entry = anims.current.get(id);
    if (!entry) {
      entry = { y: motionValue(0), target: 0, controls: null };
      anims.current.set(id, entry);
    }
    return entry;
  };

  const jumpRow = (id: string, y: number) => {
    const entry = getAnim(id);
    entry.controls?.stop();
    entry.controls = null;
    entry.target = y;
    entry.y.jump(y);
  };

  const springRow = (
    id: string,
    y: number,
    transition: typeof DRAG_SPRING | typeof DROP_SPRING,
    force = false,
  ) => {
    const entry = getAnim(id);
    if (!force && entry.target === y) return null;
    entry.controls?.stop();
    entry.target = y;
    return new Promise<void>((resolve) => {
      entry.controls = animate(entry.y, y, {
        ...transition,
        onComplete: () => {
          entry.controls = null;
          resolve();
        },
      });
    });
  };

  // Siblings the lifted row has passed shift by the LIFTED row's height.
  const siblingTarget = (d: Drag, idx: number) => {
    const liftedHeight = d.heights[d.fromIndex];
    if (d.fromIndex < d.toIndex && idx > d.fromIndex && idx <= d.toIndex) {
      return -liftedHeight;
    }
    if (d.fromIndex > d.toIndex && idx >= d.toIndex && idx < d.fromIndex) {
      return liftedHeight;
    }
    return 0;
  };

  const applySiblingTargets = (
    d: Drag,
    transition: typeof DRAG_SPRING | typeof DROP_SPRING,
    force = false,
  ) => {
    const ids = idsRef.current;
    const completions: Promise<void>[] = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id === d.activeId) continue;
      const pending = springRow(id, siblingTarget(d, i), transition, force);
      if (pending) completions.push(pending);
    }
    return completions;
  };

  const tick = () => {
    frame.current = 0;
    const d = dragRef.current;
    if (!d || d.releasing) return;
    const dy = pointerY.current - startY.current;
    jumpRow(d.activeId, dy);
    const toIndex = slotForOffset(d, dy);
    if (toIndex !== d.toIndex) {
      const next = { ...d, toIndex };
      dragRef.current = next;
      storeDrag(next);
      applySiblingTargets(next, DRAG_SPRING);
    }
  };

  const atomicResetAndFinish = (d: Drag, shouldCommit: boolean) => {
    for (const id of idsRef.current) jumpRow(id, 0);
    dragRef.current = null;
    flushSync(() => {
      if (shouldCommit && d.toIndex !== d.fromIndex) {
        commitRef.current(d.fromIndex, d.toIndex);
      }
      storeDrag(null);
    });
  };

  const release = (event?: PointerEvent) => {
    if (event) pointerY.current = axis === "y" ? event.clientY : event.clientX;
    controllerRef.current?.abort();
    if (frame.current) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      tick();
    }
    const d = dragRef.current;
    if (!d) return;
    const next = { ...d, releasing: true };
    dragRef.current = next;
    storeDrag(next);
    if (next.toIndex === next.fromIndex) {
      atomicResetAndFinish(next, false);
      return;
    }
    const completions = applySiblingTargets(next, DROP_SPRING, true);
    const lifted = springRow(next.activeId, liftedOffset(next), DROP_SPRING, true);
    if (lifted) completions.push(lifted);
    Promise.all(completions).then(() => atomicResetAndFinish(next, true));
  };

  // `start.point` is the pointer coordinate along the axis (clientY for rows,
  // clientX for chips); `start.target` is any element inside the grabbed item.
  const startDrag = (
    start: { point: number; target: HTMLElement },
    fromIndex: number,
    id: string,
  ) => {
    haptic("grab");
    // Measure every item at grab time; the list can't change mid-drag, so a
    // one-shot snapshot is enough for variable sizes.
    const heights = measure(start.target);
    if (heights.length !== idsRef.current.length) {
      // Measurement out of sync with state — bail rather than corrupt.
      return;
    }
    startY.current = start.point;
    pointerY.current = start.point;
    jumpRow(id, 0);
    const init = {
      activeId: id,
      fromIndex,
      toIndex: fromIndex,
      heights,
      releasing: false,
    };
    dragRef.current = init;
    storeDrag(init);
    const controller = new AbortController();
    controllerRef.current = controller;
    const signal = controller.signal;
    window.addEventListener(
      "pointermove",
      (moveEvent) => {
        pointerY.current = axis === "y" ? moveEvent.clientY : moveEvent.clientX;
        if (!frame.current) frame.current = requestAnimationFrame(tick);
      },
      { signal },
    );
    window.addEventListener("pointerup", (upEvent) => release(upEvent), {
      signal,
    });
    window.addEventListener("pointercancel", (upEvent) => release(upEvent), {
      signal,
    });
  };

  React.useEffect(() => () => controllerRef.current?.abort(), []);

  // Only the LIFTED row gets position/z-index/will-change. Promoting every
  // sibling created dozens of compositing layers per drag, which forced the
  // map canvas to re-rasterize (visible as a subtle flicker while dragging).
  const motionFor = (id: string): MotionProps => {
    const d = drag;
    const entry = getAnim(id);
    const isLifted = d?.activeId === id;
    return {
      initial: false,
      style: {
        ...(axis === "y" ? { y: entry.y } : { x: entry.y }),
        position: isLifted ? "relative" : undefined,
        zIndex: isLifted ? 30 : undefined,
        willChange: isLifted ? "transform" : undefined,
      },
    };
  };

  return { startDrag, motionFor };
}
