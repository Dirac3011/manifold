import { bibEntryFromFields, suggestKeyFromMetadata } from "./format";

function normalizePmid(input: string): string {
  return input.trim().replace(/^pmid[:\s]*/i, "").replace(/\D/g, "");
}

export async function lookupPmid(raw: string): Promise<{
  bibtex: string;
  suggestedKey: string;
  title: string;
  authors: string;
  year: string;
  pmid: string;
}> {
  const pmid = normalizePmid(raw);
  if (!pmid) throw new Error("Invalid PubMed ID");

  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PubMed lookup failed (${res.status})`);

  const json = await res.json();
  const record = json.result?.[pmid];
  if (!record || record.error) throw new Error(`PubMed ID not found: ${pmid}`);

  const title = record.title || "Untitled";
  const authors =
    record.authors?.map((a: { name: string }) => a.name).join(" and ") || "Unknown";
  const year =
    record.pubdate?.match(/\d{4}/)?.[0] || new Date().getFullYear().toString();
  const journal = record.fulljournalname || record.source || "";
  const volume = record.volume || "";
  const pages = record.pages || "";

  const suggestedKey = suggestKeyFromMetadata(authors, year, title);
  const fields: Record<string, string> = {
    pmid,
    title,
    author: authors,
    year,
  };
  if (journal) fields.journal = journal;
  if (volume) fields.volume = volume;
  if (pages) fields.pages = pages;

  const bibtex = bibEntryFromFields("article", suggestedKey, fields);

  return { bibtex, suggestedKey, title, authors, year, pmid };
}
