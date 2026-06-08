"use client";

import { MathContent } from "../MathContent";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { NOTE_TYPE_LABELS, NoteContext, ProjectNoteType } from "@/lib/discussion/types";

type Author = { id: string; name: string | null; username: string };

type Props = {
  author: Author;
  createdAt: string;
  content: string;
  noteType?: ProjectNoteType;
  context?: NoteContext | null;
  legacyChannelName?: string | null;
  resolved?: boolean;
  onResolve?: () => void;
  onReply?: () => void;
  onContextClick?: (context: NoteContext) => void;
  compact?: boolean;
};

export function DiscussionEntry({
  author,
  createdAt,
  content,
  noteType = "NOTE",
  context,
  legacyChannelName,
  resolved,
  onResolve,
  onReply,
  onContextClick,
  compact,
}: Props) {
  const timestamp = new Date(createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <article
      className={`border-b border-[var(--border-subtle)] py-3 ${
        resolved ? "opacity-60" : ""
      } ${compact ? "py-2" : ""}`}
    >
      <header className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-ui-xs font-medium text-[var(--foreground)]">
          {author.name || author.username}
        </span>
        <time className="text-ui-xs text-[var(--muted)]">{timestamp}</time>
        {noteType && noteType !== "NOTE" && (
          <StatusPill tone="neutral">{NOTE_TYPE_LABELS[noteType]}</StatusPill>
        )}
        {resolved && <StatusPill tone="muted">resolved</StatusPill>}
        {legacyChannelName && (
          <span className="text-ui-xs text-[var(--muted)]">
            (legacy: {legacyChannelName})
          </span>
        )}
      </header>

      {context && Object.keys(context).length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {context.objectLabel && (
            <button
              type="button"
              onClick={() => onContextClick?.(context)}
              className="font-mono text-ui-xs text-[var(--accent)] hover:underline"
            >
              @{context.objectLabel}
            </button>
          )}
          {context.fileName && (
            <span className="text-ui-xs text-[var(--muted)]">{context.fileName}</span>
          )}
          {context.citationKey && (
            <span className="font-mono text-ui-xs text-[var(--muted)]">
              cite:{context.citationKey}
            </span>
          )}
          {context.selectedText && !context.objectLabel && (
            <span className="max-w-full truncate text-ui-xs italic text-[var(--muted)]">
              &ldquo;{context.selectedText}&rdquo;
            </span>
          )}
          {context.compileError && (
            <span className="text-ui-xs text-[var(--danger)]">compile issue</span>
          )}
        </div>
      )}

      <div className="text-ui-sm leading-relaxed">
        <MathContent content={content} />
      </div>

      {(onResolve || onReply) && (
        <footer className="mt-2 flex gap-2">
          {onReply && (
            <Button variant="ghost" size="sm" onClick={onReply}>
              Reply
            </Button>
          )}
          {onResolve && (
            <Button variant="ghost" size="sm" onClick={onResolve}>
              {resolved ? "Reopen" : "Resolve"}
            </Button>
          )}
        </footer>
      )}
    </article>
  );
}
