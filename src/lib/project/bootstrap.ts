import { ProjectRole } from "@prisma/client";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { objectListInclude } from "./object-list";

export type ProjectBootstrap = {
  project: {
    id: string;
    name: string;
    description: string | null;
    access: {
      canEdit: boolean;
      canView: boolean;
      isOwner: boolean;
      role: ProjectRole;
    };
    owner: { id: string; name: string | null; username: string };
    members: Array<{ user: { id: string; name: string | null; username: string } }>;
  };
    files: Array<{
    id: string;
    name: string;
    path: string;
    content: string;
    isMain: boolean;
    version: number;
  }>;
  mainFileId: string | null;
  objects: Awaited<ReturnType<typeof loadObjectList>>;
  lastPdfUrl: string | null;
  lastCompileAt: string | null;
};

async function loadObjectList(projectId: string) {
  return prisma.mathObject.findMany({
    where: { projectId },
    include: objectListInclude,
    orderBy: [{ startLine: "asc" }],
  });
}

export async function getProjectBootstrap(
  projectId: string,
  userId: string
): Promise<ProjectBootstrap | null> {
  const access = await getProjectAccess(projectId, userId);
  if (!access) return null;

  const [project, objects, lastBuild] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: { id: true, name: true, username: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, username: true } },
          },
        },
        files: { orderBy: { path: "asc" } },
      },
    }),
    loadObjectList(projectId),
    prisma.build.findFirst({
      where: { projectId, success: true, pdfPath: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }),
  ]);

  if (!project) return null;

  const main =
    project.files.find((f) => f.isMain) ?? project.files[0] ?? null;

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      access: {
        canEdit: access.canEdit,
        canView: access.canView,
        isOwner: access.isOwner,
        role: access.role,
      },
      owner: project.owner,
      members: project.members,
    },
    files: project.files.map((f) => ({
      id: f.id,
      name: f.name,
      path: f.path,
      content: f.content,
      isMain: f.isMain,
      version: f.version,
    })),
    mainFileId: main?.id ?? null,
    objects,
    lastPdfUrl: lastBuild
      ? `/api/projects/${projectId}/pdf/${lastBuild.id}`
      : null,
    lastCompileAt: lastBuild?.createdAt.toISOString() ?? null,
  };
}
