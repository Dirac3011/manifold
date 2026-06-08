"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { DiscussionEntry } from "../discussion/DiscussionEntry";
import { NoteComposer } from "../discussion/NoteComposer";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { NoteContext, ProjectNote, ProjectNoteType } from "@/lib/discussion/types";

type Props = {
  projectId: string;
  canEdit: boolean;
  notes: ProjectNote[];
  notesReady: boolean;
  generalChannelId: string | null;
  onNotesChange: (notes: ProjectNote[]) => void;
  onChannelId?: (channelId: string) => void;
  selectionContext?: NoteContext | null;
  onContextNavigate?: (ctx: NoteContext) => void;
  onMentionClick?: (label: string) => void;
};

export function ProjectNotesPanel({
  projectId,
  canEdit,
  notes,
  notesReady,
  generalChannelId,
  onNotesChange,
  onChannelId,
  selectionContext = null,
  onContextNavigate,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const notesRef = useRef(notes);
  const onNotesChangeRef = useRef(onNotesChange);
  notesRef.current = notes;
  onNotesChangeRef.current = onNotesChange;

  useEffect(() => {
    if (!generalChannelId) return;
    const socket = socketRef.current ?? io({ path: "/socket.io" });
    socketRef.current = socket;
    socket.emit("join-channel", { projectId, channelId: generalChannelId });

    const handler = (msg: ProjectNote & { channelId?: string }) => {
      if (msg.channelId === generalChannelId || !msg.channelId) {
        const current = notesRef.current;
        if (current.some((n) => n.id === msg.id)) return;
        onNotesChangeRef.current([...current, msg]);
      }
    };
    socket.on("channel-message", handler);

    return () => {
      socket.off("channel-message", handler);
      socket.emit("leave-channel", { projectId, channelId: generalChannelId });
    };
  }, [projectId, generalChannelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes.length]);

  const appendNote = useCallback((note: ProjectNote) => {
    const current = notesRef.current;
    if (current.some((n) => n.id === note.id)) return;
    onNotesChangeRef.current([...current, note]);
  }, []);

  async function postNote(data: { content: string; context: NoteContext }) {
    setSubmitting(true);
    setPostError(null);
    try {
      const body: Record<string, unknown> = {
        content: data.content,
        noteType: "NOTE",
      };
      if (data.context && Object.keys(data.context).length > 0) {
        body.context = data.context;
      }

      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err.error === "string" ? err.error : "Failed to send message"
        );
      }

      const note = (await res.json()) as ProjectNote;
      if (note.channelId) onChannelId?.(note.channelId);
      appendNote(note);

      const channelId = note.channelId ?? generalChannelId;
      if (channelId) {
        socketRef.current?.emit("channel-message", {
          projectId,
          channelId,
          message: { ...note, channelId },
        });
      }
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Failed to send message");
      throw e;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
      <PanelHeader title="Project Notes" subtitle="Project-level messages" />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {!notesReady ? (
            <div className="space-y-4 py-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="h-3 w-24 rounded bg-[var(--border-subtle)]" />
                  <div className="h-4 w-full rounded bg-[var(--border-subtle)]" />
                  <div className="h-4 w-4/5 rounded bg-[var(--border-subtle)]" />
                </div>
              ))}
            </div>
          ) : notes.length === 0 ? (
            <EmptyState
              title="No messages yet"
              description="Share updates and feedback for the whole manuscript."
            />
          ) : (
            notes.map((n) => (
              <DiscussionEntry
                key={n.id}
                author={n.author}
                createdAt={n.createdAt}
                content={n.content}
                noteType={n.noteType as ProjectNoteType}
                context={n.context}
                legacyChannelName={n.legacyChannelName}
                onContextClick={onContextNavigate}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {postError && (
          <p className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--danger)]/8 px-3 py-2 text-ui-xs text-[var(--danger)]">
            {postError}
          </p>
        )}

        <div className="flex min-h-[min(45%,280px)] max-h-[55%] shrink-0 flex-col border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <NoteComposer
            canEdit={canEdit}
            selectionContext={selectionContext}
            onSubmit={postNote}
            submitting={submitting}
          />
        </div>
      </div>
    </div>
  );
}
