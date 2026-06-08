import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getProjectBootstrap } from "@/lib/project/bootstrap";
import { ProjectWorkspace } from "@/components/project/ProjectWorkspace";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const bootstrap = await getProjectBootstrap(projectId, session.user.id);
  if (!bootstrap) redirect("/dashboard");

  return <ProjectWorkspace projectId={projectId} initialData={bootstrap} />;
}
