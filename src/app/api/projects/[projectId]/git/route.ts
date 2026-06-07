import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canView) return jsonError("Not found", 404);

  const link = await prisma.projectGitLink.findUnique({ where: { projectId } });
  return NextResponse.json({ link });
}

const linkSchema = z.object({
  repoOwner: z.string().min(1),
  repoName: z.string().min(1),
  branch: z.string().default("main"),
  rootPath: z.string().default(""),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.isOwner) return jsonError("Forbidden", 403);

  const body = await req.json();
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input");

  const link = await prisma.projectGitLink.upsert({
    where: { projectId },
    create: { projectId, ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json(link);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.isOwner) return jsonError("Forbidden", 403);

  await prisma.projectGitLink.deleteMany({ where: { projectId } });
  return NextResponse.json({ ok: true });
}
