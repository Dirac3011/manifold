import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { ensureGeneralChannel } from "@/lib/chat/channels";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string }> };

const MENTION_RE = /@([a-zA-Z][\w:-]*)/g;

function extractMentions(content: string): string[] {
  const mentions: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(content)) !== null) {
    mentions.push(m[1]);
  }
  return [...new Set(mentions)];
}

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canView) return jsonError("Not found", 404);

  const messages = await prisma.chatMessage.findMany({
    where: { projectId },
    include: {
      author: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return NextResponse.json(messages);
}

const messageSchema = z.object({
  content: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canEdit) return jsonError("Forbidden", 403);

  const body = await req.json();
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input");

  const general = await ensureGeneralChannel(projectId, session!.user.id);
  const mentions = extractMentions(parsed.data.content);

  const message = await prisma.chatMessage.create({
    data: {
      projectId,
      channelId: general.id,
      authorId: session!.user.id,
      content: parsed.data.content,
      mentions,
    },
    include: {
      author: { select: { id: true, name: true, username: true } },
    },
  });

  return NextResponse.json(message, { status: 201 });
}
