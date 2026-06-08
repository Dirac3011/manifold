import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { syncProjectFromLatex } from "../src/lib/latex/sync-objects";

const prisma = new PrismaClient();

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

We study properties of sequences. See \citep{knuth1984} for background.

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

async function main() {
  const removed = await prisma.project.deleteMany();
  console.log(`Removed ${removed.count} existing project(s).`);

  const eulerPasswordHash = await hashPassword("euler");
  const bobPasswordHash = await hashPassword("password123");

  const euler = await prisma.user.upsert({
    where: { email: "euler@example.com" },
    update: { passwordHash: eulerPasswordHash },
    create: {
      email: "euler@example.com",
      username: "euler",
      name: "Leonhard Euler",
      passwordHash: eulerPasswordHash,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: { passwordHash: bobPasswordHash },
    create: {
      email: "bob@example.com",
      username: "bob",
      name: "Bob Collaborator",
      passwordHash: bobPasswordHash,
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "Sample Analysis Paper",
      description: "Demo paper with theorems, lemmas, citations, and cross-references.",
      ownerId: euler.id,
      members: {
        create: [
          { userId: euler.id, role: "OWNER", joinedAt: new Date() },
          { userId: bob.id, role: "EDITOR", joinedAt: new Date() },
        ],
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
  });

  await syncProjectFromLatex(project.id);

  const thm = await prisma.mathObject.findFirst({
    where: { projectId: project.id, label: "thm:main" },
    include: { thread: true },
  });

  if (thm?.thread) {
    await prisma.comment.create({
      data: {
        threadId: thm.thread.id,
        authorId: bob.id,
        content:
          "Should we cite a stronger bound here? Consider $$\\|a\\|_\\infty \\le \\|a\\|_2$$ for the sum estimate.",
      },
    });
  }

  await prisma.chatMessage.create({
    data: {
      projectId: project.id,
      authorId: euler.id,
      content:
        "Welcome to the sample project! Check out @thm:main and discuss the proof strategy.",
      mentions: ["thm:main"],
    },
  });

  console.log("Seed complete.");
  console.log("  euler@example.com / euler");
  console.log("  bob@example.com / password123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
