"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type InvitePreview = {
  projectId: string;
  projectName: string;
  role: string;
  email: string;
  expiresAt: string;
  inviter: { name: string | null; username: string };
};

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const { data: session, status } = useSession();

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const callbackUrl = `/invite/${token}`;

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Invitation not found");
        }
        return res.json();
      })
      .then(setInvite)
      .catch((e) =>
        setLoadError(e instanceof Error ? e.message : "Invitation not found")
      );
  }, [token]);

  const accept = useCallback(async () => {
    setAccepting(true);
    setAcceptError(null);
    const res = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAcceptError(typeof data.error === "string" ? data.error : "Could not accept invite");
      setAccepting(false);
      return;
    }
    router.push(`/projects/${data.projectId}`);
  }, [token, router]);

  const inviterLabel = invite
    ? invite.inviter.name || invite.inviter.username
    : "";
  const roleLabel =
    invite?.role === "VIEWER" ? "view and comment" : "edit";

  const sessionEmail = session?.user?.email?.toLowerCase();
  const inviteEmail = invite?.email.toLowerCase();
  const emailMatches =
    !!sessionEmail && !!inviteEmail && sessionEmail === inviteEmail;

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-ui-lg font-semibold">Invitation unavailable</h1>
          <p className="mt-2 text-ui-sm text-[var(--muted)]">{loadError}</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block text-ui-sm text-[var(--accent)] hover:underline"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Loading invitation…
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-ui-xs font-medium uppercase tracking-wider text-[var(--accent)]">
          Manifold invitation
        </p>
        <h1 className="mt-2 text-ui-xl font-semibold leading-snug">
          Join “{invite.projectName}”
        </h1>
        <p className="mt-3 text-ui-sm text-[var(--muted)]">
          <strong className="text-[var(--foreground)]">{inviterLabel}</strong>{" "}
          invited you to {roleLabel} on this manuscript.
        </p>
        <p className="mt-2 text-ui-xs text-[var(--muted)]">
          Invitation sent to{" "}
          <span className="font-medium text-[var(--foreground)]">{invite.email}</span>
        </p>

        {acceptError && (
          <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3 py-2 text-ui-xs text-[var(--danger)]">
            {acceptError}
          </p>
        )}

        <div className="mt-6 space-y-3">
          {status === "loading" && (
            <p className="text-ui-sm text-[var(--muted)]">Checking sign-in…</p>
          )}

          {status === "authenticated" && emailMatches && (
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={accept}
              disabled={accepting}
            >
              {accepting ? "Joining…" : "Accept invitation"}
            </Button>
          )}

          {status === "authenticated" && !emailMatches && (
            <>
              <p className="text-ui-sm text-[var(--warning)]">
                You’re signed in as {session?.user?.email}. Sign in as{" "}
                {invite.email} to accept.
              </p>
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}&email=${encodeURIComponent(invite.email)}`}
                className="block"
              >
                <Button variant="primary" size="md" className="w-full">
                  Sign in with invited email
                </Button>
              </Link>
            </>
          )}

          {status === "unauthenticated" && (
            <>
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}&email=${encodeURIComponent(invite.email)}`}
                className="block"
              >
                <Button variant="primary" size="md" className="w-full">
                  Sign in to accept
                </Button>
              </Link>
              <Link
                href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}&email=${encodeURIComponent(invite.email)}`}
                className="block"
              >
                <Button variant="secondary" size="md" className="w-full">
                  Create account
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
