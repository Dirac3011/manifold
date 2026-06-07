import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ProjectRole } from "@prisma/client";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canView) return jsonError("Not found", 404);

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: {
      user: {
        select: { id: true, name: true, username: true, email: true, avatarPath: true },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const owner = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      owner: {
        select: { id: true, name: true, username: true, email: true, avatarPath: true },
      },
    },
  });

  return NextResponse.json({
    owner: owner?.owner,
    members,
    access,
  });
}

const inviteSchema = z.object({
  emailOrUsername: z.string().min(1),
  role: z.enum(["EDITOR", "VIEWER"]).default("EDITOR"),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.isOwner) return jsonError("Forbidden", 403);

  const body = await req.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input");

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: parsed.data.emailOrUsername },
        { username: parsed.data.emailOrUsername },
      ],
    },
  });
  if (!user) return jsonError("User not found", 404);

  if (user.id === session!.user.id) {
    return jsonError("You are already the project owner");
  }

  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: user.id } },
    create: {
      projectId,
      userId: user.id,
      role: parsed.data.role as ProjectRole,
      joinedAt: new Date(),
    },
    update: { role: parsed.data.role as ProjectRole },
    include: {
      user: { select: { id: true, name: true, username: true, email: true } },
    },
  });

  return NextResponse.json(member, { status: 201 });
}
