import { prisma } from "../prisma";

export async function ensureGeneralChannel(
  projectId: string,
  createdById: string
) {
  let channel = await prisma.chatChannel.findFirst({
    where: { projectId, name: "general" },
  });

  if (!channel) {
    channel = await prisma.chatChannel.create({
      data: {
        projectId,
        name: "general",
        description: "Project notes",
        position: 0,
        createdById,
      },
    });
  }

  const orphans = await prisma.chatMessage.count({
    where: { projectId, channelId: null },
  });
  if (orphans > 0) {
    await prisma.chatMessage.updateMany({
      where: { projectId, channelId: null },
      data: { channelId: channel.id },
    });
  }

  return channel;
}

export const MENTION_RE = /@([a-zA-Z][\w:-]*)/g;

export function extractMentions(content: string): string[] {
  const mentions: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(content)) !== null) {
    mentions.push(m[1]);
  }
  return [...new Set(mentions)];
}
