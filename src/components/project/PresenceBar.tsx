"use client";

import { UserAvatar } from "../UserAvatar";
import type { CollabConnectionStatus } from "@/lib/collab/useCollabSession";
import type { PresenceState } from "@/lib/collab/types";

type Props = {
  presence: PresenceState[];
  currentUserId?: string;
  activeFileId: string | null;
  status?: CollabConnectionStatus;
  error?: string | null;
};

export function PresenceBar({
  presence,
  currentUserId,
  activeFileId,
  status = "disabled",
  error,
}: Props) {
  if (status === "connecting") {
    return (
      <div className="flex items-center gap-1.5 text-ui-xs text-[var(--muted)]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500/70" />
        Connecting…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="flex max-w-[min(280px,35vw)] items-center gap-1.5 text-ui-xs text-[var(--danger)]"
        title={error ?? undefined}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--danger)]" />
        <span className="truncate">{error ?? "Live editing unavailable"}</span>
      </div>
    );
  }

  if (status !== "live") {
    return (
      <div className="flex items-center gap-1.5 text-ui-xs text-[var(--muted)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted)]/50" />
        Offline
      </div>
    );
  }

  const onDocument = Array.from(
    new Map(
      presence
        .filter((p) => activeFileId && p.fileId === activeFileId)
        .map((p) => [p.userId, p] as const)
    ).values()
  );

  if (onDocument.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-ui-xs text-[var(--muted)]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" />
        Live · only you
      </div>
    );
  }

  return (
    <div className="flex max-w-[min(320px,40vw)] items-center gap-2">
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" />
        <span className="hidden text-ui-xs font-medium text-[var(--foreground)] sm:inline">
          Live
        </span>
      </div>
      <div className="flex min-w-0 items-center -space-x-2">
        {onDocument.map((p) => {
          const isYou = p.userId === currentUserId;
          const label = p.name || p.username;
          return (
            <span
              key={p.socketId}
              title={
                isYou
                  ? "You"
                  : `${label}${p.line ? ` · line ${p.line}` : ""}`
              }
              className="relative inline-flex rounded-full ring-2 ring-[var(--surface)]"
            >
              <UserAvatar
                userId={p.userId}
                name={p.name}
                username={p.username}
                size="sm"
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--surface)]"
                style={{ backgroundColor: p.color }}
              />
            </span>
          );
        })}
      </div>
      <span className="min-w-0 truncate text-ui-xs text-[var(--muted)]">
        {onDocument
          .map((p) => {
            const label = p.name || p.username;
            if (p.userId === currentUserId) return "you";
            return p.line ? `${label} (L${p.line})` : label;
          })
          .join(", ")}
      </span>
    </div>
  );
}
