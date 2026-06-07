import { NextResponse } from "next/server";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string; objectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId, objectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canView) return jsonError("Not found", 404);

  const object = await prisma.mathObject.findFirst({
    where: { id: objectId, projectId },
    select: { label: true, contentHash: true, file: { select: { path: true } } },
  });
  if (!object) return jsonError("Not found", 404);

  const snapshots = await prisma.sourceSnapshot.findMany({
    where: { projectId },
    include: { user: { select: { name: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const anchor = object.label || object.contentHash.slice(0, 8);
  const filePath = object.file.path;

  const history = snapshots
    .map((s) => {
      const files = s.files as Record<string, string>;
      const content = files[filePath] || "";
      const touched =
        (object.label && content.includes(`\\label{${object.label}}`)) ||
        content.includes(anchor);
      return touched
        ? {
            id: s.id,
            reason: s.reason,
            createdAt: s.createdAt,
            user: s.user,
          }
        : null;
    })
    .filter(Boolean)
    .slice(0, 10);

  return NextResponse.json(history);
}
