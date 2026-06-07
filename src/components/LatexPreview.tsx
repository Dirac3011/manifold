"use client";

import { useMemo } from "react";
import { renderLatexPreview } from "@/lib/latex/render";

export function LatexPreview({ rawLatex }: { rawLatex: string }) {
  const html = useMemo(() => renderLatexPreview(rawLatex), [rawLatex]);
  return (
    <div
      className="latex-preview prose-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
