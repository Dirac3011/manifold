import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string; commentId: string }> };

const patchSchema = z.object({
  resolved: z.boolean().optional(),
  content: z.string().min(1).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId, commentId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canEdit) return jsonError("Forbidden", 403);

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input");

  const comment = await prisma.comment.findFirst({
    where: { id: commentId },
    include: { thread: { include: { object: true } } },
  });
  if (!comment || comment.thread.object.projectId !== projectId) {
    return jsonError("Not found", 404);
  }

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: parsed.data,
    include: {
      author: { select: { id: true, name: true, username: true } },
    },
  });

  return NextResponse.json(updated);
}
