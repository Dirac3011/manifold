import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { lookupDoi } from "@/lib/citations/doi";
import { upsertProjectCitation } from "@/lib/citations/upsert";
import { syncProjectFromLatex } from "@/lib/latex/sync-objects";

type Params = { params: Promise<{ projectId: string }> };

const schema = z.object({
  doi: z.string().min(1),
  key: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canEdit) return jsonError("Forbidden", 403);

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid DOI");

  try {
    const lookup = await lookupDoi(parsed.data.doi);
    const key = parsed.data.key || lookup.suggestedKey;
    const citation = await upsertProjectCitation(
      projectId,
      key,
      lookup.bibtex,
      lookup.metadata.doi
    );
    await syncProjectFromLatex(projectId).catch(console.error);
    return NextResponse.json({ ...lookup, citation }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "DOI lookup failed", 400);
  }
}
