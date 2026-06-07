/**
 * DOI metadata lookup via CrossRef and BibTeX generation.
 */

export type DoiMetadata = {
  doi: string;
  title: string;
  authors: string;
  year: string;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  publisher: string | null;
  type: string;
};

function normalizeDoi(input: string): string {
  let doi = input.trim();
  doi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  doi = doi.replace(/^doi:\s*/i, "");
  return doi;
}

function formatAuthors(authors: Array<{ given?: string; family?: string }>): string {
  return authors
    .map((a) => {
      if (a.family && a.given) return `${a.family}, ${a.given}`;
      return a.family || a.given || "";
    })
    .filter(Boolean)
    .join(" and ");
}

function inferEntryType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("book")) return "book";
  if (t.includes("proceedings") || t.includes("conference")) return "inproceedings";
  return "article";
}

function bibKeyFromDoi(doi: string): string {
  return doi
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40)
    .toLowerCase();
}

function escapeBib(s: string): string {
  return s.replace(/[{}]/g, "").trim();
}

export function metadataToBibtex(meta: DoiMetadata, key?: string): string {
  const citeKey = key || bibKeyFromDoi(meta.doi);
  const entryType = inferEntryType(meta.type);
  const lines = [
    `@${entryType}{${citeKey},`,
    `  doi       = {${meta.doi}},`,
    `  title     = {${escapeBib(meta.title)}},`,
    `  author    = {${escapeBib(meta.authors)}},`,
    `  year      = {${meta.year}},`,
  ];
  if (meta.journal) lines.push(`  journal   = {${escapeBib(meta.journal)}},`);
  if (meta.volume) lines.push(`  volume    = {${meta.volume}},`);
  if (meta.issue) lines.push(`  number    = {${meta.issue}},`);
  if (meta.pages) lines.push(`  pages     = {${meta.pages}},`);
  if (meta.publisher) lines.push(`  publisher = {${escapeBib(meta.publisher)}},`);
  lines.push("}");
  return lines.join("\n");
}

export async function lookupDoi(rawDoi: string): Promise<{
  metadata: DoiMetadata;
  bibtex: string;
  suggestedKey: string;
}> {
  const doi = normalizeDoi(rawDoi);
  if (!doi) throw new Error("Invalid DOI");

  const mailto = process.env.CROSSREF_MAILTO || "support@manifold.app";
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": `Manifold/1.0 (mailto:${mailto})`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error(`DOI not found: ${doi}`);
    throw new Error(`CrossRef lookup failed (${res.status})`);
  }

  const json = await res.json();
  const msg = json.message;

  const title = Array.isArray(msg.title) ? msg.title[0] : msg.title;
  if (!title) throw new Error("No title in DOI metadata");

  const year =
    msg.published?.["date-parts"]?.[0]?.[0]?.toString() ||
    msg.created?.["date-parts"]?.[0]?.[0]?.toString() ||
    new Date().getFullYear().toString();

  const metadata: DoiMetadata = {
    doi,
    title,
    authors: formatAuthors(msg.author || []),
    year,
    journal: msg["container-title"]?.[0] || null,
    volume: msg.volume?.toString() || null,
    issue: msg.issue?.toString() || null,
    pages: msg.page || null,
    publisher: msg.publisher || null,
    type: msg.type || "article",
  };

  const suggestedKey = bibKeyFromDoi(doi);

  return {
    metadata,
    bibtex: metadataToBibtex(metadata, suggestedKey),
    suggestedKey,
  };
}
