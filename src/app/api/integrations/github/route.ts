import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { getGithubAccount } from "@/lib/auth/oauth";
import { listUserRepos } from "@/lib/github/client";

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const account = await getGithubAccount(session!.user.id);
  if (!account?.access_token) {
    return NextResponse.json({ connected: false, repos: [] });
  }

  try {
    const repos = await listUserRepos(account.access_token);
    return NextResponse.json({
      connected: true,
      username: account.providerAccountId,
      repos: repos.map((r) => ({
        owner: r.owner.login,
        name: r.name,
        fullName: r.full_name,
        defaultBranch: r.default_branch,
        private: r.private,
      })),
    });
  } catch {
    return NextResponse.json({ connected: true, repos: [], error: "Token expired — sign in with GitHub again" });
  }
}
