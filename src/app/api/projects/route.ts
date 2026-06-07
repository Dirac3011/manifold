import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { syncProjectFromLatex } from "@/lib/latex/sync-objects";
import { prisma } from "@/lib/prisma";

const SAMPLE_MAIN_TEX = String.raw`\documentclass{article}
\usepackage{amsmath,amsthm,amssymb}
\usepackage{natbib}

\newtheorem{theorem}{Theorem}[section]
\newtheorem{lemma}[theorem]{Lemma}
\newtheorem{proposition}[theorem]{Proposition}
\newtheorem{corollary}[theorem]{Corollary}
\theoremstyle{definition}
\newtheorem{definition}[theorem]{Definition}
\newtheorem{example}[theorem]{Example}
\theoremstyle{remark}
\newtheorem{remark}[theorem]{Remark}
\newtheorem{conjecture}[theorem]{Conjecture}
\newtheorem{problem}[theorem]{Problem}

\title{Sample Research Paper}
\author{Manifold Demo}
\date{\today}

\begin{document}
\maketitle

\begin{abstract}
This is a sample project demonstrating Manifold's theorem-object parsing and collaboration features.
\end{abstract}

\section{Introduction}

We study properties of sequences. See \cite{knuth1984} for background.

\begin{definition}[Sequence]\label{def:sequence}
A \emph{sequence} is a function $a \colon \mathbb{N} \to \mathbb{R}$.
\end{definition}

\begin{lemma}\label{lem:bound}
If $|a_n| \le M$ for all $n$, then the sequence is bounded.
\end{lemma}

\begin{proof}
This follows directly from the definition.
\end{proof}

\begin{theorem}[Main Result]\label{thm:main}
For every bounded sequence $(a_n)$, there exists a convergent subsequence. Moreover,
\[
\sum_{n=1}^{\infty} \frac{a_n}{2^n} < \infty
\]
when $|a_n| \le 1$.
\end{theorem}

\begin{proof}[Proof sketch]
Apply Bolzano--Weierstrass and cite \citet{knuth1984}.
\end{proof}

\begin{corollary}\label{cor:subseq}
Every bounded sequence has a Cauchy subsequence.
\end{corollary}

\begin{remark}
Theorem~\ref{thm:main} extends Lemma~\ref{lem:bound}.
\end{remark}

\begin{conjecture}\label{conj:open}
There exists a universal constant $C$ such that $\|a\|_\infty \le C \|a\|_2$.
\end{conjecture}

\bibliographystyle{plainnat}
\bibliography{references}
\end{document}
`;

const SAMPLE_BIB = String.raw`@book{knuth1984,
  author    = {Knuth, Donald E.},
  title     = {The TeXbook},
  year      = {1984},
  publisher = {Addison-Wesley}
}
`;

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
});

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: session!.user.id },
        { members: { some: { userId: session!.user.id } } },
      ],
    },
    include: {
      owner: { select: { id: true, name: true, username: true } },
      _count: { select: { mathObjects: true, members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input");

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      ownerId: session!.user.id,
      members: {
        create: { userId: session!.user.id, role: "OWNER", joinedAt: new Date() },
      },
      files: {
        create: [
          {
            name: "main.tex",
            path: "main.tex",
            content: SAMPLE_MAIN_TEX,
            isMain: true,
          },
          {
            name: "references.bib",
            path: "references.bib",
            content: SAMPLE_BIB,
            isMain: false,
          },
        ],
      },
    },
    include: { files: true },
  });

  try {
    await syncProjectFromLatex(project.id);
  } catch (err) {
    console.error("syncProjectFromLatex failed after project create:", err);
    // Project still created — sync can run on first save
  }

  return NextResponse.json(project, { status: 201 });
}
