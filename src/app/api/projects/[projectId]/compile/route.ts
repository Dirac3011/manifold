import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { compileLatex } from "@/lib/latex/compile";
import { parseCompileProfile } from "@/lib/latex/compilers";
import { syncProjectFromLatex } from "@/lib/latex/sync-objects";

type Params = { params: Promise<{ projectId: string }> };

const bodySchema = z.object({
  compiler: z.enum(["draft", "standard", "final"]).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canEdit) return jsonError("Forbidden", 403);

  let compiler = parseCompileProfile(undefined);
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (parsed.success && parsed.data.compiler) {
      compiler = parseCompileProfile(parsed.data.compiler);
    }
  } catch {
    // empty body — use default draft profile
  }

  const files = await prisma.file.findMany({ where: { projectId } });
  const mainFile = files.find((f) => f.isMain)?.path || "main.tex";

  const result = await compileLatex(
    projectId,
    files.map((f) => ({ path: f.path, content: f.content })),
    mainFile,
    compiler
  );

  const build = await prisma.build.create({
    data: {
      projectId,
      success: result.success,
      log: result.log,
      pdfPath: result.pdfRelativePath,
      compilerProfile: result.profile,
    },
  });

  if (result.success) {
    await prisma.sourceSnapshot.create({
      data: {
        projectId,
        userId: session!.user.id,
        reason: `compile:${result.profile}`,
        files: Object.fromEntries(files.map((f) => [f.path, f.content])),
      },
    });
    await syncProjectFromLatex(projectId);
  }

  return NextResponse.json({
    buildId: build.id,
    success: result.success,
    log: result.log,
    compiler: result.profile,
    pdfUrl: result.pdfRelativePath
      ? `/api/projects/${projectId}/pdf/${build.id}`
      : null,
  });
}
