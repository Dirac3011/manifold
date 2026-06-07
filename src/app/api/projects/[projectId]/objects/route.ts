import { NextRequest, NextResponse } from "next/server";
import { ObjectStatus, MathObjectType } from "@prisma/client";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canView) return jsonError("Not found", 404);

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as MathObjectType | null;
  const status = searchParams.get("status") as ObjectStatus | null;
  const assigneeId = searchParams.get("assigneeId");
  const hasUnresolved = searchParams.get("hasUnresolved") === "true";
  const missingLabel = searchParams.get("missingLabel") === "true";
  const hasProof = searchParams.get("hasProof") === "true";

  const objects = await prisma.mathObject.findMany({
    where: {
      projectId,
      ...(type && { type }),
      ...(status && { status }),
      ...(assigneeId && { assigneeId }),
      ...(missingLabel && { label: null }),
      ...(hasProof && { proofLatex: { not: null } }),
      ...(hasUnresolved && {
        thread: { comments: { some: { resolved: false } } },
      }),
    },
    include: {
      assignee: { select: { id: true, name: true, username: true } },
      thread: {
        include: {
          comments: {
            where: { resolved: false },
            select: { id: true },
          },
        },
      },
      citedIn: { include: { citation: true } },
      depsFrom: { include: { to: { select: { id: true, label: true, type: true, title: true } } } },
      file: { select: { path: true } },
    },
    orderBy: [{ startLine: "asc" }],
  });

  return NextResponse.json(objects);
}
