import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { isEmailConfigured } from "@/lib/email";
import {
  createOrRefreshInvite,
  inviteUrl,
  isAlreadyMember,
  normalizeEmail,
} from "@/lib/invites";
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

  const pendingRaw =
    access.isOwner
      ? await prisma.projectInvite.findMany({
          where: { projectId, acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            role: true,
            token: true,
            createdAt: true,
            expiresAt: true,
          },
        })
      : [];

  const pendingInvites = pendingRaw.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt,
    inviteUrl: inviteUrl(inv.token),
  }));

  return NextResponse.json({
    owner: owner?.owner,
    members,
    pendingInvites,
    emailDeliveryEnabled: isEmailConfigured(),
    access,
  });
}

const inviteSchema = z.object({
  email: z.string().email(),
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
  if (!parsed.success) return jsonError("Enter a valid email address");

  const email = normalizeEmail(parsed.data.email);

  const owner = await prisma.project.findUnique({
    where: { id: projectId },
    select: { owner: { select: { email: true } } },
  });
  if (owner && normalizeEmail(owner.owner.email) === email) {
    return jsonError("You are already the project owner");
  }

  if (await isAlreadyMember(projectId, email)) {
    return jsonError("This person is already a collaborator");
  }

  const invite = await createOrRefreshInvite({
    projectId,
    email,
    role: parsed.data.role,
    invitedById: session!.user.id,
  });

  const url = inviteUrl(invite.token);

  return NextResponse.json(
    {
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        inviteUrl: url,
      },
    },
    { status: 201 }
  );
}
