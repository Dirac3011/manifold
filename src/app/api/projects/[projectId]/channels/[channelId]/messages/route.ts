import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { extractMentions } from "@/lib/chat/channels";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ projectId: string; channelId: string }>;
};

const messageSchema = z
  .object({
    content: z.string(),
    forwardedFromId: z.string().optional(),
  })
  .refine((d) => d.content.trim().length > 0 || d.forwardedFromId, {
    message: "Message cannot be empty",
  });

export async function GET(_req: Request, { params }: Params) {
  const { projectId, channelId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canView) return jsonError("Not found", 404);

  const channel = await prisma.chatChannel.findFirst({
    where: { id: channelId, projectId },
  });
  if (!channel) return jsonError("Channel not found", 404);

  const messages = await prisma.chatMessage.findMany({
    where: { channelId },
    include: {
      author: { select: { id: true, name: true, username: true } },
      forwardedFrom: {
        include: {
          author: { select: { id: true, name: true, username: true } },
          channel: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 300,
  });

  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId, channelId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canEdit) return jsonError("Forbidden", 403);

  const channel = await prisma.chatChannel.findFirst({
    where: { id: channelId, projectId },
  });
  if (!channel) return jsonError("Channel not found", 404);

  const body = await req.json();
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input");

  let content = parsed.data.content;
  let forwardedFromId: string | undefined;

  if (parsed.data.forwardedFromId) {
    const original = await prisma.chatMessage.findFirst({
      where: { id: parsed.data.forwardedFromId, projectId },
      include: {
        channel: { select: { name: true } },
        author: { select: { name: true, username: true } },
      },
    });
    if (!original) return jsonError("Original message not found", 404);
    forwardedFromId = original.id;
    if (!content.trim()) {
      const who = original.author.name || original.author.username;
      content = `↪ From #${original.channel?.name || "channel"} · ${who}:\n${original.content}`;
    }
  }

  const mentions = extractMentions(content);

  const message = await prisma.chatMessage.create({
    data: {
      projectId,
      channelId,
      authorId: session!.user.id,
      content,
      mentions,
      forwardedFromId,
    },
    include: {
      author: { select: { id: true, name: true, username: true } },
      forwardedFrom: {
        include: {
          author: { select: { id: true, name: true, username: true } },
          channel: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json(message, { status: 201 });
}
