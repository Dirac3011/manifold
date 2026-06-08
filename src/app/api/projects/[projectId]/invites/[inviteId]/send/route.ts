import { requireAuth, jsonError } from "@/lib/api";
import { sendProjectInviteEmail, isEmailConfigured } from "@/lib/email";
import { inviteUrl } from "@/lib/invites";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string; inviteId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { projectId, inviteId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.isOwner) return jsonError("Forbidden", 403);

  if (!isEmailConfigured()) {
    return jsonError("Email delivery is not configured on this server", 503);
  }

  const invite = await prisma.projectInvite.findFirst({
    where: {
      id: inviteId,
      projectId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      project: { select: { name: true } },
      invitedBy: { select: { name: true, username: true, email: true } },
    },
  });

  if (!invite) return jsonError("Invite not found or expired", 404);

  const inviterName =
    invite.invitedBy.name ||
    invite.invitedBy.username ||
    invite.invitedBy.email;

  await sendProjectInviteEmail({
    to: invite.email,
    inviterName,
    projectName: invite.project.name,
    role: invite.role,
    inviteUrl: inviteUrl(invite.token),
  });

  return Response.json({ ok: true, emailSent: true });
}
