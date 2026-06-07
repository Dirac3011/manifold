import { NextResponse } from "next/server";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string; channelId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { projectId, channelId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.isOwner) return jsonError("Only project owner can delete channels", 403);

  const channel = await prisma.chatChannel.findFirst({
    where: { id: channelId, projectId },
  });
  if (!channel) return jsonError("Not found", 404);
  if (channel.name === "general") return jsonError("Cannot delete the general channel", 400);

  await prisma.chatChannel.delete({ where: { id: channelId } });
  return NextResponse.json({ ok: true });
}
