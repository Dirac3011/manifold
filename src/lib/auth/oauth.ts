import { Account, User } from "@prisma/client";
import { prisma } from "../prisma";

export async function uniqueUsername(email: string): Promise<string> {
  const base = email
    .split("@")[0]
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .slice(0, 24) || "user";
  let candidate = base;
  let n = 0;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${base}${++n}`;
  }
  return candidate;
}

type OAuthAccount = {
  provider: string;
  providerAccountId: string;
  type: string;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
};

export async function upsertOAuthUser(
  email: string,
  name: string | null | undefined,
  account: OAuthAccount
): Promise<User> {
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        username: await uniqueUsername(email),
        name: name || null,
        passwordHash: null,
      },
    });
  } else if (name && !user.name) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name },
    });
  }

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      },
    },
    create: {
      userId: user.id,
      type: account.type,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      access_token: account.access_token ?? null,
      refresh_token: account.refresh_token ?? null,
      expires_at: account.expires_at ?? null,
      token_type: account.token_type ?? null,
      scope: account.scope ?? null,
      id_token: account.id_token ?? null,
    },
    update: {
      access_token: account.access_token ?? null,
      refresh_token: account.refresh_token ?? null,
      expires_at: account.expires_at ?? null,
      token_type: account.token_type ?? null,
      scope: account.scope ?? null,
      id_token: account.id_token ?? null,
    },
  });

  return user;
}

export async function getGithubAccount(userId: string): Promise<Account | null> {
  return prisma.account.findFirst({
    where: { userId, provider: "github" },
  });
}
