"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/UserAvatar";

type Profile = {
  id: string;
  email: string;
  username: string;
  name: string | null;
  bio: string | null;
};

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarKey, setAvatarKey] = useState(0);
  const [accounts, setAccounts] = useState({ google: false, github: false });

  useEffect(() => {
    fetch("/api/user/accounts")
      .then((r) => r.json())
      .then(setAccounts);
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setName(data.name || "");
        setBio(data.bio || "");
      });
  }, []);

  async function saveProfile() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, bio }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
      setSaving(false);
      return;
    }
    const updated = await res.json();
    setProfile(updated);
    await update({ name: updated.name });
    setMessage("Profile saved");
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    setError("");
    const form = new FormData();
    form.append("avatar", file);
    const res = await fetch("/api/user/avatar", { method: "POST", body: form });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Upload failed");
    } else {
      setAvatarKey((k) => k + 1);
      setMessage("Photo updated");
      setTimeout(() => setMessage(""), 3000);
    }
    setUploading(false);
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Loading...
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <Link href="/dashboard" className="text-sm text-[var(--muted)] hover:text-[var(--accent)]">
          ← Back to projects
        </Link>
        <h1 className="text-lg font-semibold">Profile</h1>
        <div className="w-24" />
      </header>

      <div className="mx-auto max-w-lg px-6 py-8">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="mb-6 flex items-center gap-4">
            <UserAvatar
              key={avatarKey}
              userId={profile.id}
              name={name}
              username={profile.username}
              size="lg"
            />
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Change photo"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                }}
              />
              <p className="mt-1 text-xs text-[var(--muted)]">Max 2 MB</p>
            </div>
          </div>

          {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}
          {message && <p className="mb-4 text-sm text-[var(--success)]">{message}</p>}

          <label className="mb-4 block">
            <span className="text-xs text-[var(--muted)]">Display name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </label>

          <label className="mb-4 block">
            <span className="text-xs text-[var(--muted)]">Username</span>
            <input
              value={profile.username}
              disabled
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm opacity-60"
            />
          </label>

          <label className="mb-4 block">
            <span className="text-xs text-[var(--muted)]">Email</span>
            <input
              value={profile.email}
              disabled
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm opacity-60"
            />
          </label>

          <label className="mb-6 block">
            <span className="text-xs text-[var(--muted)]">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Research interests, affiliation..."
              className="mt-1 w-full resize-none rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </label>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[#0f1117] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>

          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <p className="mb-2 text-xs font-medium text-[var(--muted)]">Connected accounts</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Google</span>
                {accounts.google ? (
                  <span className="text-xs text-[var(--success)]">Connected</span>
                ) : (
                  <button
                    onClick={() => signIn("google", { callbackUrl: "/profile" })}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    Connect
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>GitHub</span>
                {accounts.github ? (
                  <span className="text-xs text-[var(--success)]">Connected</span>
                ) : (
                  <button
                    onClick={() => signIn("github", { callbackUrl: "/profile" })}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
