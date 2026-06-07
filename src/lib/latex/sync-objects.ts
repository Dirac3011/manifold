/**
 * Sync parsed LaTeX objects to database — preserves threads when labels change.
 */
import { prisma } from "../prisma";
import { parseLatexFile } from "./parser";
import { parseBibtex } from "./citations";

export async function syncProjectFromLatex(projectId: string): Promise<void> {
  const files = await prisma.file.findMany({ where: { projectId } });
  const mainFile = files.find((f) => f.isMain) || files.find((f) => f.path.endsWith(".tex"));
  const bibFile = files.find((f) => f.path.endsWith(".bib"));

  if (!mainFile) return;

  const parseResult = parseLatexFile(mainFile.content, mainFile.path);
  const allLabelKeys = new Set(parseResult.allLabels);

  // Sync citations from bib file
  if (bibFile) {
    const bibEntries = parseBibtex(bibFile.content);
    for (const entry of bibEntries) {
      await prisma.citation.upsert({
        where: { projectId_key: { projectId, key: entry.key } },
        create: {
          projectId,
          key: entry.key,
          rawBibtex: entry.rawBibtex,
          title: entry.title,
          authors: entry.authors,
          year: entry.year,
        },
        update: {
          rawBibtex: entry.rawBibtex,
          title: entry.title,
          authors: entry.authors,
          year: entry.year,
        },
      });
    }
  }

  const existingObjects = await prisma.mathObject.findMany({
    where: { projectId },
    include: { thread: true },
  });

  const existingByLabel = new Map(
    existingObjects.filter((o) => o.label).map((o) => [o.label!, o])
  );
  const existingByHash = new Map(existingObjects.map((o) => [o.contentHash, o]));

  const seenIds = new Set<string>();

  for (const parsed of parseResult.objects) {
    let existing =
      (parsed.label && existingByLabel.get(parsed.label)) ||
      existingByHash.get(parsed.contentHash);

    if (existing) {
      await prisma.mathObject.update({
        where: { id: existing.id },
        data: {
          type: parsed.type,
          label: parsed.label,
          title: parsed.title,
          rawLatex: parsed.rawLatex,
          proofLatex: parsed.proofLatex,
          startLine: parsed.startLine,
          endLine: parsed.endLine,
          contentHash: parsed.contentHash,
          fileId: mainFile.id,
          ...(existing.status === "DEPRECATED" ? { status: "DRAFT" as const } : {}),
        },
      });
      seenIds.add(existing.id);
    } else {
      const created = await prisma.mathObject.create({
        data: {
          projectId,
          fileId: mainFile.id,
          type: parsed.type,
          label: parsed.label,
          title: parsed.title,
          rawLatex: parsed.rawLatex,
          proofLatex: parsed.proofLatex,
          startLine: parsed.startLine,
          endLine: parsed.endLine,
          contentHash: parsed.contentHash,
          thread: { create: {} },
        },
      });
      seenIds.add(created.id);
      existing = { ...created, thread: null };
    }

    const objectId = existing!.id;

    // Sync object citations
    await prisma.objectCitation.deleteMany({ where: { objectId } });
    for (const citeKey of parsed.citations) {
      const citation = await prisma.citation.findUnique({
        where: { projectId_key: { projectId, key: citeKey } },
      });
      if (citation) {
        await prisma.objectCitation.create({
          data: { objectId, citationId: citation.id, citeKey },
        });
      }
    }

    // Sync label record
    if (parsed.label) {
      await prisma.label.upsert({
        where: { projectId_key: { projectId, key: parsed.label } },
        create: {
          projectId,
          objectId,
          key: parsed.label,
          fileId: mainFile.id,
          line: parsed.startLine,
        },
        update: { objectId, line: parsed.startLine },
      });
    }
  }

  // Sync references and dependencies
  await prisma.reference.deleteMany({ where: { projectId } });
  await prisma.objectDependency.deleteMany({
    where: { fromId: { in: [...seenIds] } },
  });

  const objectByLabel = new Map<string, string>();
  const allObjects = await prisma.mathObject.findMany({ where: { projectId } });
  for (const obj of allObjects) {
    if (obj.label) objectByLabel.set(obj.label, obj.id);
  }

  for (let i = 0; i < parseResult.objects.length; i++) {
    const parsed = parseResult.objects[i];
    const fromObj = parsed.label
      ? allObjects.find((o) => o.label === parsed.label)
      : allObjects.find((o) => o.contentHash === parsed.contentHash);
    if (!fromObj) continue;

    for (const ref of parsed.refs) {
      const resolved = allLabelKeys.has(ref.targetLabel);
      await prisma.reference.create({
        data: {
          projectId,
          sourceObjectId: fromObj.id,
          targetLabel: ref.targetLabel,
          refType: ref.refType,
          sourceLine: ref.line,
          resolved,
        },
      });

      const toId = objectByLabel.get(ref.targetLabel);
      if (toId && toId !== fromObj.id) {
        await prisma.objectDependency.upsert({
          where: {
            fromId_toId_refLabel: {
              fromId: fromObj.id,
              toId,
              refLabel: ref.targetLabel,
            },
          },
          create: {
            fromId: fromObj.id,
            toId,
            refLabel: ref.targetLabel,
          },
          update: {},
        });
      }
    }
  }

  // Mark orphaned objects as deprecated — threads and comments are preserved
  for (const obj of existingObjects) {
    if (!seenIds.has(obj.id) && obj.status !== "DEPRECATED") {
      await prisma.mathObject.update({
        where: { id: obj.id },
        data: { status: "DEPRECATED" },
      });
    }
  }
}
