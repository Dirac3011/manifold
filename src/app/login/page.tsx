"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ManifoldLogo } from "@/components/ManifoldLogo";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const presetEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(presetEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (res?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push(callbackUrl);
    }
  }

  const registerHref = presetEmail
    ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}&email=${encodeURIComponent(presetEmail)}`
    : `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6"
    >
      <div className="mb-6 flex items-center gap-2">
        <ManifoldLogo size={28} />
        <h1 className="text-xl font-semibold">Sign in to Manifold</h1>
      </div>
      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}
      <label className="mb-4 block">
        <span className="text-xs text-[var(--muted)]">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          required
        />
      </label>
      <label className="mb-6 block">
        <span className="text-xs text-[var(--muted)]">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          required
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-[var(--accent)] py-2 text-sm font-medium text-[#0f1117] disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
      <OAuthButtons callbackUrl={callbackUrl} />
      <p className="mt-4 text-center text-xs text-[var(--muted)]">
        No account?{" "}
        <Link href={registerHref} className="text-[var(--accent)] hover:underline">
          Register
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Suspense
        fallback={
          <div className="text-sm text-[var(--muted)]">Loading…</div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
