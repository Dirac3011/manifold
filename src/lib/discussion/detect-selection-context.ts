import { NoteContext } from "./types";

export type EditorSelection = {
  startLine: number;
  endLine: number;
  text: string;
};

type ObjectRef = {
  id: string;
  label: string | null;
  type: string;
  startLine: number;
  endLine: number;
  status?: string;
};

const MAX_EXCERPT = 280;

/** Build note context from an editor text selection (null = no reference). */
export function detectSelectionContext(
  selection: EditorSelection | null,
  activeFile: { id: string; name: string } | null,
  objects: ObjectRef[]
): NoteContext | null {
  if (!selection?.text.trim()) return null;

  const ctx: NoteContext = {};

  if (activeFile) {
    ctx.fileId = activeFile.id;
    ctx.fileName = activeFile.name;
  }

  const activeObjects = objects.filter((o) => o.status !== "DEPRECATED");

  const labelInText = selection.text.match(/\\label\{([^}]+)\}/);
  if (labelInText) {
    const byLabel = activeObjects.find((o) => o.label === labelInText[1]);
    if (byLabel) {
      ctx.objectId = byLabel.id;
      if (byLabel.label) ctx.objectLabel = byLabel.label;
      return ctx;
    }
  }

  const overlapping = activeObjects.filter(
    (o) =>
      selection.startLine <= o.endLine && selection.endLine >= o.startLine
  );

  if (overlapping.length > 0) {
    const best = overlapping.sort((a, b) => {
      const aOverlap =
        Math.min(selection.endLine, a.endLine) -
        Math.max(selection.startLine, a.startLine);
      const bOverlap =
        Math.min(selection.endLine, b.endLine) -
        Math.max(selection.startLine, b.startLine);
      if (bOverlap !== aOverlap) return bOverlap - aOverlap;
      return a.endLine - a.startLine - (b.endLine - b.startLine);
    })[0];
    ctx.objectId = best.id;
    if (best.label) ctx.objectLabel = best.label;
  } else {
    const excerpt = selection.text.replace(/\s+/g, " ").trim();
    if (excerpt.length > 0) {
      ctx.selectedText =
        excerpt.length > MAX_EXCERPT
          ? excerpt.slice(0, MAX_EXCERPT) + "…"
          : excerpt;
    }
  }

  return Object.keys(ctx).length > 0 ? ctx : null;
}

export function formatSelectionPreview(ctx: NoteContext | null): string | null {
  if (!ctx) return null;
  const parts: string[] = [];
  if (ctx.objectLabel) parts.push(`@${ctx.objectLabel}`);
  else if (ctx.selectedText) parts.push(`"${ctx.selectedText}"`);
  if (ctx.fileName) parts.push(`in ${ctx.fileName}`);
  return parts.length > 0 ? parts.join(" ") : null;
}
