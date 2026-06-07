"use client";

import { useEffect, useState } from "react";
import { MathContent } from "../MathContent";
import { LatexPreview } from "../LatexPreview";
import { UserAvatar } from "../UserAvatar";

type Member = { id: string; name: string | null; username: string };

type Comment = {
  id: string;
  content: string;
  resolved: boolean;
  author: { id: string; name: string | null; username: string };
  replies?: Comment[];
};

type ObjectDetail = {
  id: string;
  type: string;
  label: string | null;
  title: string | null;
  rawLatex: string;
  proofLatex: string | null;
  startLine: number;
  endLine: number;
  status: string;
  updatedAt: string;
  assignee: Member | null;
  assigneeId: string | null;
  citedIn: Array<{ citation: { key: string; title: string | null } }>;
  depsFrom: Array<{ to: { id: string; label: string | null; type: string } }>;
  thread?: { comments: Comment[] };
};

const STATUSES = [
  "DRAFT", "NEEDS_PROOF", "PROOF_INCOMPLETE", "PROOF_COMPLETE",
  "NEEDS_REVIEW", "REVIEWED", "SUBMITTED_READY", "DEPRECATED",
];

type HistoryEntry = {
  id: string;
  reason: string;
  createdAt: string;
  user?: { name: string | null; username: string };
};

type Props = {
  object: ObjectDetail | null;
  projectId: string;
  members: Member[];
  onJumpToSource: (line: number) => void;
  onRefresh: () => void;
  canEdit: boolean;
};

