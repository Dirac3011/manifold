/**
 * LaTeX parser for theorem-like environments, labels, references, and citations.
 * MVP: single-file parsing; designed to extend to multi-file via filePath param.
 */
import { contentHash } from "../hash";
import {
  ENVIRONMENT_MAP,
  ParsedCitationUsage,
  ParsedLabel,
  ParsedMathObject,
  ParsedReference,
  ParseResult,
} from "./types";

const ENV_NAMES = Object.keys(ENVIRONMENT_MAP).join("|");
const BEGIN_ENV = new RegExp(
  `\\\\begin\\{(${ENV_NAMES})\\}(?:\\[(.*?)\\])?`,
  "g"
);
const LABEL_RE = /\\label\{([^}]+)\}/g;
const REF_RE =
  /\\(?:(eq)?ref|cref|Cref)\{([^}]+)\}/g;
const CITE_RE =
  /\\(?:cite|citep|citet|autocite|textcite|parencite|footcite)(?:\[[^\]]*\])?\{([^}]+)\}/g;

function extractProof(
  content: string,
  afterIndex: number
): { proof: string | null; endIndex: number } {
  const proofMatch = content
    .slice(afterIndex)
    .match(/^\s*\\begin\{proof\}([\s\S]*?)\\end\{proof\}/);
  if (!proofMatch) return { proof: null, endIndex: afterIndex };
  return {
    proof: proofMatch[0],
    endIndex: afterIndex + proofMatch[0].length,
  };
}

function findMatchingEnd(
  content: string,
  envName: string,
  startIndex: number
): number {
  const beginPat = new RegExp(`\\\\begin\\{${envName}\\}`, "g");
  const endPat = new RegExp(`\\\\end\\{${envName}\\}`, "g");
  let depth = 1;
  let pos = startIndex;

  beginPat.lastIndex = startIndex;
  endPat.lastIndex = startIndex;

  while (depth > 0) {
    beginPat.lastIndex = pos;
    endPat.lastIndex = pos;
    const nextBegin = beginPat.exec(content);
    const nextEnd = endPat.exec(content);
    if (!nextEnd) return -1;

    if (nextBegin && nextBegin.index < nextEnd.index) {
      depth++;
      pos = nextBegin.index + nextBegin[0].length;
    } else {
      depth--;
      if (depth === 0) return nextEnd.index + nextEnd[0].length;
      pos = nextEnd.index + nextEnd[0].length;
    }
  }
  return -1;
}

function lineNumber(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function extractRefs(text: string, baseLine: number): ParsedReference[] {
  const refs: ParsedReference[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(REF_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    const refType = m[1] === "eq" ? "eqref" : m[0].includes("Cref")
      ? "Cref"
      : m[0].includes("cref")
        ? "cref"
        : "ref";
    const targets = m[2].split(",").map((t) => t.trim());
    const line = baseLine + text.slice(0, m.index).split("\n").length - 1;
    for (const target of targets) {
      refs.push({ targetLabel: target, refType, line });
    }
  }
  return refs;
}

function extractCitations(text: string, baseLine: number): string[] {
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(CITE_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    const line = baseLine + text.slice(0, m.index).split("\n").length - 1;
    void line;
    m[1].split(",").forEach((k) => keys.push(k.trim()));
  }
  return [...new Set(keys)];
}

export function parseLatexFile(
  content: string,
  filePath: string = "main.tex"
): ParseResult {
  const objects: ParsedMathObject[] = [];
  const labels: ParsedLabel[] = [];
  const references: ParsedReference[] = [];
  const citationUsages: ParsedCitationUsage[] = [];

  // Parse all labels in file
  let labelMatch: RegExpExecArray | null;
  const labelRe = new RegExp(LABEL_RE.source, "g");
  while ((labelMatch = labelRe.exec(content)) !== null) {
    labels.push({
      key: labelMatch[1],
      line: lineNumber(content, labelMatch.index),
    });
  }

  // Parse all references in file (global)
  let refMatch: RegExpExecArray | null;
  const refRe = new RegExp(REF_RE.source, "g");
  while ((refMatch = refRe.exec(content)) !== null) {
    const refType = refMatch[1] === "eq" ? "eqref" : refMatch[0].includes("Cref")
      ? "Cref"
      : refMatch[0].includes("cref")
        ? "cref"
        : "ref";
    refMatch[2].split(",").forEach((t) => {
      references.push({
        targetLabel: t.trim(),
        refType,
        line: lineNumber(content, refMatch!.index),
      });
    });
  }

  // Parse citation usages
  let citeMatch: RegExpExecArray | null;
  const citeRe = new RegExp(CITE_RE.source, "g");
  while ((citeMatch = citeRe.exec(content)) !== null) {
    citeMatch[1].split(",").forEach((k) => {
      citationUsages.push({
        key: k.trim(),
        line: lineNumber(content, citeMatch!.index),
      });
    });
  }

  // Parse theorem-like environments
  let beginMatch: RegExpExecArray | null;
  const beginRe = new RegExp(BEGIN_ENV.source, "g");
  while ((beginMatch = beginRe.exec(content)) !== null) {
    const envName = beginMatch[1];
    const title = beginMatch[2] || null;
    const envType = ENVIRONMENT_MAP[envName];
    const beginIndex = beginMatch.index;
    const startLine = lineNumber(content, beginIndex);

    const endIndex = findMatchingEnd(
      content,
      envName,
      beginIndex + beginMatch[0].length
    );
    if (endIndex < 0) continue;

    const envBody = content.slice(beginIndex, endIndex);
    const endLine = lineNumber(content, endIndex);

    // Extract label within environment
    let objectLabel: string | null = null;
    const envLabelRe = new RegExp(LABEL_RE.source, "g");
    let el: RegExpExecArray | null;
    while ((el = envLabelRe.exec(envBody)) !== null) {
      objectLabel = el[1];
    }

    const { proof, endIndex: afterProof } = extractProof(content, endIndex);
    const refs = extractRefs(envBody, startLine);
    const citations = extractCitations(envBody, startLine);

    objects.push({
      type: envType,
      title,
      label: objectLabel,
      filePath,
      startLine,
      endLine: proof ? lineNumber(content, afterProof) : endLine,
      rawLatex: envBody,
      proofLatex: proof,
      refs,
      citations,
      contentHash: contentHash(filePath, envType, envBody),
    });
  }

  return {
    objects,
    labels,
    references,
    citationUsages,
    allLabels: labels.map((l) => l.key),
  };
}
