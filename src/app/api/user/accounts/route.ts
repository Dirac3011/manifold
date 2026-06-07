import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const accounts = await prisma.account.findMany({
    where: { userId: session!.user.id },
    select: { provider: true, providerAccountId: true },
  });

  return NextResponse.json({
    google: accounts.some((a: { provider: string }) => a.provider === "google"),
    github: accounts.some((a: { provider: string }) => a.provider === "github"),
  });
}