export function ObjectPanel({
  object,
  projectId,
  members,
  onJumpToSource,
  onRefresh,
  canEdit,
}: Props) {
  const [comment, setComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (!object) return;
    fetch(`/api/projects/${projectId}/objects/${object.id}/history`)
      .then((r) => r.json())
      .then(setHistory);
  }, [object, projectId]);

  if (!object) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
        Select a theorem object to view its thread
      </div>
    );
  }

  async function postComment(parentId?: string) {
    if (!comment.trim() || submitting) return;
    setSubmitting(true);
    await fetch(`/api/projects/${projectId}/objects/${object!.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: comment, parentId }),
    });
    setComment("");
    setReplyingTo(null);
    setSubmitting(false);
    onRefresh();
  }

  function handleCommentKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    parentId?: string
  ) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      postComment(parentId);
    }
  }

  const isDeprecated = object.status === "DEPRECATED";

  async function toggleResolved(commentId: string, resolved: boolean) {
    await fetch(`/api/projects/${projectId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !resolved }),
    });
    onRefresh();
  }

  async function updateField(data: Record<string, unknown>) {
    await fetch(`/api/projects/${projectId}/objects/${object!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    onRefresh();
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {isDeprecated && (
        <div className="border-b border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
          Removed from LaTeX source — discussion is preserved. Re-add the environment to restore this object.
        </div>
      )}
      <div className="border-b border-[var(--border)] p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
              {object.type}
            </span>
            {object.title && <h3 className="text-sm font-semibold">{object.title}</h3>}
            {object.label && (
              <code className="text-xs text-[var(--muted)]">{object.label}</code>
            )}
          </div>
          {canEdit && (
            <select
              value={object.status}
              onChange={(e) => updateField({ status: e.target.value })}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
          )}
        </div>

        {canEdit && members.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">Assignee:</span>
            <select
              value={object.assigneeId || ""}
              onChange={(e) =>
                updateField({ assigneeId: e.target.value || null })
              }
              className="flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.username}
                </option>
              ))}
            </select>
          </div>
        )}

        {object.assignee && (
          <div className="mt-2 flex items-center gap-2">
            <UserAvatar
              userId={object.assignee.id}
              name={object.assignee.name}
              username={object.assignee.username}
              size="sm"
            />
            <span className="text-xs">{object.assignee.name || object.assignee.username}</span>
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <button
            onClick={() => onJumpToSource(object.startLine)}
            className="text-xs text-[var(--accent)] hover:underline"
            title={isDeprecated ? "Lines may no longer match the current source" : undefined}
          >
            {isDeprecated ? "View last known source" : "Jump to"} L{object.startLine}–{object.endLine}
          </button>
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs text-[var(--muted)] hover:underline"
          >
            {showRaw ? "Preview" : "Raw LaTeX"}
          </button>
        </div>

        <div className="mt-2 max-h-32 overflow-y-auto rounded bg-[var(--background)] p-2 text-sm">
          {showRaw ? (
            <pre className="whitespace-pre-wrap font-mono text-xs">{object.rawLatex}</pre>
          ) : (
            <LatexPreview rawLatex={object.rawLatex} />
          )}
        </div>

        {object.proofLatex && (
          <div className="mt-2">
            <span className="text-xs text-[var(--muted)]">Proof:</span>
            <div className="mt-1 rounded bg-[var(--background)] p-2 text-sm">
              <LatexPreview rawLatex={object.proofLatex} />
            </div>
          </div>
        )}

        {object.citedIn.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {object.citedIn.map((c) => (
              <span key={c.citation.key} className="rounded bg-[var(--surface-hover)] px-2 py-0.5 text-xs">
                @{c.citation.key}
              </span>
            ))}
          </div>
        )}

        {object.depsFrom.length > 0 && (
          <div className="mt-2 text-xs text-[var(--muted)]">
            References:{" "}
            {object.depsFrom.map((d) => d.to.label || d.to.type).join(", ")}
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-2">
            <span className="text-xs font-medium text-[var(--muted)]">Recent changes</span>
            {history.slice(0, 3).map((h) => (
              <div key={h.id} className="text-xs text-[var(--muted)]">
                {h.reason} · {new Date(h.createdAt).toLocaleDateString()}
                {h.user && ` · ${h.user.name || h.user.username}`}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <h4 className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">Discussion</h4>
        {object.thread?.comments.map((c) => (
          <div
            key={c.id}
            className={`mb-3 rounded border p-2 ${
              c.resolved ? "border-[var(--border)] opacity-60" : "border-[var(--accent-dim)]"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserAvatar userId={c.author.id} name={c.author.name} username={c.author.username} size="sm" />
                <span className="text-xs font-medium">{c.author.name || c.author.username}</span>
              </div>
              <div className="flex gap-2">
                {canEdit && (
                  <>
                    <button
                      onClick={() => { setReplyingTo(c.id); setComment(""); }}
                      className="text-xs text-[var(--muted)] hover:text-[var(--accent)]"
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => toggleResolved(c.id, c.resolved)}
                      className="text-xs text-[var(--muted)] hover:text-[var(--accent)]"
                    >
                      {c.resolved ? "Reopen" : "Resolve"}
                    </button>
                  </>
                )}
              </div>
            </div>
            <MathContent content={c.content} />
            {c.replies?.map((r) => (
              <div key={r.id} className="ml-4 mt-2 border-l-2 border-[var(--border)] pl-2">
                <div className="flex items-center gap-2">
                  <UserAvatar userId={r.author.id} name={r.author.name} username={r.author.username} size="sm" />
                  <span className="text-xs font-medium">{r.author.name || r.author.username}</span>
                </div>
                <MathContent content={r.content} />
              </div>
            ))}
            {replyingTo === c.id && canEdit && (
              <div className="ml-4 mt-2">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => handleCommentKeyDown(e, c.id)}
                  placeholder="Write a reply... (Enter to post, Shift+Enter for newline)"
                  className="w-full resize-none rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-xs"
                  rows={2}
                />
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => postComment(c.id)}
                    disabled={submitting || !comment.trim()}
                    className="rounded bg-[var(--accent)] px-2 py-1 text-xs text-[#0f1117] disabled:opacity-50"
                  >
                    Reply
                  </button>
                  <button onClick={() => setReplyingTo(null)} className="text-xs text-[var(--muted)]">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && !replyingTo && (
        <div className="border-t border-[var(--border)] p-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => handleCommentKeyDown(e)}
            placeholder="Comment with math: $$x^2$$ or [\\int_0^1 f(x)\\,dx] — Enter to post"
            className="w-full resize-none rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
            rows={3}
          />
          <button
            onClick={() => postComment()}
            disabled={submitting || !comment.trim()}
            className="mt-2 rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[#0f1117] disabled:opacity-50"
          >
            Post comment
          </button>
        </div>
      )}
    </div>
  );
}
