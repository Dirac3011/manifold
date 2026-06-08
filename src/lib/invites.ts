import crypto from "crypto";
import { ProjectRole } from "@prisma/client";
import { prisma } from "./prisma";

export const INVITE_EXPIRY_DAYS = 14;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function inviteUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/invite/${token}`;
}

export async function getValidInvite(token: string) {
  const invite = await prisma.projectInvite.findUnique({
    where: { token },
    include: {
      project: { select: { id: true, name: true, ownerId: true } },
      invitedBy: { select: { id: true, name: true, username: true, email: true } },
    },
  });

  if (!invite || invite.acceptedAt) return null;
  if (invite.expiresAt < new Date()) return null;

  return invite;
}

export async function isAlreadyMember(
  projectId: string,
  email: string
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      owner: { select: { email: true } },
      members: {
        include: { user: { select: { email: true } } },
      },
    },
  });
  if (!project) return false;
  if (normalizeEmail(project.owner.email) === normalized) return true;
  return project.members.some(
    (m) => normalizeEmail(m.user.email) === normalized
  );
}

export async function createOrRefreshInvite(params: {
  projectId: string;
  email: string;
  role: "EDITOR" | "VIEWER";
  invitedById: string;
}) {
  const email = normalizeEmail(params.email);
  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

  return prisma.projectInvite.upsert({
    where: {
      projectId_email: { projectId: params.projectId, email },
    },
    create: {
      projectId: params.projectId,
      email,
      role: params.role as ProjectRole,
      token,
      invitedById: params.invitedById,
      expiresAt,
    },
    update: {
      role: params.role as ProjectRole,
      token,
      invitedById: params.invitedById,
      expiresAt,
      acceptedAt: null,
    },
    include: {
      project: { select: { name: true } },
      invitedBy: { select: { name: true, username: true, email: true } },
    },
  });
}

export async function acceptProjectInvite(token: string, userId: string) {
  const invite = await getValidInvite(token);
  if (!invite) {
    return { error: "This invitation is invalid or has expired." as const };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    return { error: "Account not found." as const };
  }

  if (normalizeEmail(user.email) !== invite.email) {
    return {
      error: `Sign in as ${invite.email} to accept this invitation.`,
    };
  }

  if (invite.project.ownerId === userId) {
    return { error: "You already own this project." as const };
  }

  const role =
    invite.role === ProjectRole.VIEWER ? ProjectRole.VIEWER : ProjectRole.EDITOR;

  await prisma.$transaction([
    prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId: invite.projectId, userId },
      },
      create: {
        projectId: invite.projectId,
        userId,
        role,
        joinedAt: new Date(),
      },
      update: { role, joinedAt: new Date() },
    }),
    prisma.projectInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return { projectId: invite.projectId };
}
