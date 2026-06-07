"use client";

import { useEffect, useState } from "react";
import { UserAvatar } from "../UserAvatar";

type MemberUser = {
  id: string;
  name: string | null;
  username: string;
  email: string;
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
  const [invite, setInvite] = useState("");
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function load() {
    fetch(`/api/projects/${projectId}/members`)
      .then((r) => r.json())
      .then((data) => {
        setOwner(data.owner);
        setMembers(data.members);
      });
  }

  useEffect(() => { load(); }, [projectId]);

  async function sendInvite() {
    if (!invite.trim()) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrUsername: invite, role }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Invite failed");
    } else {
      setInvite("");
      load();
    }
    setLoading(false);
  }

  return (
    <div className="p-3 text-sm">
      {owner && (
        <div className="mb-3 flex items-center gap-2 rounded border border-[var(--border)] p-2">
          <UserAvatar userId={owner.id} name={owner.name} username={owner.username} size="sm" />
          <div>
            <p className="text-xs font-medium">{owner.name || owner.username}</p>
            <p className="text-xs text-[var(--muted)]">Owner · {owner.email}</p>
          </div>
        </div>
      )}

      {members
        .filter((m) => m.user.id !== owner?.id)
        .map((m) => (
          <div key={m.id} className="mb-2 flex items-center gap-2 rounded border border-[var(--border)] p-2">
            <UserAvatar userId={m.user.id} name={m.user.name} username={m.user.username} size="sm" />
            <div>
              <p className="text-xs font-medium">{m.user.name || m.user.username}</p>
              <p className="text-xs text-[var(--muted)]">
                {m.role.toLowerCase()} · {m.user.email}
              </p>
            </div>
          </div>
        ))}

      {isOwner && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <p className="mb-2 text-xs font-medium text-[var(--muted)]">Invite collaborator</p>
          {error && <p className="mb-2 text-xs text-[var(--danger)]">{error}</p>}
          <input
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder="Email or username"
            className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "EDITOR" | "VIEWER")}
            className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
          >
            <option value="EDITOR">Editor</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <button
            onClick={sendInvite}
            disabled={loading}
            className="w-full rounded bg-[var(--accent)] py-1.5 text-xs font-medium text-[#0f1117] disabled:opacity-50"
          >
            {loading ? "Inviting..." : "Invite"}
          </button>
        </div>
      )}
    </div>
  );
}
