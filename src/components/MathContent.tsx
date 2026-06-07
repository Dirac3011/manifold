"use client";

import { useMemo } from "react";
import { renderMathContent } from "@/lib/latex/render";

export function MathContent({ content }: { content: string }) {
  const html = useMemo(() => renderMathContent(content), [content]);
  return (
    <div
      className="math-content text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
