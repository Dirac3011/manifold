/**
 * LaTeX compiler profiles for Manifold.
 *
 * Comparison (typical article, same Docker image):
 *
 * | Profile  | Engine   | Passes      | BibTeX | Speed      | Use case                          |
 * |----------|----------|-------------|--------|------------|-----------------------------------|
 * | draft    | pdflatex | 1           | No     | Fastest    | Layout/math preview while writing |
 * | standard | latexmk  | auto (~2-3) | Yes    | Moderate   | Day-to-day with refs & citations  |
 * | final    | latexmk  | full (-gg)  | Yes    | Slowest    | Submission-ready PDF              |
 *
 * Not included in MVP but worth knowing:
 * - XeLaTeX / LuaLaTeX — better Unicode & modern fonts; slower; add when projects need them.
 * - Tectonic — Rust-based, cached packages, very fast repeat builds; different package model.
 * - `-draft` class option — skips images; can combine with any profile later.
 */
export const COMPILE_PROFILES = ["draft", "standard", "final"] as const;
export type CompileProfile = (typeof COMPILE_PROFILES)[number];

export const DEFAULT_COMPILE_PROFILE: CompileProfile = "draft";

export type CompilerProfileConfig = {
  id: CompileProfile;
  label: string;
  description: string;
  /** Docker entrypoint binary */
  entrypoint: string;
  /** Args before the main .tex filename */
  args: string[];
  timeoutMs: number;
};

export const COMPILER_PROFILES: Record<CompileProfile, CompilerProfileConfig> = {
  draft: {
    id: "draft",
    label: "Draft (fast)",
    description:
      "Single pdflatex pass. ~3–10× faster. References and bibliography may show as ??.",
    entrypoint: "pdflatex",
    args: [
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-file-line-error",
    ],
    timeoutMs: 45_000,
  },
  standard: {
    id: "standard",
    label: "Standard",
    description:
      "latexmk with BibTeX. Resolves cross-references and citations. Good default for review.",
    entrypoint: "latexmk",
    args: [
      "-pdf",
      "-bibtex",
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-file-line-error",
    ],
    timeoutMs: 120_000,
  },
  final: {
    id: "final",
    label: "Final (full)",
    description:
      "latexmk full rebuild (-gg). Ensures all references, citations, and TOC are settled.",
    entrypoint: "latexmk",
    args: [
      "-pdf",
      "-bibtex",
      "-gg",
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-file-line-error",
    ],
    timeoutMs: 180_000,
  },
};

export function parseCompileProfile(value: unknown): CompileProfile {
  if (
    typeof value === "string" &&
    COMPILE_PROFILES.includes(value as CompileProfile)
  ) {
    return value as CompileProfile;
  }
  return DEFAULT_COMPILE_PROFILE;
}

export function getCompilerStorageKey(projectId: string): string {
  return `manifold:compiler:${projectId}`;
}
