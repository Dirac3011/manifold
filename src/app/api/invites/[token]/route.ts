import { jsonError } from "@/lib/api";
import { getValidInvite } from "@/lib/invites";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;
  const invite = await getValidInvite(token);

  if (!invite) {
    return jsonError("This invitation is invalid or has expired.", 404);
  }

  return Response.json({
    projectId: invite.projectId,
    projectName: invite.project.name,
    role: invite.role,
    email: invite.email,
    expiresAt: invite.expiresAt,
    inviter: {
      name: invite.invitedBy.name,
      username: invite.invitedBy.username,
    },
  });
}
