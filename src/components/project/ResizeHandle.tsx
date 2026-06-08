"use client";

import { useRef } from "react";

type Props = {
  direction: "horizontal" | "vertical";
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
};

export function ResizeHandle({
  direction,
  onResize,
  onResizeStart,
  onResizeEnd,
}: Props) {
  const dragging = useRef(false);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    dragging.current = true;
    onResizeStart?.();

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    let last = direction === "horizontal" ? e.clientX : e.clientY;

    const cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";

    function onPointerMove(ev: PointerEvent) {
      if (!dragging.current) return;
      const current = direction === "horizontal" ? ev.clientX : ev.clientY;
      const delta = current - last;
      if (delta !== 0) {
        last = current;
        onResize(delta);
      }
    }

    function endDrag() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        // pointer may already be released
      }
      target.removeEventListener("pointermove", onPointerMove);
      target.removeEventListener("pointerup", endDrag);
      target.removeEventListener("pointercancel", endDrag);
      onResizeEnd?.();
    }

    target.addEventListener("pointermove", onPointerMove);
    target.addEventListener("pointerup", endDrag);
    target.addEventListener("pointercancel", endDrag);
  }

  const isHorizontal = direction === "horizontal";

  return (
    <div
      role="separator"
      aria-orientation={isHorizontal ? "vertical" : "horizontal"}
      onPointerDown={onPointerDown}
      className={
        isHorizontal
          ? "group relative z-10 w-1.5 shrink-0 touch-none select-none"
          : "group relative z-10 h-1.5 shrink-0 touch-none select-none"
      }
    >
      <div
        className={
          isHorizontal
            ? "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--border)] transition-colors group-hover:bg-[var(--accent)]/40 group-active:bg-[var(--accent)]/60"
            : "absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--border)] transition-colors group-hover:bg-[var(--accent)]/40 group-active:bg-[var(--accent)]/60"
        }
      />
      <div
        className={
          isHorizontal
            ? "absolute inset-y-0 -left-1 w-3 cursor-col-resize"
            : "absolute inset-x-0 -top-1 h-3 cursor-row-resize"
        }
      />
    </div>
  );
}
