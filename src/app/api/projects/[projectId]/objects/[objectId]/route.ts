import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ObjectStatus } from "@prisma/client";
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
    include: {
      assignee: { select: { id: true, name: true, username: true } },
      file: { select: { id: true, path: true } },
      thread: {
        include: {
          comments: {
            include: {
              author: { select: { id: true, name: true, username: true } },
              replies: {
                include: {
                  author: { select: { id: true, name: true, username: true } },
                },
                orderBy: { createdAt: "asc" },
              },
            },
            where: { parentId: null },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      citedIn: { include: { citation: true } },
      depsFrom: { include: { to: { select: { id: true, label: true, type: true, title: true } } } },
      depsTo: { include: { from: { select: { id: true, label: true, type: true, title: true } } } },
    },
  });

  if (!object) return jsonError("Not found", 404);
  return NextResponse.json(object);
}

const updateSchema = z.object({
  status: z.nativeEnum(ObjectStatus).optional(),
  assigneeId: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId, objectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canEdit) return jsonError("Forbidden", 403);

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input");

  const object = await prisma.mathObject.update({
    where: { id: objectId, projectId },
    data: parsed.data,
  });

  return NextResponse.json(object);
}
