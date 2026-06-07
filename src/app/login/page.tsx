"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
      router.push("/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <h1 className="mb-6 text-xl font-semibold">Sign in to Manifold</h1>
        {error && (
          <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>
        )}
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
        <OAuthButtons />
        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          No account?{" "}
          <Link href="/register" className="text-[var(--accent)] hover:underline">
            Register
          </Link>
        </p>
      </form>
    </main>
  );
}
