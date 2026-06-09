import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { syncProjectFromLatex } from "@/lib/latex/sync-objects";
import {
  defaultProjectName,
  getTemplateFiles,
} from "@/lib/project/templates";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  template: z.enum(["sample", "blank", "notes"]).optional(),
  description: z.string().optional(),
});

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: session!.user.id },
        { members: { some: { userId: session!.user.id } } },
      ],
    },
    include: {
      owner: { select: { id: true, name: true, username: true } },
      _count: { select: { mathObjects: true, members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input");

  const template = parsed.data.template ?? "sample";
  const name = parsed.data.name?.trim() || defaultProjectName(template);
  const files = getTemplateFiles(template);

  const project = await prisma.project.create({
    data: {
      name,
      description: parsed.data.description,
      ownerId: session!.user.id,
      members: {
        create: { userId: session!.user.id, role: "OWNER", joinedAt: new Date() },
      },
      files: { create: files },
    },
    include: { files: true },
  });

  try {
    await syncProjectFromLatex(project.id);
  } catch (err) {
    console.error("syncProjectFromLatex failed after project create:", err);
  }

  return NextResponse.json(project, { status: 201 });
}
