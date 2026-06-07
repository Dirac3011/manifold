import { parseBibtex } from "../latex/citations";
import { lookupDoi } from "./doi";
import { lookupArxiv } from "./arxiv";
import { lookupIsbn } from "./isbn";
import { lookupPmid } from "./pmid";
import { suggestKeyFromMetadata } from "./format";

export type CitationSource = "doi" | "arxiv" | "isbn" | "pmid" | "bibtex" | "url";

export type LookupResult = {
  source: CitationSource;
  bibtex: string;
  suggestedKey: string;
  title: string;
  authors: string;
  year: string;
  identifier?: string;
};

function extractDoiFromUrl(url: string): string | null {
  const m = url.match(/doi\.org\/(10\.\d{4,9}\/[^\s#?]+)/i);
  return m?.[1] || null;
}

function extractArxivFromUrl(url: string): string | null {
  const m = url.match(/arxiv\.org\/abs\/([\d.]+)/i);
  return m?.[1] || null;
}

export async function lookupCitation(
  source: CitationSource,
  value: string
): Promise<LookupResult> {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Empty lookup value");

  if (source === "url") {
    const doi = extractDoiFromUrl(trimmed);
    if (doi) return lookupCitation("doi", doi);
    const arxiv = extractArxivFromUrl(trimmed);
    if (arxiv) return lookupCitation("arxiv", arxiv);
    throw new Error("URL must be a DOI or arXiv link");
  }

  if (source === "doi") {
    const r = await lookupDoi(trimmed);
    return {
      source: "doi",
      bibtex: r.bibtex,
      suggestedKey: r.suggestedKey,
      title: r.metadata.title,
      authors: r.metadata.authors,
      year: r.metadata.year,
      identifier: r.metadata.doi,
    };
  }

  if (source === "arxiv") {
    const r = await lookupArxiv(trimmed);
    return {
      source: "arxiv",
      bibtex: r.bibtex,
      suggestedKey: r.suggestedKey,
      title: r.title,
      authors: r.authors,
      year: r.year,
      identifier: r.arxivId,
    };
  }

  if (source === "isbn") {
    const r = await lookupIsbn(trimmed);
    return {
      source: "isbn",
      bibtex: r.bibtex,
      suggestedKey: r.suggestedKey,
      title: r.title,
      authors: r.authors,
      year: r.year,
      identifier: r.isbn,
    };
  }

  if (source === "pmid") {
    const r = await lookupPmid(trimmed);
    return {
      source: "pmid",
      bibtex: r.bibtex,
      suggestedKey: r.suggestedKey,
      title: r.title,
      authors: r.authors,
      year: r.year,
      identifier: r.pmid,
    };
  }

  if (source === "bibtex") {
    const entries = parseBibtex(trimmed);
    if (entries.length === 0) throw new Error("No valid BibTeX entry found");
    const e = entries[0];
    return {
      source: "bibtex",
      bibtex: e.rawBibtex,
      suggestedKey: e.key,
      title: e.title || "",
      authors: e.authors || "",
      year: e.year || "",
    };
  }

  throw new Error(`Unknown source: ${source}`);
}

export async function lookupBulkBibtex(raw: string): Promise<LookupResult[]> {
  const entries = parseBibtex(raw);
  if (entries.length === 0) throw new Error("No BibTeX entries found");
  return entries.map((e) => ({
    source: "bibtex" as const,
    bibtex: e.rawBibtex,
    suggestedKey: e.key,
    title: e.title || "",
    authors: e.authors || "",
    year: e.year || "",
  }));
}
