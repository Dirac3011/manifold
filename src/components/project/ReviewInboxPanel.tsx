"use client";

import { PanelHeader } from "@/components/ui/PanelHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatObjectType, formatStatus } from "@/lib/ui/object-styles";
import { ProjectNote } from "@/lib/discussion/types";
import { CompileErrorSummary } from "@/lib/ui/parse-compile-error";

type ObjectSummary = {
  id: string;
  type: string;
  label: string | null;
  title: string | null;
  status: string;
  startLine: number;
  thread?: {
    comments: Array<{
      id: string;
      resolved: boolean;
      content?: string;
      author?: { name: string | null; username: string };
    }>;
  } | null;
};

type InboxItem =
  | { kind: "unresolved"; objectId: string; objectLabel: string; commentId: string; preview: string; author: string }
  | { kind: "needs-review"; objectId: string; label: string; title: string | null }
  | { kind: "question"; noteId: string; preview: string; author: string }
  | { kind: "decision"; noteId: string; preview: string; author: string }
  | { kind: "mention"; noteId: string; label: string; preview: string }
  | { kind: "compile"; message: string; line: number | null };

type Props = {
  objects: ObjectSummary[];
  notes: ProjectNote[];
  compileError: CompileErrorSummary | null;
  onOpenObject: (id: string, tab?: "overview" | "discussion") => void;
  onOpenNotes: () => void;
  onJumpToLine?: (line: number) => void;
};

function buildInbox(
  objects: ObjectSummary[],
  notes: ProjectNote[],
  compileError: CompileErrorSummary | null
): InboxItem[] {
  const items: InboxItem[] = [];

  for (const o of objects) {
    if (o.status === "NEEDS_REVIEW") {
      items.push({
        kind: "needs-review",
        objectId: o.id,
        label: o.label ?? `L${o.startLine}`,
        title: o.title,
      });
    }
    for (const c of o.thread?.comments ?? []) {
      if (!c.resolved) {
        items.push({
          kind: "unresolved",
          objectId: o.id,
          objectLabel: o.label ?? o.type,
          commentId: c.id,
          preview: (c.content ?? "Unresolved comment").slice(0, 120),
          author: c.author?.name || c.author?.username || "Unknown",
        });
      }
    }
  }

  for (const n of notes) {
    if (n.noteType === "QUESTION") {
      items.push({
        kind: "question",
        noteId: n.id,
        preview: n.content.slice(0, 120),
        author: n.author.name || n.author.username,
      });
    }
    if (n.noteType === "DECISION") {
      items.push({
        kind: "decision",
        noteId: n.id,
        preview: n.content.slice(0, 120),
        author: n.author.name || n.author.username,
      });
    }
    for (const label of n.mentions) {
      items.push({
        kind: "mention",
        noteId: n.id,
        label,
        preview: n.content.slice(0, 80),
      });
    }
  }

  if (compileError) {
    items.push({
      kind: "compile",
      message: compileError.message,
      line: compileError.line,
    });
  }

  return items;
}

export function ReviewInboxPanel({
  objects,
  notes,
  compileError,
  onOpenObject,
  onOpenNotes,
  onJumpToLine,
}: Props) {
  const items = buildInbox(objects, notes, compileError);

  return (
    <div className="flex h-full flex-col bg-[var(--surface)]">
      <PanelHeader
        title="Review"
        subtitle={`${items.length} item${items.length !== 1 ? "s" : ""} need attention`}
      />

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <EmptyState
            title="Nothing pending"
            description="Unresolved comments, review requests, and open questions will appear here."
          />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {items.map((item, i) => (
              <li key={`${item.kind}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.kind === "unresolved" || item.kind === "needs-review") {
                      onOpenObject(
                        item.objectId,
                        item.kind === "unresolved" ? "discussion" : "overview"
                      );
                    } else if (item.kind === "compile" && item.line && onJumpToLine) {
                      onJumpToLine(item.line);
                    } else {
                      onOpenNotes();
                    }
                  }}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
                >
                  {item.kind === "unresolved" && (
                    <>
                      <StatusPill tone="warning" dot>
                        Unresolved comment
                      </StatusPill>
                      <p className="mt-1 text-ui-sm font-medium">
                        {formatObjectType(
                          objects.find((o) => o.id === item.objectId)?.type ?? ""
                        )}{" "}
                        <span className="font-mono text-ui-xs">{item.objectLabel}</span>
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-ui-xs text-[var(--muted)]">
                        {item.author}: {item.preview}
                      </p>
                    </>
                  )}
                  {item.kind === "needs-review" && (
                    <>
                      <StatusPill tone="warning">Needs review</StatusPill>
                      <p className="mt-1 text-ui-sm">
                        <span className="font-mono text-ui-xs">{item.label}</span>
                        {item.title && ` — ${item.title}`}
                      </p>
                    </>
                  )}
                  {item.kind === "question" && (
                    <>
                      <StatusPill tone="accent">Open question</StatusPill>
                      <p className="mt-1 line-clamp-2 text-ui-xs text-[var(--muted)]">
                        {item.author}: {item.preview}
                      </p>
                    </>
                  )}
                  {item.kind === "decision" && (
                    <>
                      <StatusPill tone="success">Decision</StatusPill>
                      <p className="mt-1 line-clamp-2 text-ui-xs text-[var(--muted)]">
                        {item.author}: {item.preview}
                      </p>
                    </>
                  )}
                  {item.kind === "mention" && (
                    <>
                      <StatusPill tone="accent">Mention</StatusPill>
                      <p className="mt-1 text-ui-sm font-mono">@{item.label}</p>
                      <p className="line-clamp-1 text-ui-xs text-[var(--muted)]">
                        {item.preview}
                      </p>
                    </>
                  )}
                  {item.kind === "compile" && (
                    <>
                      <StatusPill tone="danger" dot>
                        Compile issue
                      </StatusPill>
                      <p className="mt-1 text-ui-xs text-[var(--foreground)]">
                        {item.message}
                      </p>
                      {item.line && (
                        <p className="text-ui-xs text-[var(--muted)]">Line {item.line}</p>
                      )}
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
