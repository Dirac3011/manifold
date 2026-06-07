import { createHash } from "crypto";

/** Stable content hash for math objects without a LaTeX label */
export function contentHash(
  filePath: string,
  type: string,
  rawLatex: string
): string {
  const normalized = rawLatex.replace(/\s+/g, " ").trim();
  return createHash("sha256")
    .update(`${filePath}:${type}:${normalized}`)
    .digest("hex")
    .slice(0, 16);
}
