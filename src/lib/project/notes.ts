import { NoteContext } from "@/lib/discussion/types";
import { prisma } from "@/lib/prisma";

export type ProjectNoteRecord = {
  id: string;
  content: string;
  mentions: string[];
  noteType: string;
  context: NoteContext | null;
  createdAt: string;
  author: { id: string; name: string | null; username: string };
  channelId: string | null;
  legacyChannelName: string | null;
};

export type ProjectNotesPayload = {
  notes: ProjectNoteRecord[];
  generalChannelId: string | null;
};

/** Read project notes without creating channels (fast path for GET). */
export async function loadProjectNotes(
  projectId: string
): Promise<ProjectNotesPayload> {
  const general = await prisma.chatChannel.findFirst({
    where: { projectId, name: "general" },
    select: { id: true },
  });

  if (general) {
    const orphans = await prisma.chatMessage.count({
      where: { projectId, channelId: null },
    });
    if (orphans > 0) {
      await prisma.chatMessage.updateMany({
        where: { projectId, channelId: null },
        data: { channelId: general.id },
      });
    }
  }

  const messages = await prisma.chatMessage.findMany({
    where: general
      ? { projectId, channelId: general.id }
      : { projectId, channelId: { not: null } },
    include: {
      author: { select: { id: true, name: true, username: true } },
      channel: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  return {
    generalChannelId: general?.id ?? null,
    notes: messages.map((m) => ({
      id: m.id,
      content: m.content,
      mentions: m.mentions,
      noteType: m.noteType,
      context: (m.context as NoteContext | null) ?? null,
      createdAt: m.createdAt.toISOString(),
      author: m.author,
      channelId: m.channelId,
      legacyChannelName:
        m.channel?.name && m.channel.name !== "general"
          ? m.channel.name
          : null,
    })),
  };
}
