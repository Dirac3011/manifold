import { NextResponse } from "next/server";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";

type Params = { params: Promise<{ projectId: string; buildId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId, buildId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canView) return jsonError("Not found", 404);

  const build = await prisma.build.findFirst({
    where: { id: buildId, projectId, success: true },
  });
  if (!build?.pdfPath) return jsonError("PDF not found", 404);

  const pdf = await readFile(build.pdfPath);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="build-${buildId}.pdf"`,
    },
  });
}
