import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { requireAuth, jsonError } from "@/lib/api";

import { ensureGeneralChannel, extractMentions } from "@/lib/chat/channels";

import { NoteContext } from "@/lib/discussion/types";

import { loadProjectNotes } from "@/lib/project/notes";

import { getProjectAccess } from "@/lib/permissions";

import { prisma } from "@/lib/prisma";

import { Prisma } from "@prisma/client";



type Params = { params: Promise<{ projectId: string }> };



const contextSchema = z

  .object({

    objectId: z.string().optional(),

    objectLabel: z.string().optional(),

    fileId: z.string().optional(),

    fileName: z.string().optional(),

    citationKey: z.string().optional(),

    compileError: z.string().optional(),

    selectedText: z.string().max(500).optional(),

  })

  .optional();



const createSchema = z.object({

  content: z.string().min(1),

  noteType: z

    .enum(["NOTE", "QUESTION", "DECISION", "TODO", "UPDATE"])

    .optional()

    .default("NOTE"),

  context: contextSchema,

});



export async function GET(_req: Request, { params }: Params) {

  const { projectId } = await params;

  const { error, session } = await requireAuth();

  if (error) return error;



  const access = await getProjectAccess(projectId, session!.user.id);

  if (!access?.canView) return jsonError("Not found", 404);



  const payload = await loadProjectNotes(projectId);

  return NextResponse.json(payload);

}



export async function POST(req: NextRequest, { params }: Params) {

  const { projectId } = await params;

  const { error, session } = await requireAuth();

  if (error) return error;



  const access = await getProjectAccess(projectId, session!.user.id);

  if (!access?.canEdit) return jsonError("Forbidden", 403);



  const body = await req.json();

  const parsed = createSchema.safeParse(body);

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

      noteType: parsed.data.noteType,

      context: parsed.data.context

        ? (parsed.data.context as Prisma.InputJsonValue)

        : undefined,

    },

    include: {

      author: { select: { id: true, name: true, username: true } },

      channel: { select: { id: true, name: true } },

    },

  });



  return NextResponse.json(

    {

      id: message.id,

      content: message.content,

      mentions: message.mentions,

      noteType: message.noteType,

      context: message.context,

      createdAt: message.createdAt.toISOString(),

      author: message.author,

      channelId: message.channelId,

      legacyChannelName: null,

    },

    { status: 201 }

  );

}


