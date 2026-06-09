export type ProjectTemplateId = "sample" | "blank" | "notes";

export type ProjectTemplate = {
  id: ProjectTemplateId;
  name: string;
  description: string;
  detail: string;
};

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
For every bounded sequence $(a_n)$, there exists a convergent subsequence.
\end{theorem}

\begin{proof}[Proof sketch]
Apply Bolzano--Weierstrass and cite \citet{knuth1984}.
\end{proof}

\section{Discussion}

Theorem~\ref{thm:main} extends Lemma~\ref{lem:bound}.

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

const BLANK_MAIN_TEX = String.raw`\documentclass{article}
\usepackage{amsmath,amssymb}

\title{Untitled Manuscript}
\author{}
\date{\today}

\begin{document}
\maketitle

\section{Introduction}

\end{document}
`;

const NOTES_MAIN_TEX = String.raw`\documentclass{article}
\usepackage{amsmath,amssymb}

\title{Research Notes}
\author{}
\date{\today}

\begin{document}

\section{Ideas}

\subsection{Open questions}

\end{document}
`;

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "sample",
    name: "Sample research paper",
    description: "Theorem objects, citations, and cross-references ready to explore.",
    detail: "Includes main.tex + references.bib with demo content.",
  },
  {
    id: "blank",
    name: "Blank article",
    description: "Minimal article scaffold with a single section.",
    detail: "Start from a clean main.tex — add structure as you write.",
  },
  {
    id: "notes",
    name: "Research notes",
    description: "Lightweight outline for drafting ideas and sub-questions.",
    detail: "Section/subsection skeleton without bibliography.",
  },
];

export function getTemplateFiles(template: ProjectTemplateId): Array<{
  name: string;
  path: string;
  content: string;
  isMain: boolean;
}> {
  switch (template) {
    case "sample":
      return [
        { name: "main.tex", path: "main.tex", content: SAMPLE_MAIN_TEX, isMain: true },
        { name: "references.bib", path: "references.bib", content: SAMPLE_BIB, isMain: false },
      ];
    case "notes":
      return [
        { name: "main.tex", path: "main.tex", content: NOTES_MAIN_TEX, isMain: true },
      ];
    case "blank":
    default:
      return [
        { name: "main.tex", path: "main.tex", content: BLANK_MAIN_TEX, isMain: true },
      ];
  }
}

export function defaultProjectName(template: ProjectTemplateId): string {
  return PROJECT_TEMPLATES.find((t) => t.id === template)?.name ?? "Untitled Manuscript";
}
