"use client";

import Link from "next/link";
import { ManifoldLogo } from "@/components/ManifoldLogo";
import { CreateProjectDialog } from "@/components/dashboard/CreateProjectDialog";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ProjectTemplateId } from "@/lib/project/templates";

type Project = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  owner: { id: string; name: string | null; username: string };
  _count: { mathObjects: number; members: number };
};

function formatRelative(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [error, setError] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/projects")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setProjects(data);
        });
    }
  }, [status]);

  async function createProject(template: ProjectTemplateId) {
    setCreating(true);
    setError("");

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template }),
    });

    const data = await res.json();

    if (!res.ok) {
      setCreating(false);
      setError(data.error || "Failed to create project");
      return;
    }

    if (!data.id) {
      setCreating(false);
      setError("Unexpected response from server");
      return;
    }

    setShowCreateMenu(false);
    window.location.href = `/projects/${data.id}`;
  }

  async function saveRename(projectId: string) {
    const name = renameValue.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }

    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      const updated = await res.json();
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, name: updated.name } : p))
      );
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Failed to rename project");
    }
    setRenamingId(null);
  }

  function startRename(project: Project, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRenamingId(project.id);
    setRenameValue(project.name);
    setError("");
  }

  const userId = session?.user?.id;

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  return (
    <main className="relative min-h-screen bg-[var(--background)]">
      {creating && <LoadingOverlay message="Creating project…" fullScreen />}
      <CreateProjectDialog
        open={showCreateMenu}
        creating={creating}
        onClose={() => !creating && setShowCreateMenu(false)}
        onCreate={createProject}
      />

      <header className="border-b border-[var(--border-subtle)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <ManifoldLogo size={32} />
            <div>
              <h1 className="text-ui-xl font-semibold tracking-tight">Manifold</h1>
              <p className="text-ui-xs text-[var(--muted)]">Research manuscripts</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/profile"
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <UserAvatar
                userId={session?.user?.id}
                name={session?.user?.name}
                size="sm"
              />
              <span className="text-ui-sm text-[var(--muted)]">
                {session?.user?.name || session?.user?.email}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-ui-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-ui-lg font-semibold">Your manuscripts</h2>
            <p className="mt-1 text-ui-sm text-[var(--muted)]">
              Collaborative LaTeX writing with structured theorem objects
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowCreateMenu(true)}
            disabled={creating}
          >
            New project
          </Button>
        </div>

        {error && (
          <p className="mb-4 rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3 py-2 text-ui-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {projects.length === 0 ? (
          <div className="text-center">
            <EmptyState
              title="No manuscripts yet"
              description="Create a project from a template to start writing."
            />
            <Button
              variant="primary"
              size="md"
              className="mt-4"
              onClick={() => setShowCreateMenu(true)}
            >
              New project
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface)]">
            {projects.map((p) => {
              const canRename = p.owner.id === userId;
              const isRenaming = renamingId === p.id;

              return (
                <div
                  key={p.id}
                  className="group relative px-5 py-4 transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <Link href={`/projects/${p.id}`} className="block">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        {isRenaming ? (
                          <form
                            className="flex gap-2"
                            onClick={(e) => e.preventDefault()}
                            onSubmit={(e) => {
                              e.preventDefault();
                              saveRename(p.id);
                            }}
                          >
                            <Input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              className="text-ui-md font-semibold"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                            />
                            <Button type="submit" variant="primary" size="sm">
                              Save
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setRenamingId(null)}
                            >
                              Cancel
                            </Button>
                          </form>
                        ) : (
                          <h3 className="text-ui-md font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)]">
                            {p.name}
                          </h3>
                        )}
                        {p.description && !isRenaming && (
                          <p className="mt-0.5 line-clamp-1 text-ui-sm text-[var(--muted)]">
                            {p.description}
                          </p>
                        )}
                        {!isRenaming && (
                          <p className="mt-2 text-ui-xs text-[var(--muted)]">
                            main.tex · {p._count.mathObjects} object
                            {p._count.mathObjects !== 1 ? "s" : ""} ·{" "}
                            {p._count.members} collaborator
                            {p._count.members !== 1 ? "s" : ""} · updated{" "}
                            {formatRelative(p.updatedAt)}
                          </p>
                        )}
                      </div>
                      {!isRenaming && (
                        <span className="shrink-0 text-ui-xs font-medium text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
                          Open →
                        </span>
                      )}
                    </div>
                  </Link>
                  {canRename && !isRenaming && (
                    <button
                      type="button"
                      onClick={(e) => startRename(p, e)}
                      className="absolute right-4 top-4 rounded p-1.5 text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--background)] hover:text-[var(--foreground)] group-hover:opacity-100"
                      title="Rename project"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
