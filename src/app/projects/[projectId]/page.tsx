import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getProjectAccess } from "@/lib/permissions";
import { ProjectWorkspace } from "@/components/project/ProjectWorkspace";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const access = await getProjectAccess(projectId, session.user.id);
  if (!access) redirect("/dashboard");

  return <ProjectWorkspace projectId={projectId} />;
}
