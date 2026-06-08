"use client";

import Link from "next/link";
import { ManifoldLogo } from "@/components/ManifoldLogo";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";

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
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/projects")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setProjects(data);
        });
    }
  }, [status]);

  async function createProject() {
    const name = newName.trim();
    if (!name) {
      setError("Enter a project name");
      return;
    }
    setCreating(true);
    setError("");

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
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

    setNewName("");
    window.location.href = `/projects/${data.id}`;
  }

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
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setError("");
              }}
              placeholder="New project title"
              className="min-w-[200px]"
              onKeyDown={(e) => e.key === "Enter" && createProject()}
            />
            <Button
              variant="primary"
              size="md"
              onClick={createProject}
              disabled={creating || !newName.trim()}
            >
              {creating ? "Creating…" : "New project"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3 py-2 text-ui-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {projects.length === 0 ? (
          <EmptyState
            title="No manuscripts yet"
            description="Create a project to start writing. A sample paper with theorem objects will be ready to explore."
          />
        ) : (
          <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface)]">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group block px-5 py-4 transition-colors hover:bg-[var(--surface-hover)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-ui-md font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)]">
                      {p.name}
                    </h3>
                    {p.description && (
                      <p className="mt-0.5 line-clamp-1 text-ui-sm text-[var(--muted)]">
                        {p.description}
                      </p>
                    )}
                    <p className="mt-2 text-ui-xs text-[var(--muted)]">
                      main.tex · {p._count.mathObjects} object
                      {p._count.mathObjects !== 1 ? "s" : ""} ·{" "}
                      {p._count.members} collaborator
                      {p._count.members !== 1 ? "s" : ""} · updated{" "}
                      {formatRelative(p.updatedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-ui-xs font-medium text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
                    Open →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
