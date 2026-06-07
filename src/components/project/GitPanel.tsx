"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

type GitLink = {
  repoOwner: string;
  repoName: string;
  branch: string;
  rootPath: string;
  lastPullAt: string | null;
  lastPushAt: string | null;
};

type Repo = {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
};

type Props = {
  projectId: string;
  isOwner: boolean;
  canEdit: boolean;
  onSyncComplete: () => void;
};

export function GitPanel({ projectId, isOwner, canEdit, onSyncComplete }: Props) {
  const [github, setGithub] = useState<{
    connected: boolean;
    repos: Repo[];
    error?: string;
  }>({ connected: false, repos: [] });
  const [link, setLink] = useState<GitLink | null>(null);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [rootPath, setRootPath] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  function load() {
    fetch(`/api/projects/${projectId}/git`)
      .then((r) => r.json())
      .then((d) => setLink(d.link));
    fetch("/api/integrations/github")
      .then((r) => r.json())
      .then(setGithub);
  }

  useEffect(() => { load(); }, [projectId]);

  async function linkRepo() {
    if (!selectedRepo) return;
    const [owner, name] = selectedRepo.split("/");
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/git`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoOwner: owner, repoName: name, branch, rootPath }),
    });
    if (res.ok) {
      setStatus("Repository linked");
      load();
    } else {
      const d = await res.json();
      setStatus(d.error || "Failed to link");
    }
    setLoading(false);
  }

  async function pull() {
    setLoading(true);
    setStatus("Pulling...");
    const res = await fetch(`/api/projects/${projectId}/git/pull`, { method: "POST" });
    const d = await res.json();
    setStatus(res.ok ? `Pulled: ${d.updated?.join(", ") || "no changes"}` : d.error);
    setLoading(false);
    if (res.ok) onSyncComplete();
    load();
  }

  async function push() {
    setLoading(true);
    setStatus("Pushing...");
    const res = await fetch(`/api/projects/${projectId}/git/push`, { method: "POST" });
    const d = await res.json();
    setStatus(res.ok ? `Pushed: ${d.pushed?.join(", ")}` : d.error);
    setLoading(false);
    if (res.ok) load();
  }

  async function unlink() {
    await fetch(`/api/projects/${projectId}/git`, { method: "DELETE" });
    setLink(null);
    setStatus("Unlinked");
  }

  if (!github.connected) {
    return (
      <div className="p-3 text-sm">
        <p className="mb-3 text-[var(--muted)]">
          Sign in with GitHub to link a repository and push/pull LaTeX files.
        </p>
        <button
          onClick={() => signIn("github", { callbackUrl: window.location.href })}
          className="w-full rounded bg-[var(--accent)] py-2 text-xs font-medium text-[#0f1117]"
        >
          Connect GitHub
        </button>
        {github.error && (
          <p className="mt-2 text-xs text-[var(--danger)]">{github.error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 text-sm">
      {link ? (
        <>
          <div className="rounded border border-[var(--border)] p-2">
            <p className="font-medium">
              {link.repoOwner}/{link.repoName}
            </p>
            <p className="text-xs text-[var(--muted)]">
              branch: {link.branch}
              {link.rootPath && ` · path: ${link.rootPath}`}
            </p>
            {link.lastPullAt && (
              <p className="text-xs text-[var(--muted)]">
                Last pull: {new Date(link.lastPullAt).toLocaleString()}
              </p>
            )}
            {link.lastPushAt && (
              <p className="text-xs text-[var(--muted)]">
                Last push: {new Date(link.lastPushAt).toLocaleString()}
              </p>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={pull}
                disabled={loading}
                className="flex-1 rounded border border-[var(--border)] py-1.5 text-xs hover:bg-[var(--surface-hover)] disabled:opacity-50"
              >
                Pull
              </button>
              <button
                onClick={push}
                disabled={loading}
                className="flex-1 rounded bg-[var(--accent)] py-1.5 text-xs font-medium text-[#0f1117] disabled:opacity-50"
              >
                Push
              </button>
            </div>
          )}
          {isOwner && (
            <button onClick={unlink} className="text-xs text-[var(--danger)] hover:underline">
              Unlink repository
            </button>
          )}
        </>
      ) : isOwner ? (
        <>
          <p className="text-xs text-[var(--muted)]">Link this project to a GitHub repo</p>
          <select
            value={selectedRepo}
            onChange={(e) => {
              setSelectedRepo(e.target.value);
              const repo = github.repos.find((r) => `${r.owner}/${r.name}` === e.target.value);
              if (repo) setBranch(repo.defaultBranch);
            }}
            className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
          >
            <option value="">Select repository...</option>
            {github.repos.map((r) => (
              <option key={r.fullName} value={`${r.owner}/${r.name}`}>
                {r.fullName}
              </option>
            ))}
          </select>
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="Branch (main)"
            className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
          />
          <input
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
            placeholder="Subfolder (optional, e.g. paper)"
            className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
          />
          <button
            onClick={linkRepo}
            disabled={loading || !selectedRepo}
            className="w-full rounded bg-[var(--accent)] py-1.5 text-xs font-medium text-[#0f1117] disabled:opacity-50"
          >
            Link repository
          </button>
        </>
      ) : (
        <p className="text-xs text-[var(--muted)]">No repository linked yet.</p>
      )}
      {status && <p className="text-xs text-[var(--muted)]">{status}</p>}
    </div>
  );
}
