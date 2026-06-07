import { prisma } from "../prisma";
import { getFileContent, putFileContent, getBranchSha } from "./client";
import { syncProjectFromLatex } from "../latex/sync-objects";

function repoPath(rootPath: string, filePath: string): string {
  const root = rootPath.replace(/\/$/, "");
  return root ? `${root}/${filePath}` : filePath;
}

export async function pullFromGithub(
  projectId: string,
  token: string
): Promise<{ updated: string[]; skipped: string[] }> {
  const link = await prisma.projectGitLink.findUnique({ where: { projectId } });
  if (!link) throw new Error("Project not linked to GitHub");

  const files = await prisma.file.findMany({ where: { projectId } });
  const updated: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const ghPath = repoPath(link.rootPath, file.path);
    const remote = await getFileContent(
      token,
      link.repoOwner,
      link.repoName,
      ghPath,
      link.branch
    );
    if (!remote) {
      skipped.push(file.path);
      continue;
    }
    if (remote.content !== file.content) {
      await prisma.file.update({
        where: { id: file.id },
        data: { content: remote.content },
      });
      updated.push(file.path);
    } else {
      skipped.push(file.path);
    }
  }

  const sha = await getBranchSha(token, link.repoOwner, link.repoName, link.branch);
  await prisma.projectGitLink.update({
    where: { projectId },
    data: { lastPullAt: new Date(), lastCommitSha: sha },
  });

  await syncProjectFromLatex(projectId).catch(console.error);

  return { updated, skipped };
}

export async function pushToGithub(
  projectId: string,
  token: string,
  userId: string
): Promise<{ pushed: string[] }> {
  const link = await prisma.projectGitLink.findUnique({ where: { projectId } });
  if (!link) throw new Error("Project not linked to GitHub");

  const files = await prisma.file.findMany({ where: { projectId } });
  const pushed: string[] = [];
  let lastSha = "";

  for (const file of files) {
    const ghPath = repoPath(link.rootPath, file.path);
    const existing = await getFileContent(
      token,
      link.repoOwner,
      link.repoName,
      ghPath,
      link.branch
    );
    if (existing && existing.content === file.content) continue;

    lastSha = await putFileContent(
      token,
      link.repoOwner,
      link.repoName,
      ghPath,
      link.branch,
      file.content,
      `Update ${file.path} from Manifold`,
      existing?.sha
    );
    pushed.push(file.path);
  }

  if (pushed.length === 0) {
    throw new Error("No changes to push");
  }

  await prisma.projectGitLink.update({
    where: { projectId },
    data: { lastPushAt: new Date(), lastCommitSha: lastSha },
  });

  await prisma.sourceSnapshot.create({
    data: {
      projectId,
      userId,
      reason: "git:push",
      files: Object.fromEntries(files.map((f) => [f.path, f.content])),
    },
  });

  return { pushed };
}
