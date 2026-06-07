import { NextResponse } from "next/server";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseLatexFile } from "@/lib/latex/parser";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canView) return jsonError("Not found", 404);

  const files = await prisma.file.findMany({ where: { projectId } });
  const mainFile = files.find((f) => f.isMain);

  const references = await prisma.reference.findMany({ where: { projectId } });
  const labels = await prisma.label.findMany({ where: { projectId } });
  const dependencies = await prisma.objectDependency.findMany({
    where: { from: { projectId } },
    include: {
      from: { select: { id: true, label: true, type: true, title: true } },
      to: { select: { id: true, label: true, type: true, title: true } },
    },
  });

  let crossRefAnalysis = {
    missingReferences: [] as string[],
    unusedLabels: [] as string[],
    duplicateLabels: [] as string[],
  };

  if (mainFile) {
    const parsed = parseLatexFile(mainFile.content, mainFile.path);
    const labelSet = new Set(parsed.allLabels);
    const refTargets = new Set(parsed.references.map((r) => r.targetLabel));

    crossRefAnalysis.missingReferences = [...refTargets].filter(
      (t) => !labelSet.has(t)
    );

    const usedLabels = new Set<string>();
    for (const ref of parsed.references) usedLabels.add(ref.targetLabel);
    crossRefAnalysis.unusedLabels = parsed.allLabels.filter(
      (l) => !usedLabels.has(l)
    );

    const counts = new Map<string, number>();
    for (const l of parsed.allLabels) {
      counts.set(l, (counts.get(l) || 0) + 1);
    }
    crossRefAnalysis.duplicateLabels = [...counts.entries()]
      .filter(([, c]) => c > 1)
      .map(([k]) => k);
  }

  return NextResponse.json({
    references,
    labels,
    dependencies,
    analysis: crossRefAnalysis,
  });
}
