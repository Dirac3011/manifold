import { NextResponse } from "next/server";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access) return jsonError("Not found", 404);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true, username: true, email: true } },
      members: {
        include: { user: { select: { id: true, name: true, username: true, email: true } } },
      },
      files: { orderBy: { path: "asc" } },
      _count: { select: { mathObjects: true, builds: true } },
    },
  });

  return NextResponse.json({
    ...project,
    access: {
      ...access,
      isOwner: access.isOwner,
    },
  });
}
