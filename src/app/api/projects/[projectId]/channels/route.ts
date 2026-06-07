import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { ensureGeneralChannel } from "@/lib/chat/channels";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canView) return jsonError("Not found", 404);

  await ensureGeneralChannel(projectId, session!.user.id);

  const channels = await prisma.chatChannel.findMany({
    where: { projectId },
    orderBy: { position: "asc" },
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json(channels);
}

const createSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens"),
  description: z.string().max(200).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canEdit) return jsonError("Forbidden", 403);

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid channel name");

  const maxPos = await prisma.chatChannel.aggregate({
    where: { projectId },
    _max: { position: true },
  });

  try {
    const channel = await prisma.chatChannel.create({
      data: {
        projectId,
        name: parsed.data.name,
        description: parsed.data.description,
        position: (maxPos._max.position ?? -1) + 1,
        createdById: session!.user.id,
      },
    });
    return NextResponse.json(channel, { status: 201 });
  } catch {
    return jsonError("Channel name already exists", 409);
  }
}
