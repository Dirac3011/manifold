"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const presetEmail = searchParams.get("email") || "";

  const [form, setForm] = useState({
    email: presetEmail,
    username: "",
    password: "",
    name: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(
        typeof data.error === "string"
          ? data.error
          : "Registration failed"
      );
      setLoading(false);
      return;
    }

    await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    router.push(callbackUrl);
  }

  const loginHref = presetEmail
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}&email=${encodeURIComponent(presetEmail)}`
    : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6"
    >
      <h1 className="mb-6 text-xl font-semibold">Create account</h1>
      {presetEmail && (
        <p className="mb-4 text-xs text-[var(--muted)]">
          Create an account with <strong>{presetEmail}</strong> to accept your
          invitation.
        </p>
      )}
      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}
      {(["name", "username", "email", "password"] as const).map((field) => (
        <label key={field} className="mb-4 block">
          <span className="text-xs capitalize text-[var(--muted)]">{field}</span>
          <input
            type={
              field === "password"
                ? "password"
                : field === "email"
                  ? "email"
                  : "text"
            }
            value={form[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            readOnly={field === "email" && !!presetEmail}
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-70"
            required={field !== "name"}
          />
        </label>
      ))}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-[var(--accent)] py-2 text-sm font-medium text-[#0f1117] disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create account"}
      </button>
      <OAuthButtons callbackUrl={callbackUrl} />
      <p className="mt-4 text-center text-xs text-[var(--muted)]">
        Already have an account?{" "}
        <Link href={loginHref} className="text-[var(--accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Suspense
        fallback={
          <div className="text-sm text-[var(--muted)]">Loading…</div>
        }
      >
        <RegisterForm />
      </Suspense>
    </main>
  );
}
