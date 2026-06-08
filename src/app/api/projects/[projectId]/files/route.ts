import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { syncProjectFromLatex } from "@/lib/latex/sync-objects";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canView) return jsonError("Not found", 404);

  const files = await prisma.file.findMany({
    where: { projectId },
    orderBy: { path: "asc" },
  });
  return NextResponse.json(files);
}

const updateSchema = z.object({
  fileId: z.string(),
  content: z.string(),
  version: z.number().int().nonnegative().optional(),
  force: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canEdit) return jsonError("Forbidden", 403);

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input");

  const existing = await prisma.file.findFirst({
    where: { id: parsed.data.fileId, projectId },
  });
  if (!existing) return jsonError("File not found", 404);

  if (
    parsed.data.version !== undefined &&
    parsed.data.version !== existing.version &&
    !parsed.data.force
  ) {
    return NextResponse.json(
      {
        error: "Conflict",
        serverContent: existing.content,
        serverVersion: existing.version,
      },
      { status: 409 }
    );
  }

  const file = await prisma.file.update({
    where: { id: parsed.data.fileId, projectId },
    data: {
      content: parsed.data.content,
      version: { increment: 1 },
    },
  });

  // Snapshot on save
  const allFiles = await prisma.file.findMany({ where: { projectId } });
  await prisma.sourceSnapshot.create({
    data: {
      projectId,
      userId: session!.user.id,
      reason: "save",
      files: Object.fromEntries(allFiles.map((f) => [f.path, f.content])),
    },
  });

  try {
    await syncProjectFromLatex(projectId);
  } catch (err) {
    console.error("syncProjectFromLatex failed after save:", err);
  }

  return NextResponse.json(file);
}

const createFileSchema = z.object({
  name: z.string().min(1).max(200),
  content: z.string().default(""),
  isMain: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canEdit) return jsonError("Forbidden", 403);

  const body = await req.json();
  const parsed = createFileSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input");

  const path = parsed.data.name.includes("/")
    ? parsed.data.name
    : parsed.data.name;

  const existing = await prisma.file.findUnique({
    where: { projectId_path: { projectId, path } },
  });
  if (existing) return jsonError("File already exists", 409);

  if (parsed.data.isMain) {
    await prisma.file.updateMany({
      where: { projectId, isMain: true },
      data: { isMain: false },
    });
  }

  const file = await prisma.file.create({
    data: {
      projectId,
      name: path.split("/").pop() || path,
      path,
      content: parsed.data.content,
      isMain: parsed.data.isMain ?? false,
    },
  });

  return NextResponse.json(file, { status: 201 });
}
