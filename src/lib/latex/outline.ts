export type OutlineEntry = {
  level: number;
  kind: string;
  title: string;
  line: number;
};

const HEADING_RE =
  /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?(?:\[[^\]]*\])?\{([^}]*)\}/g;

const LEVEL: Record<string, number> = {
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
  subparagraph: 6,
};

export function parseDocumentOutline(content: string): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  let match: RegExpExecArray | null;

  while ((match = HEADING_RE.exec(content)) !== null) {
    const kind = match[1];
    const title = match[2].trim();
    if (!title) continue;

    const line = content.slice(0, match.index).split("\n").length;
    entries.push({
      level: LEVEL[kind] ?? 2,
      kind,
      title,
      line,
    });
  }

  return entries;
}
