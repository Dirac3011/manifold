import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      bio: true,
      avatarPath: true,
      createdAt: true,
    },
  });

  if (!user) return jsonError("Not found", 404);
  return NextResponse.json(user);
}

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input");

  const user = await prisma.user.update({
    where: { id: session!.user.id },
    data: parsed.data,
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      bio: true,
      avatarPath: true,
    },
  });

  return NextResponse.json(user);
}
