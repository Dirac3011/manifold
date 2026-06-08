import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string; inviteId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { projectId, inviteId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.isOwner) return jsonError("Forbidden", 403);

  const invite = await prisma.projectInvite.findFirst({
    where: { id: inviteId, projectId, acceptedAt: null },
  });
  if (!invite) return jsonError("Invite not found", 404);

  await prisma.projectInvite.delete({ where: { id: inviteId } });

  return new Response(null, { status: 204 });
}
