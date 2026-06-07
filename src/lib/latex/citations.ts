import { BibEntry } from "./types";

/** Parse BibTeX file into entries */
export function parseBibtex(content: string): BibEntry[] {
  const entries: BibEntry[] = [];
  const entryRe = /@(\w+)\s*\{\s*([^,\s]+)\s*,([\s\S]*?)\n\}/g;
  let match: RegExpExecArray | null;

  while ((match = entryRe.exec(content)) !== null) {
    const key = match[2];
    const body = match[3];
    const rawBibtex = match[0];

    const title = extractField(body, "title");
    const authors = extractField(body, "author");
    const year = extractField(body, "year");

    entries.push({ key, rawBibtex, title, authors, year });
  }

  return entries;
}

function extractField(body: string, field: string): string | null {
  const re = new RegExp(`${field}\\s*=\\s*["{]([^"}]+)["}]`, "i");
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

export type CitationAnalysis = {
  used: string[];
  unused: string[];
  missing: string[];
};

export function analyzeCitations(
  bibKeys: string[],
  usedKeys: string[]
): CitationAnalysis {
  const bibSet = new Set(bibKeys);
  const usedSet = new Set(usedKeys);

  return {
    used: usedKeys.filter((k) => bibSet.has(k)),
    unused: bibKeys.filter((k) => !usedSet.has(k)),
    missing: usedKeys.filter((k) => !bibSet.has(k)),
  };
}
