"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { UserAvatar } from "@/components/UserAvatar";

type Project = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  owner: { id: string; name: string | null; username: string };
  _count: { mathObjects: number; members: number };
};

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
        Loading...
      </div>
    );
  }

  return (
    <main className="relative min-h-screen">
      {creating && <LoadingOverlay message="Creating project..." fullScreen />}
      <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold">Manifold</h1>
        <div className="flex items-center gap-4">
          <Link href="/profile" className="flex items-center gap-2 hover:opacity-80">
            <UserAvatar
              userId={session?.user?.id}
              name={session?.user?.name}
              size="sm"
            />
            <span className="text-sm text-[var(--muted)]">
              {session?.user?.name || session?.user?.email}
            </span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">Your projects</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setError(""); }}
              placeholder="New project name"
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
              onKeyDown={(e) => e.key === "Enter" && createProject()}
            />
            <button
              onClick={createProject}
              disabled={creating || !newName.trim()}
              className="rounded bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[#0f1117] disabled:opacity-50"
            >
              {creating ? "Creating..." : "New project"}
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded border border-[var(--danger)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <div className="grid gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--accent)]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.description && (
                    <p className="mt-1 text-sm text-[var(--muted)]">{p.description}</p>
                  )}
                </div>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(p.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-[var(--muted)]">
                <span>{p._count.mathObjects} objects</span>
                <span>{p._count.members} members</span>
                <span>by {p.owner.name || p.owner.username}</span>
              </div>
            </Link>
          ))}
          {projects.length === 0 && (
            <p className="text-center text-[var(--muted)]">
              No projects yet. Create one to get started with a sample paper.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
