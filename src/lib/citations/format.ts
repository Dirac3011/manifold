import { parseBibtex } from "../latex/citations";
import { prisma } from "../prisma";

export type BibFormatStyle = {
  indent: string;
  blankLineBetween: boolean;
};

export function inferBibFormat(content: string): BibFormatStyle {
  if (!content.trim()) {
    return { indent: "  ", blankLineBetween: true };
  }
  const indentMatch = content.match(/@\w+\{[^,]+,\n(\s+)/);
  return {
    indent: indentMatch?.[1] || "  ",
    blankLineBetween: /\n\n@/.test(content),
  };
}

/** Re-indent a BibTeX entry to match project style */
export function normalizeBibEntry(raw: string, style: BibFormatStyle): string {
  const lines = raw.trim().split("\n");
  if (lines.length === 0) return raw;

  const header = lines[0];
  const body = lines.slice(1).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    if (trimmed === "}") return "}";
    return `${style.indent}${trimmed}`;
  });

  return [header, ...body.filter((l, i) => l !== "" || i === body.length - 1)].join("\n");
}

export function appendBibEntries(
  bibContent: string,
  entries: Array<{ key: string; rawBibtex: string }>
): { content: string; added: string[] } {
  const style = inferBibFormat(bibContent);
  const existingKeys = new Set(parseBibtex(bibContent).map((e) => e.key));

  const added: string[] = [];
  let content = bibContent.trimEnd();

  for (const entry of entries) {
    if (existingKeys.has(entry.key)) continue;
    const formatted = normalizeBibEntry(entry.rawBibtex, style);
    const sep = content.length === 0 ? "" : style.blankLineBetween ? "\n\n" : "\n";
    content += sep + formatted + "\n";
    added.push(entry.key);
    existingKeys.add(entry.key);
  }

  return { content: content ? content + (content.endsWith("\n") ? "" : "\n") : "", added };
}

export function suggestKeyFromMetadata(
  authors: string | null,
  year: string | null,
  title: string | null
): string {
  const family = authors?.split(/\s+and\s+/i)[0]?.split(",")[0]?.trim() || "unknown";
  const authorPart = family.replace(/[^a-zA-Z]/g, "").toLowerCase() || "unknown";
  const yearPart = year?.slice(0, 4) || "nodate";
  const titlePart =
    title
      ?.split(/\s+/)
      .find((w) => w.length > 3)
      ?.replace(/[^a-zA-Z]/g, "")
      .toLowerCase()
      .slice(0, 12) || "";
  return `${authorPart}${yearPart}${titlePart}`.slice(0, 40) || "citation";
}

export async function uniqueProjectKey(
  projectId: string,
  base: string
): Promise<string> {
  let key = base.replace(/[^a-zA-Z0-9_:-]/g, "_").slice(0, 48);
  if (!key) key = "citation";
  let candidate = key;
  let n = 0;
  while (
    await prisma.citation.findUnique({
      where: { projectId_key: { projectId, key: candidate } },
    })
  ) {
    candidate = `${key}${++n}`;
  }
  return candidate;
}

export function bibEntryFromFields(
  entryType: string,
  key: string,
  fields: Record<string, string>,
  style: BibFormatStyle = { indent: "  ", blankLineBetween: true }
): string {
  const lines = [`@${entryType}{${key},`];
  for (const [name, value] of Object.entries(fields)) {
    if (value) lines.push(`${style.indent}${name} = {${value}},`);
  }
  lines.push("}");
  return lines.join("\n");
}
