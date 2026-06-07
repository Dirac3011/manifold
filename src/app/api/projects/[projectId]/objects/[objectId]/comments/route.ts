import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string; objectId: string }> };

const commentSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId, objectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canEdit) return jsonError("Forbidden", 403);

  const body = await req.json();
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input");

  const object = await prisma.mathObject.findFirst({
    where: { id: objectId, projectId },
    include: { thread: true },
  });
  if (!object) return jsonError("Object not found", 404);

  let threadId = object.thread?.id;
  if (!threadId) {
    const thread = await prisma.objectThread.create({
      data: { objectId },
    });
    threadId = thread.id;
  }

  const comment = await prisma.comment.create({
    data: {
      threadId,
      authorId: session!.user.id,
      content: parsed.data.content,
      parentId: parsed.data.parentId,
    },
    include: {
      author: { select: { id: true, name: true, username: true } },
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
