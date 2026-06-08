"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Tag } from "lucide-react";
import { formatStatus, statusTone } from "@/lib/ui/object-styles";
import { StatusPill } from "./StatusPill";

type Tone = ReturnType<typeof statusTone>;

const toneIconClass: Record<Tone, string> = {
  neutral: "text-[var(--muted)]",
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
  muted: "text-[var(--muted)]",
};

const toneDotClass: Record<Tone, string> = {
  neutral: "bg-[var(--muted)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  muted: "bg-[var(--muted)]",
};

type Props = {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function StatusMenu({ value, options, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const tone = statusTone(value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (disabled) {
    return (
      <StatusPill tone={tone} dot>
        {formatStatus(value)}
      </StatusPill>
    );
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={menuId}
        aria-label={`Status: ${formatStatus(value)}`}
        title={`Status: ${formatStatus(value)}`}
        className={`relative flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] transition-colors ${
          open
            ? "bg-[var(--accent)]/12 text-[var(--accent)]"
            : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        }`}
      >
        <Tag className={`h-3.5 w-3.5 ${toneIconClass[tone]}`} />
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-[var(--surface)] ${toneDotClass[tone]}`}
        />
      </button>

      {open && (
        <ul
          id={menuId}
          role="listbox"
          aria-label="Object status"
          className="status-menu-enter absolute left-0 top-full z-30 mt-1 max-h-64 min-w-[11.5rem] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-sm)]"
        >
          {options.map((status) => {
            const itemTone = statusTone(status);
            const selected = status === value;
            return (
              <li key={status} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(status);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui-xs transition-colors ${
                    selected
                      ? "bg-[var(--accent)]/8 text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDotClass[itemTone]}`}
                  />
                  <span className="min-w-0 flex-1">{formatStatus(status)}</span>
                  {selected && (
                    <Check className="h-3 w-3 shrink-0 text-[var(--accent)]" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
