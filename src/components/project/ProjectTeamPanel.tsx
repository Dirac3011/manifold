"use client";

import { useEffect, useState } from "react";
import { UserAvatar } from "../UserAvatar";

const EMAIL_SETUP_URL = "https://resend.com/docs/send-with-smtp";

type MemberUser = {
  id: string;
  name: string | null;
  username: string;
  email: string;
};

type PendingInvite = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  inviteUrl: string;
};

type Props = {
  projectId: string;
  isOwner: boolean;
};

export function ProjectTeamPanel({ projectId, isOwner }: Props) {
  const [owner, setOwner] = useState<MemberUser | null>(null);
  const [members, setMembers] = useState<
    Array<{ id: string; role: string; user: MemberUser }>
  >([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [emailDeliveryEnabled, setEmailDeliveryEnabled] = useState(false);
  const [invite, setInvite] = useState("");
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [error, setError] = useState("");
  const [latestLink, setLatestLink] = useState<{
    email: string;
    url: string;
    expiresAt: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  function load() {
    fetch(`/api/projects/${projectId}/members`)
      .then((r) => r.json())
      .then((data) => {
        setOwner(data.owner);
        setMembers(data.members);
        setPendingInvites(data.pendingInvites ?? []);
        setEmailDeliveryEnabled(Boolean(data.emailDeliveryEnabled));
      });
  }

  useEffect(() => {
    load();
  }, [projectId]);

  async function copyLink(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  }

  async function createInviteLink() {
    const email = invite.trim();
    if (!email) return;
    setLoading(true);
    setError("");
    setLatestLink(null);

    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not create invite");
    } else {
      setInvite("");
      setLatestLink({
        email: data.invite.email,
        url: data.invite.inviteUrl,
        expiresAt: data.invite.expiresAt,
      });
      load();
    }
    setLoading(false);
  }

  async function sendToCollaborator(inv: PendingInvite) {
    if (!emailDeliveryEnabled) return;
    setSendingId(inv.id);
    const res = await fetch(
      `/api/projects/${projectId}/invites/${inv.id}/send`,
      { method: "POST" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not send email");
    }
    setSendingId(null);
  }

  async function cancelInvite(inviteId: string) {
    await fetch(`/api/projects/${projectId}/invites/${inviteId}`, {
      method: "DELETE",
    });
    if (latestLink) setLatestLink(null);
    load();
  }

  function InviteLinkRow({
    inv,
    showEmail,
  }: {
    inv: { id: string; email: string; expiresAt: string; inviteUrl: string };
    showEmail?: boolean;
  }) {
    return (
      <div className="mt-2 space-y-2">
        {showEmail && (
          <p className="text-ui-xs text-[var(--muted)]">
            For <span className="font-medium text-[var(--foreground)]">{inv.email}</span>
            {" · "}
            expires {new Date(inv.expiresAt).toLocaleDateString()}
          </p>
        )}
        <div className="flex gap-1">
          <input
            type="text"
            readOnly
            value={inv.inviteUrl}
            className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 font-mono text-[10px] text-[var(--foreground)]"
          />
          <button
            type="button"
            onClick={() => copyLink(inv.id, inv.inviteUrl)}
            className="shrink-0 rounded border border-[var(--border)] px-2 py-1 text-ui-xs hover:bg-[var(--surface-hover)]"
          >
            {copiedId === inv.id ? "Copied" : "Copy"}
          </button>
        </div>
        {emailDeliveryEnabled ? (
          <button
            type="button"
            onClick={() => sendToCollaborator(inv as PendingInvite)}
            disabled={sendingId === inv.id}
            className="w-full rounded border border-[var(--border)] bg-[var(--surface)] py-1.5 text-ui-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            {sendingId === inv.id ? "Sending…" : "Send to collaborator"}
          </button>
        ) : (
          <a
            href={EMAIL_SETUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Set up Resend or SMTP on the server to send invites by email"
            className="block w-full cursor-not-allowed rounded border border-[var(--border-subtle)] bg-[var(--surface-hover)]/50 py-1.5 text-center text-ui-xs font-medium text-[var(--muted)] opacity-60"
          >
            Send to collaborator
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 text-sm">
      {owner && (
        <div className="mb-3 flex items-center gap-2 rounded border border-[var(--border)] p-2">
          <UserAvatar
            userId={owner.id}
            name={owner.name}
            username={owner.username}
            size="sm"
          />
          <div>
            <p className="text-xs font-medium">{owner.name || owner.username}</p>
            <p className="text-xs text-[var(--muted)]">Owner · {owner.email}</p>
          </div>
        </div>
      )}

      {members
        .filter((m) => m.user.id !== owner?.id)
        .map((m) => (
          <div
            key={m.id}
            className="mb-2 flex items-center gap-2 rounded border border-[var(--border)] p-2"
          >
            <UserAvatar
              userId={m.user.id}
              name={m.user.name}
              username={m.user.username}
              size="sm"
            />
            <div>
              <p className="text-xs font-medium">{m.user.name || m.user.username}</p>
              <p className="text-xs text-[var(--muted)]">
                {m.role.toLowerCase()} · {m.user.email}
              </p>
            </div>
          </div>
        ))}

      {isOwner && pendingInvites.length > 0 && (
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
          <p className="mb-2 text-xs font-medium text-[var(--muted)]">
            Pending invitations
          </p>
          {pendingInvites.map((inv) => (
            <div
              key={inv.id}
              className="mb-3 rounded border border-dashed border-[var(--border)] p-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-xs font-medium">{inv.email}</p>
                <button
                  type="button"
                  onClick={() => cancelInvite(inv.id)}
                  className="shrink-0 text-ui-xs text-[var(--muted)] hover:text-[var(--danger)]"
                >
                  Cancel
                </button>
              </div>
              <InviteLinkRow inv={inv} showEmail />
            </div>
          ))}
        </div>
      )}

      {isOwner && (
        <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
          <p className="mb-1 text-xs font-medium text-[var(--muted)]">
            Invite collaborator
          </p>
          <p className="mb-2 text-ui-xs text-[var(--muted)]">
            Enter their email to get a 14-day invite link. Copy and send it yourself
            (email, Slack, etc.).
          </p>
          {error && (
            <p className="mb-2 text-xs text-[var(--danger)]">{error}</p>
          )}
          <input
            type="email"
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder="collaborator@university.edu"
            className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "EDITOR" | "VIEWER")}
            className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
          >
            <option value="EDITOR">Can edit</option>
            <option value="VIEWER">Can view & comment</option>
          </select>
          <button
            type="button"
            onClick={createInviteLink}
            disabled={loading || !invite.trim()}
            className="w-full rounded bg-[var(--accent)] py-1.5 text-xs font-medium text-[#0f1117] disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create invitation link"}
          </button>

          {latestLink && (
            <div className="mt-3 rounded border border-[var(--accent)]/25 bg-[var(--accent)]/5 p-2">
              <p className="text-ui-xs font-medium text-[var(--foreground)]">
                Invitation link ready
              </p>
              <InviteLinkRow
                inv={{
                  id: "latest",
                  email: latestLink.email,
                  expiresAt: latestLink.expiresAt,
                  inviteUrl: latestLink.url,
                }}
                showEmail
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
