import { bibEntryFromFields, suggestKeyFromMetadata } from "./format";

function normalizeArxivId(input: string): string {
  let id = input.trim();
  id = id.replace(/^https?:\/\/(www\.)?arxiv\.org\/abs\//i, "");
  id = id.replace(/^arxiv:\s*/i, "");
  id = id.replace(/v\d+$/i, "");
  return id;
}

export async function lookupArxiv(raw: string): Promise<{
  bibtex: string;
  suggestedKey: string;
  title: string;
  authors: string;
  year: string;
  arxivId: string;
}> {
  const arxivId = normalizeArxivId(raw);
  if (!arxivId) throw new Error("Invalid arXiv ID");

  const res = await fetch(`https://export.arxiv.org/bibtex/${arxivId}`);
  if (!res.ok) throw new Error(`arXiv lookup failed (${res.status})`);

  let bibtex = (await res.text()).trim();
  if (!bibtex.startsWith("@")) throw new Error("arXiv returned no BibTeX");

  const keyMatch = bibtex.match(/@\w+\{\s*([^,\s]+)\s*,/);
  const suggestedKey = keyMatch?.[1] || `arxiv_${arxivId.replace(/\./g, "_")}`;

  const title = bibtex.match(/title\s*=\s*\{([^}]+)\}/i)?.[1] || "";
  const authors = bibtex.match(/author\s*=\s*\{([^}]+)\}/i)?.[1] || "";
  const year =
    bibtex.match(/year\s*=\s*\{([^}]+)\}/i)?.[1] ||
    bibtex.match(/eprint\s*=\s*\{([^}]+)\}/i)?.[1]?.slice(0, 4) ||
    new Date().getFullYear().toString();

  if (!bibtex.includes("eprint")) {
    bibtex = bibtex.replace(/\}$/, `,\n  eprint    = {${arxivId}}\n}`);
  }

  return {
    bibtex,
    suggestedKey,
    title,
    authors,
    year,
    arxivId,
  };
}
