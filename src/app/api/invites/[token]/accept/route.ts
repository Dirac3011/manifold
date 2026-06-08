import { requireAuth, jsonError } from "@/lib/api";
import { acceptProjectInvite } from "@/lib/invites";

type Params = { params: Promise<{ token: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { token } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const result = await acceptProjectInvite(token, session!.user.id);

  if ("error" in result) {
    return jsonError(result.error ?? "Could not accept invitation", 400);
  }

  return Response.json({ projectId: result.projectId });
}
