import { ProjectRole } from "@prisma/client";
import { prisma } from "./prisma";

export type ProjectAccess = {
  role: ProjectRole;
  canEdit: boolean;
  canView: boolean;
  isOwner: boolean;
};

const ROLE_RANK: Record<ProjectRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

export async function getProjectAccess(
  projectId: string,
  userId: string
): Promise<ProjectAccess | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: { where: { userId } } },
  });
  if (!project) return null;

  let role: ProjectRole | null = null;
  if (project.ownerId === userId) {
    role = ProjectRole.OWNER;
  } else if (project.members[0]) {
    role = project.members[0].role;
  }
  if (!role) return null;

  return {
    role,
    canView: ROLE_RANK[role] >= ROLE_RANK.VIEWER,
    canEdit: ROLE_RANK[role] >= ROLE_RANK.EDITOR,
    isOwner: role === ProjectRole.OWNER,
  };
}

export function canEdit(role: ProjectRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.EDITOR;
}
