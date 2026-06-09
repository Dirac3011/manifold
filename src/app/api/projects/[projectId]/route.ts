import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
});

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access) return jsonError("Not found", 404);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true, username: true, email: true } },
      members: {
        include: { user: { select: { id: true, name: true, username: true, email: true } } },
      },
      files: { orderBy: { path: "asc" } },
      _count: { select: { mathObjects: true, builds: true } },
    },
  });

  return NextResponse.json({
    ...project,
    access: {
      ...access,
      isOwner: access.isOwner,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canEdit) return jsonError("Forbidden", 403);

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input");

  const data: { name?: string; description?: string | null } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) data.description = parsed.data.description;

  if (Object.keys(data).length === 0) return jsonError("Nothing to update");

  const project = await prisma.project.update({
    where: { id: projectId },
    data,
    include: {
      owner: { select: { id: true, name: true, username: true, email: true } },
      members: {
        include: { user: { select: { id: true, name: true, username: true, email: true } } },
      },
      files: { orderBy: { path: "asc" } },
      _count: { select: { mathObjects: true, builds: true } },
    },
  });

  return NextResponse.json({
    ...project,
    access: { ...access, isOwner: access.isOwner },
  });
}
