"use client";

import { useEffect, useRef, useState } from "react";
import { LatexPreview } from "../LatexPreview";
import { UserAvatar } from "../UserAvatar";
import { DiscussionEntry } from "../discussion/DiscussionEntry";
import { NoteComposer } from "../discussion/NoteComposer";
import { NoteContext, ObjectInspectTab } from "@/lib/discussion/types";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusMenu } from "@/components/ui/StatusMenu";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  formatObjectType,
  OBJECT_STATUS_OPTIONS,
  OBJECT_TYPE_STYLES,
} from "@/lib/ui/object-styles";

type Member = { id: string; name: string | null; username: string };

type Comment = {
  id: string;
  content: string;
  resolved: boolean;
  createdAt?: string;
  author: { id: string; name: string | null; username: string };
  replies?: Comment[];
};

export type ObjectDetail = {
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

function countThreadMessages(thread?: ObjectDetail["thread"]): number {
  return (
    thread?.comments.reduce(
      (n, c) => n + 1 + (c.replies?.length ?? 0),
      0
    ) ?? 0
  );
}

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
  inspectTab?: ObjectInspectTab;
  onInspectTabChange?: (tab: ObjectInspectTab) => void;
  showTabBar?: boolean;
};

export function ObjectPanel({
  object,
  projectId,
  members,
  onJumpToSource,
  onRefresh,
  canEdit,
  inspectTab = "overview",
  onInspectTabChange,
  showTabBar = true,
}: Props) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [discussionAlert, setDiscussionAlert] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const lastSeenCommentsRef = useRef<Map<string, number>>(new Map());

  const messageCount = countThreadMessages(object?.thread);

  useEffect(() => {
    if (!object) return;
    setReplyingTo(null);
    setPostError(null);
    fetch(`/api/projects/${projectId}/objects/${object.id}/history`)
      .then((r) => r.json())
      .then(setHistory);
  }, [object, projectId]);

  useEffect(() => {
    if (!object) return;

    if (inspectTab === "discussion") {
      lastSeenCommentsRef.current.set(object.id, messageCount);
      setDiscussionAlert(false);
      return;
    }

    const seen = lastSeenCommentsRef.current.get(object.id);
    if (seen === undefined) {
      lastSeenCommentsRef.current.set(object.id, messageCount);
      setDiscussionAlert(false);
      return;
    }

    if (messageCount > seen) {
      setDiscussionAlert(true);
    }
  }, [object, inspectTab, messageCount]);

  useEffect(() => {
    if (!object || inspectTab === "discussion") return;
    const timer = setInterval(() => onRefresh(), 12000);
    return () => clearInterval(timer);
  }, [object?.id, inspectTab, onRefresh]);

  if (!object) {
    return (
      <EmptyState
        title="No object selected"
        description="Select a theorem, lemma, or definition from the outline to view its statement and discussion."
        className="h-full"
      />
    );
  }

  async function postComment(data: { content: string; context: NoteContext }) {
    setSubmitting(true);
    setPostError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/objects/${object!.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: data.content,
            parentId: replyingTo ?? undefined,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err.error === "string" ? err.error : "Failed to post comment"
        );
      }
      setReplyingTo(null);
      onRefresh();
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Failed to post comment");
      throw e;
    } finally {
      setSubmitting(false);
    }
  }

  const isDeprecated = object.status === "DEPRECATED";
  const typeStyle = OBJECT_TYPE_STYLES[object.type];

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

  const unresolvedCount =
    object.thread?.comments.filter((c) => !c.resolved).length ?? 0;

  const showOverview = inspectTab === "overview";
  const showDiscussion = inspectTab === "discussion";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--surface)]">
      {isDeprecated && (
        <div className="border-b border-[var(--warning)]/30 bg-[var(--warning)]/8 px-4 py-2 text-ui-xs text-[var(--warning)]">
          Removed from source — discussion preserved. Re-add the environment to restore.
        </div>
      )}

      {showTabBar && onInspectTabChange && (
        <div className="flex shrink-0 border-b border-[var(--border-subtle)]">
          {(["overview", "discussion"] as ObjectInspectTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onInspectTabChange(tab)}
              className={`flex-1 px-3 py-2 text-ui-xs font-medium transition-colors ${
                inspectTab === tab
                  ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <span className="relative inline-flex items-center gap-1">
                {tab === "overview" ? "Overview" : "Discussion"}
                {tab === "discussion" && discussionAlert && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-[var(--danger)]"
                    title="New discussion messages"
                  />
                )}
                {tab === "discussion" && unresolvedCount > 0 && (
                  <span className="text-[var(--warning)]">({unresolvedCount})</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {showOverview && (
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-[var(--border-subtle)] px-4 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-ui-xs font-semibold uppercase tracking-wider ${typeStyle?.text ?? "text-[var(--muted)]"}`}
              >
                {formatObjectType(object.type)}
              </span>
              {object.label && (
                <code className="font-mono text-ui-xs text-[var(--muted)]">
                  {object.label}
                </code>
              )}
              <StatusMenu
                value={object.status}
                options={OBJECT_STATUS_OPTIONS}
                onChange={(status) => updateField({ status })}
                disabled={!canEdit}
              />
            </div>
            {object.title && (
              <h2 className="mt-1.5 text-ui-lg font-semibold leading-snug text-[var(--foreground)]">
                {object.title}
              </h2>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-ui-xs text-[var(--muted)]">
            <button
              type="button"
              onClick={() => onJumpToSource(object.startLine)}
              className="text-[var(--accent)] hover:underline"
            >
              Lines {object.startLine}–{object.endLine}
            </button>
            {object.assignee && (
              <span className="flex items-center gap-1.5">
                <UserAvatar
                  userId={object.assignee.id}
                  name={object.assignee.name}
                  username={object.assignee.username}
                  size="sm"
                />
                {object.assignee.name || object.assignee.username}
              </span>
            )}
            {canEdit && members.length > 0 && (
              <Select
                value={object.assigneeId || ""}
                onChange={(e) =>
                  updateField({ assigneeId: e.target.value || null })
                }
                className="w-auto"
                aria-label="Assignee"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.username}
                  </option>
                ))}
              </Select>
            )}
            <button
              type="button"
              onClick={() => setShowRaw(!showRaw)}
              className="hover:text-[var(--foreground)]"
            >
              {showRaw ? "Rendered view" : "Raw LaTeX"}
            </button>
          </div>

          {/* Statement */}
          <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--background)] px-4 py-3">
            {showRaw ? (
              <pre className="whitespace-pre-wrap font-mono text-ui-xs leading-relaxed text-[var(--foreground)]">
                {object.rawLatex}
              </pre>
            ) : (
              <LatexPreview rawLatex={object.rawLatex} />
            )}
          </div>

          {object.proofLatex && (
            <div className="mt-4">
              <SectionHeader className="mb-2">Proof</SectionHeader>
              <div className="rounded-[var(--radius-md)] bg-[var(--background)] px-4 py-3">
                <LatexPreview rawLatex={object.proofLatex} />
              </div>
            </div>
          )}

          {(object.depsFrom.length > 0 || object.citedIn.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-4 text-ui-xs">
              {object.depsFrom.length > 0 && (
                <div>
                  <SectionHeader className="mb-1">References</SectionHeader>
                  <p className="text-[var(--muted)]">
                    {object.depsFrom.map((d) => d.to.label || d.to.type).join(", ")}
                  </p>
                </div>
              )}
              {object.citedIn.length > 0 && (
                <div>
                  <SectionHeader className="mb-1">Citations</SectionHeader>
                  <div className="flex flex-wrap gap-1">
                    {object.citedIn.map((c) => (
                      <code
                        key={c.citation.key}
                        className="rounded-[var(--radius-sm)] bg-[var(--surface-hover)] px-1.5 py-0.5 font-mono text-[var(--accent)]"
                      >
                        {c.citation.key}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {history.length > 0 && (
            <div className="mt-3 text-ui-xs text-[var(--muted)]">
              {history.slice(0, 2).map((h) => (
                <span key={h.id} className="mr-3">
                  {h.reason} · {new Date(h.createdAt).toLocaleDateString()}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {showDiscussion && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <PanelHeader
              title="Object discussion"
              subtitle={
                unresolvedCount > 0
                  ? `${unresolvedCount} unresolved`
                  : "Review notes on this object"
              }
              className="border-none px-0 py-0"
            />

            <div className="mt-3">
              {!object.thread?.comments?.length && (
                <EmptyState
                  title="No comments yet"
                  description="Use this thread for proof review and advisor feedback."
                />
              )}
              {object.thread?.comments.map((c) => (
                <div key={c.id}>
                  <DiscussionEntry
                    author={c.author}
                    createdAt={c.createdAt ?? new Date().toISOString()}
                    content={c.content}
                    resolved={c.resolved}
                    onResolve={
                      canEdit ? () => toggleResolved(c.id, c.resolved) : undefined
                    }
                    onReply={
                      canEdit ? () => setReplyingTo(c.id) : undefined
                    }
                  />
                  {c.replies?.map((r) => (
                    <div
                      key={r.id}
                      className="ml-4 border-l border-[var(--border-subtle)] pl-3"
                    >
                      <DiscussionEntry
                        author={r.author}
                        createdAt={r.createdAt ?? new Date().toISOString()}
                        content={r.content}
                        compact
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {postError && (
            <p className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--danger)]/8 px-3 py-2 text-ui-xs text-[var(--danger)]">
              {postError}
            </p>
          )}

          {replyingTo && canEdit && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border-subtle)] bg-[var(--accent)]/6 px-3 py-1.5">
              <span className="text-ui-xs text-[var(--accent)]">Replying to comment</span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="text-ui-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="flex min-h-[min(45%,280px)] max-h-[55%] shrink-0 flex-col border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]">
            <NoteComposer
              canEdit={canEdit}
              hintText="Enter to send"
              onSubmit={postComment}
              submitting={submitting}
            />
          </div>
        </div>
      )}
    </div>
  );
}
