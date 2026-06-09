"use client";

import { useEffect, useRef } from "react";
import { FileText, FlaskConical, StickyNote, X } from "lucide-react";
import {
  PROJECT_TEMPLATES,
  ProjectTemplateId,
} from "@/lib/project/templates";
import { Button } from "@/components/ui/Button";

const ICONS: Record<ProjectTemplateId, typeof FileText> = {
  sample: FlaskConical,
  blank: FileText,
  notes: StickyNote,
};

type Props = {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onCreate: (template: ProjectTemplateId) => void;
};

export function CreateProjectDialog({ open, creating, onClose, onCreate }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !creating) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, creating, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !creating && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        className="w-full max-w-lg rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <h2 id="create-project-title" className="text-ui-lg font-semibold">
              New manuscript
            </h2>
            <p className="mt-1 text-ui-sm text-[var(--muted)]">
              Choose a starting point — you can rename the project anytime.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 p-5">
          {PROJECT_TEMPLATES.map((template) => {
            const Icon = ICONS[template.id];
            return (
              <button
                key={template.id}
                type="button"
                disabled={creating}
                onClick={() => onCreate(template.id)}
                className="group flex w-full items-start gap-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background)] p-4 text-left transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--surface-hover)] disabled:opacity-60"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-ui-md font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)]">
                    {template.name}
                  </span>
                  <span className="mt-0.5 block text-ui-sm text-[var(--muted)]">
                    {template.description}
                  </span>
                  <span className="mt-1 block text-ui-xs text-[var(--muted)]/80">
                    {template.detail}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end border-t border-[var(--border-subtle)] px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
