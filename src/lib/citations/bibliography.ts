import { parseBibtex } from "../latex/citations";
import { appendBibEntries, inferBibFormat, normalizeBibEntry } from "./format";

export type BibliographyMode = "bibtex" | "inline" | "none";

export type BibliographySyncResult = {
  mode: BibliographyMode;
  bibFilePath: string | null;
  bibFileUpdated: boolean;
  mainTexUpdated: boolean;
  addedToBib: string[];
  addedBibitems: string[];
  ensuredBibliographyCommand: boolean;
};

export function detectBibliographyMode(mainTex: string): {
  mode: BibliographyMode;
  bibResource: string | null;
} {
  const bibMatch = mainTex.match(/\\bibliography\{([^}]+)\}/);
  if (bibMatch) {
    return { mode: "bibtex", bibResource: bibMatch[1] };
  }
  const addBibMatch = mainTex.match(/\\addbibresource\{([^}]+)\}/);
  if (addBibMatch) {
    const resource = addBibMatch[1].replace(/\.bib$/i, "");
    return { mode: "bibtex", bibResource: resource };
  }
  if (/\\begin\{thebibliography\}/.test(mainTex)) {
    return { mode: "inline", bibResource: null };
  }
  return { mode: "none", bibResource: null };
}

function existingBibitemKeys(mainTex: string): Set<string> {
  const keys = new Set<string>();
  const re = /\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(mainTex)) !== null) keys.add(m[1]);
  return keys;
}

function inferBibitemStyle(mainTex: string): string {
  const sample = mainTex.match(/\\bibitem[^\n]*\n([\s\S]*?)(?=\\bibitem|\\end\{thebibliography\})/);
  if (!sample) {
    return "{authors}. \\textit{{title}}. {year}.";
  }
  const line = sample[1].trim().split("\n")[0];
  if (line.includes("\\textit")) return "textit";
  if (line.includes("\\emph")) return "emph";
  return "plain";
}

function formatBibitem(
  key: string,
  authors: string | null,
  title: string | null,
  year: string | null,
  style: string
): string {
  const a = authors || "Unknown";
  const t = title || key;
  const y = year || "";
  if (style === "textit") {
    return `\\bibitem{${key}}\n${a}. \\textit{${t}}. ${y}.`;
  }
  if (style === "emph") {
    return `\\bibitem{${key}}\n${a}. \\emph{${t}}. ${y}.`;
  }
  return `\\bibitem{${key}}\n${a}. ${t}. ${y}.`;
}

export function ensureBibtexBibliography(
  mainTex: string,
  bibResource = "references"
): { content: string; added: boolean } {
  if (/\\bibliography\{/.test(mainTex)) {
    return { content: mainTex, added: false };
  }
  const block = [
    "",
    "\\bibliographystyle{plainnat}",
    `\\bibliography{${bibResource}}`,
  ].join("\n");

  if (/\\end\{document\}/.test(mainTex)) {
    return {
      content: mainTex.replace(/\\end\{document\}/, `${block}\n\n\\end{document}`),
      added: true,
    };
  }
  return { content: mainTex + "\n" + block + "\n", added: true };
}

export function syncInlineBibliography(
  mainTex: string,
  citations: Array<{
    key: string;
    authors: string | null;
    title: string | null;
    year: string | null;
    rawBibtex: string;
  }>,
  usedKeys: string[]
): { content: string; added: string[] } {
  const existing = existingBibitemKeys(mainTex);
  const style = inferBibitemStyle(mainTex);
  const toAdd = citations.filter((c) => usedKeys.includes(c.key) && !existing.has(c.key));
  if (toAdd.length === 0) return { content: mainTex, added: [] };

  const items = toAdd.map((c) => formatBibitem(c.key, c.authors, c.title, c.year, style)).join("\n\n");

  if (/\\begin\{thebibliography\}/.test(mainTex)) {
    const content = mainTex.replace(
      /\\end\{thebibliography\}/,
      `${items}\n\n\\end{thebibliography}`
    );
    return { content, added: toAdd.map((c) => c.key) };
  }

  const block = [
    "\\begin{thebibliography}{99}",
    items,
    "\\end{thebibliography}",
  ].join("\n\n");

  if (/\\end\{document\}/.test(mainTex)) {
    return {
      content: mainTex.replace(/\\end\{document\}/, `${block}\n\n\\end{document}`),
      added: toAdd.map((c) => c.key),
    };
  }
  return { content: mainTex + "\n\n" + block + "\n", added: toAdd.map((c) => c.key) };
}

export function syncBibFileContent(
  bibContent: string,
  citations: Array<{ key: string; rawBibtex: string }>,
  options: { onlyUsed?: string[] } = {}
): { content: string; added: string[] } {
  const style = inferBibFormat(bibContent);
  const toSync = options.onlyUsed
    ? citations.filter((c) => options.onlyUsed!.includes(c.key))
    : citations;

  const entries = toSync.map((c) => ({
    key: c.key,
    rawBibtex: normalizeBibEntry(c.rawBibtex, style),
  }));

  return appendBibEntries(bibContent, entries);
}

export function resolveBibFilePath(
  bibResource: string,
  files: Array<{ path: string }>
): string {
  const candidates = [
    `${bibResource}.bib`,
    bibResource.endsWith(".bib") ? bibResource : `${bibResource}.bib`,
    "references.bib",
  ];
  for (const c of candidates) {
    if (files.some((f) => f.path === c)) return c;
  }
  return `${bibResource}.bib`;
}
