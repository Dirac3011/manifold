import { MathObjectType } from "@prisma/client";

export const ENVIRONMENT_MAP: Record<string, MathObjectType> = {
  theorem: MathObjectType.THEOREM,
  lemma: MathObjectType.LEMMA,
  proposition: MathObjectType.PROPOSITION,
  corollary: MathObjectType.COROLLARY,
  definition: MathObjectType.DEFINITION,
  conjecture: MathObjectType.CONJECTURE,
  example: MathObjectType.EXAMPLE,
  remark: MathObjectType.REMARK,
  problem: MathObjectType.PROBLEM,
  openproblem: MathObjectType.OPENPROBLEM,
  exercise: MathObjectType.EXERCISE,
};

export type ParsedMathObject = {
  type: MathObjectType;
  title: string | null;
  label: string | null;
  filePath: string;
  startLine: number;
  endLine: number;
  rawLatex: string;
  proofLatex: string | null;
  refs: ParsedReference[];
  citations: string[];
  contentHash: string;
};

export type ParsedReference = {
  targetLabel: string;
  refType: string;
  line: number;
};

export type ParsedLabel = {
  key: string;
  line: number;
  objectIndex?: number;
};

export type ParsedCitationUsage = {
  key: string;
  line: number;
  objectIndex?: number;
};

export type BibEntry = {
  key: string;
  rawBibtex: string;
  title: string | null;
  authors: string | null;
  year: string | null;
};

export type ParseResult = {
  objects: ParsedMathObject[];
  labels: ParsedLabel[];
  references: ParsedReference[];
  citationUsages: ParsedCitationUsage[];
  allLabels: string[];
};
