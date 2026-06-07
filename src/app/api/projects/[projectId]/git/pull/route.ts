import { NextResponse } from "next/server";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { getGithubAccount } from "@/lib/auth/oauth";
import { pullFromGithub } from "@/lib/github/sync";

type Params = { params: Promise<{ projectId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canEdit) return jsonError("Forbidden", 403);

  const account = await getGithubAccount(session!.user.id);
  if (!account?.access_token) {
    return jsonError("Connect GitHub first (sign in with GitHub)", 400);
  }

  try {
    const result = await pullFromGithub(projectId, account.access_token);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Pull failed", 500);
  }
}
