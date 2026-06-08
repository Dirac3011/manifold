"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";

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
    setStatus("Pulling…");
    const res = await fetch(`/api/projects/${projectId}/git/pull`, { method: "POST" });
    const d = await res.json();
    setStatus(res.ok ? `Pulled: ${d.updated?.join(", ") || "no changes"}` : d.error);
    setLoading(false);
    if (res.ok) onSyncComplete();
    load();
  }

  async function push() {
    setLoading(true);
    setStatus("Pushing…");
    const res = await fetch(`/api/projects/${projectId}/git/push`, { method: "POST" });
    const d = await res.json();
    setStatus(res.ok ? `Pushed: ${d.pushed?.join(", ") || "none"}` : d.error);
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
      <div className="p-4">
        <EmptyState
          title="GitHub not connected"
          description="Link a repository to push and pull LaTeX source files."
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => signIn("github", { callbackUrl: window.location.href })}
          className="mt-4 w-full"
        >
          Connect GitHub
        </Button>
        {github.error && (
          <p className="mt-2 text-ui-xs text-[var(--danger)]">{github.error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 text-ui-sm">
      {link ? (
        <>
          <div className="rounded-[var(--radius-md)] bg-[var(--background)] px-3 py-2.5">
            <p className="font-mono text-ui-sm font-medium">
              {link.repoOwner}/{link.repoName}
            </p>
            <p className="mt-1 text-ui-xs text-[var(--muted)]">
              {link.branch}
              {link.rootPath && ` · ${link.rootPath}`}
            </p>
            {link.lastPullAt && (
              <p className="text-ui-xs text-[var(--muted)]">
                Last pull: {new Date(link.lastPullAt).toLocaleString()}
              </p>
            )}
            {link.lastPushAt && (
              <p className="text-ui-xs text-[var(--muted)]">
                Last push: {new Date(link.lastPushAt).toLocaleString()}
              </p>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={pull} disabled={loading} className="flex-1">
                Pull
              </Button>
              <Button variant="primary" size="sm" onClick={push} disabled={loading} className="flex-1">
                Push
              </Button>
            </div>
          )}
          {isOwner && (
            <Button variant="ghost" size="sm" onClick={unlink} className="text-[var(--danger)]">
              Unlink repository
            </Button>
          )}
        </>
      ) : isOwner ? (
        <>
          <p className="text-ui-xs text-[var(--muted)]">Link this project to a GitHub repository</p>
          <Select
            value={selectedRepo}
            onChange={(e) => {
              setSelectedRepo(e.target.value);
              const repo = github.repos.find((r) => `${r.owner}/${r.name}` === e.target.value);
              if (repo) setBranch(repo.defaultBranch);
            }}
          >
            <option value="">Select repository…</option>
            {github.repos.map((r) => (
              <option key={r.fullName} value={`${r.owner}/${r.name}`}>
                {r.fullName}
              </option>
            ))}
          </Select>
          <Input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="Branch (main)"
            className="text-ui-xs"
          />
          <Input
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
            placeholder="Subfolder (optional)"
            className="text-ui-xs"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={linkRepo}
            disabled={loading || !selectedRepo}
            className="w-full"
          >
            Link repository
          </Button>
        </>
      ) : (
        <EmptyState
          title="No repository linked"
          description="The project owner can link a GitHub repository."
        />
      )}
      {status && <p className="text-ui-xs text-[var(--muted)]">{status}</p>}
    </div>
  );
}
