"use client";

import { useMemo } from "react";
import { ChevronDown, ChevronRight, ListTree } from "lucide-react";
import { parseDocumentOutline } from "@/lib/latex/outline";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type Props = {
  content: string;
  currentLine: number;
  onJumpToLine: (line: number) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function DocumentOutlinePanel({
  content,
  currentLine,
  onJumpToLine,
  collapsed,
  onToggleCollapsed,
}: Props) {
  const outline = useMemo(() => parseDocumentOutline(content), [content]);

  const activeIndex = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < outline.length; i++) {
      if (outline[i].line <= currentLine) idx = i;
      else break;
    }
    return idx;
  }, [outline, currentLine]);

  if (collapsed) {
    return (
      <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface)]">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex w-full items-center gap-2 px-3 py-2 text-ui-xs text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        >
          <ListTree className="h-3.5 w-3.5" />
          <span>Structure</span>
          {outline.length > 0 && (
            <span className="text-[var(--border)]">· {outline.length} headings</span>
          )}
          <ChevronRight className="ml-auto h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex max-h-44 min-h-0 shrink-0 flex-col border-t border-[var(--border-subtle)] bg-[var(--surface)]">
      <PanelHeader
        title="Structure"
        subtitle="Sections & subsections"
        className="border-none py-2"
        actions={
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            aria-label="Collapse structure panel"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {outline.length === 0 ? (
          <EmptyState
            title="No sections yet"
            description="Add \\section{} or \\subsection{} in your LaTeX to build an outline."
            className="py-4 text-ui-xs"
          />
        ) : (
          <ul className="space-y-0.5">
            {outline.map((entry, i) => {
              const indent = Math.max(0, entry.level - 2) * 12;
              const isActive = i === activeIndex;
              return (
                <li key={`${entry.line}-${entry.title}`}>
                  <button
                    type="button"
                    onClick={() => onJumpToLine(entry.line)}
                    className={`flex w-full items-baseline gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-left text-ui-xs transition-colors hover:bg-[var(--surface-hover)] ${
                      isActive
                        ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "text-[var(--foreground)]"
                    }`}
                    style={{ paddingLeft: `${8 + indent}px` }}
                  >
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-[var(--muted)]">
                      {entry.kind}
                    </span>
                    <span className="min-w-0 truncate">{entry.title}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-[var(--muted)]">
                      {entry.line}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
