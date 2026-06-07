"use client";

type Props = {
  direction: "horizontal" | "vertical";
  onResize: (delta: number) => void;
};

export function ResizeHandle({ direction, onResize }: Props) {
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    let last = direction === "horizontal" ? e.clientX : e.clientY;

    function onMouseMove(ev: MouseEvent) {
      const current = direction === "horizontal" ? ev.clientX : ev.clientY;
      const delta = current - last;
      last = current;
      onResize(delta);
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor =
      direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div
      role="separator"
      aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
      onMouseDown={onMouseDown}
      className={
        direction === "horizontal"
          ? "w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-[var(--accent)]/30 active:bg-[var(--accent)]/50"
          : "h-1 shrink-0 cursor-row-resize bg-transparent hover:bg-[var(--accent)]/30 active:bg-[var(--accent)]/50"
      }
    />
  );
}
