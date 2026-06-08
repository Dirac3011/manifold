import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ManifoldLogo } from "@/components/ManifoldLogo";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center">
        <div className="mb-4 flex justify-center">
          <ManifoldLogo size={72} priority />
        </div>
        <h1 className="mb-2 text-4xl font-bold tracking-tight">Manifold</h1>
        <p className="mb-8 text-lg text-[var(--muted)]">
          Collaborative research writing where theorems, lemmas, and proofs become
          first-class objects — with native math discussion, citations, and LaTeX
          compilation.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/register"
            className="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-[#0f1117]"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-[var(--border)] px-6 py-2.5 text-sm hover:bg-[var(--surface)]"
          >
            Sign in
          </Link>
        </div>
        <div className="mt-16 grid grid-cols-3 gap-6 text-left text-sm">
          {[
            {
              title: "Object threads",
              desc: "Every theorem gets its own persistent discussion with math rendering.",
            },
            {
              title: "LaTeX + PDF",
              desc: "Edit, compile in Docker sandbox, preview PDF side-by-side.",
            },
            {
              title: "Citations & refs",
              desc: "Track BibTeX usage, cross-references, and dependency graphs.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <h3 className="mb-1 font-semibold text-[var(--accent)]">
                {f.title}
              </h3>
              <p className="text-[var(--muted)]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
