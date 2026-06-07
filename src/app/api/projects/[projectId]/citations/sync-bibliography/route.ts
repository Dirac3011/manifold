import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseLatexFile } from "@/lib/latex/parser";
import { parseBibtex } from "@/lib/latex/citations";
import {
  detectBibliographyMode,
  ensureBibtexBibliography,
  resolveBibFilePath,
  syncBibFileContent,
  syncInlineBibliography,
} from "@/lib/citations/bibliography";
import { syncProjectFromLatex } from "@/lib/latex/sync-objects";

type Params = { params: Promise<{ projectId: string }> };

const schema = z.object({
  scope: z.enum(["used", "all"]).default("used"),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canEdit) return jsonError("Forbidden", 403);

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const scope = parsed.success ? parsed.data.scope : "used";

  const files = await prisma.file.findMany({ where: { projectId } });
  const mainFile = files.find((f) => f.isMain) || files.find((f) => f.path.endsWith(".tex"));
  if (!mainFile) return jsonError("No main LaTeX file");

  const citations = await prisma.citation.findMany({ where: { projectId } });
  const parsedLatex = parseLatexFile(mainFile.content, mainFile.path);
  const usedKeys = [...new Set(parsedLatex.citationUsages.map((c) => c.key))];

  const keysToSync =
    scope === "all" ? citations.map((c) => c.key) : usedKeys;

  const citationRows = citations.filter((c) => keysToSync.includes(c.key));

  let mainTex = mainFile.content;
  const { mode, bibResource } = detectBibliographyMode(mainTex);
  let bibFilePath: string | null = null;
  let bibFileUpdated = false;
  let mainTexUpdated = false;
  let addedToBib: string[] = [];
  let addedBibitems: string[] = [];
  let ensuredBibliographyCommand = false;

  if (mode === "inline") {
    const synced = syncInlineBibliography(mainTex, citations, usedKeys);
    mainTex = synced.content;
    addedBibitems = synced.added;
    mainTexUpdated = synced.added.length > 0;
  } else {
    const resource = bibResource || "references";
    if (mode === "none") {
      const ensured = ensureBibtexBibliography(mainTex, resource);
      mainTex = ensured.content;
      ensuredBibliographyCommand = ensured.added;
      mainTexUpdated = ensured.added;
    }

    bibFilePath = resolveBibFilePath(resource, files);
    let bibFile = files.find((f) => f.path === bibFilePath);

    if (!bibFile) {
      bibFile = await prisma.file.create({
        data: {
          projectId,
          name: bibFilePath,
          path: bibFilePath,
          content: "",
          isMain: false,
        },
      });
    }

    const synced = syncBibFileContent(bibFile.content, citationRows, {
      onlyUsed: scope === "used" ? usedKeys : undefined,
    });

    if (synced.added.length > 0 || synced.content !== bibFile.content) {
      await prisma.file.update({
        where: { id: bibFile.id },
        data: { content: synced.content },
      });
      bibFileUpdated = true;
      addedToBib = synced.added;
    }
  }

  if (mainTexUpdated) {
    await prisma.file.update({
      where: { id: mainFile.id },
      data: { content: mainTex },
    });
  }

  await syncProjectFromLatex(projectId).catch(console.error);

  let finalBibKeys: string[] = [];
  if (bibFilePath) {
    const updatedBib = await prisma.file.findFirst({
      where: { projectId, path: bibFilePath },
    });
    finalBibKeys = updatedBib ? parseBibtex(updatedBib.content).map((e) => e.key) : [];
  }
  const stillMissing = usedKeys.filter(
    (k) =>
      !finalBibKeys.includes(k) &&
      !addedToBib.includes(k) &&
      !addedBibitems.includes(k)
  );

  return NextResponse.json({
    mode: mode === "none" ? "bibtex" : mode,
    bibFilePath,
    bibFileUpdated,
    mainTexUpdated,
    addedToBib,
    addedBibitems,
    ensuredBibliographyCommand,
    stillMissing,
    message:
      addedToBib.length + addedBibitems.length > 0
        ? `Added ${addedToBib.length + addedBibitems.length} citation(s) to bibliography`
        : ensuredBibliographyCommand
          ? "Bibliography section created — entries will sync as you add citations"
          : "Bibliography already up to date",
  });
}
