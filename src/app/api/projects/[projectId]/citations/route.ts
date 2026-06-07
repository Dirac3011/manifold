import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseBibtex, analyzeCitations } from "@/lib/latex/citations";
import { upsertProjectCitation } from "@/lib/citations/upsert";
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
  const bibFile = files.find((f) => f.path.endsWith(".bib"));

  const citations = await prisma.citation.findMany({
    where: { projectId },
    orderBy: { key: "asc" },
  });

  let analysis = { used: [] as string[], unused: [] as string[], missing: [] as string[] };
  if (mainFile && bibFile) {
    const parsed = parseLatexFile(mainFile.content, mainFile.path);
    const bibKeys = parseBibtex(bibFile.content).map((e) => e.key);
    const usedKeys = parsed.citationUsages.map((c) => c.key);
    analysis = analyzeCitations(bibKeys, usedKeys);
  }

  return NextResponse.json({ citations, analysis });
}

const citationSchema = z.object({
  key: z.string().min(1),
  rawBibtex: z.string().min(1),
  doi: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canEdit) return jsonError("Forbidden", 403);

  const body = await req.json();
  const parsed = citationSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input");

  const citation = await upsertProjectCitation(
    projectId,
    parsed.data.key,
    parsed.data.rawBibtex,
    parsed.data.doi
  );

  return NextResponse.json(citation, { status: 201 });
}
