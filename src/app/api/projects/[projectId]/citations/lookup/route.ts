import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { lookupCitation, lookupBulkBibtex, CitationSource } from "@/lib/citations/lookup";
import { upsertProjectCitation } from "@/lib/citations/upsert";
import { uniqueProjectKey } from "@/lib/citations/format";
import { prisma } from "@/lib/prisma";
import { syncProjectFromLatex } from "@/lib/latex/sync-objects";

type Params = { params: Promise<{ projectId: string }> };

const schema = z.object({
  source: z.enum(["doi", "arxiv", "isbn", "pmid", "bibtex", "url"]),
  value: z.string().min(1),
  key: z.string().optional(),
  save: z.boolean().optional().default(false),
});

const bulkSchema = z.object({
  source: z.literal("bibtex"),
  value: z.string().min(1),
  save: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canView) return jsonError("Not found", 404);

  const body = await req.json();

  try {
    if (body.bulk === true) {
      const parsed = bulkSchema.safeParse(body);
      if (!parsed.success) return jsonError("Invalid bulk BibTeX input");
      if (parsed.data.save && !access.canEdit) return jsonError("Forbidden", 403);

      const results = await lookupBulkBibtex(parsed.data.value);
      const saved = [];
      if (parsed.data.save) {
        for (const r of results) {
          const key = await uniqueProjectKey(projectId, r.suggestedKey);
          const citation = await upsertProjectCitation(projectId, key, r.bibtex);
          saved.push(citation);
        }
        await syncProjectFromLatex(projectId).catch(console.error);
      }
      return NextResponse.json({ results, saved }, { status: 201 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid lookup request");

    const lookup = await lookupCitation(
      parsed.data.source as CitationSource,
      parsed.data.value
    );

    let citation = null;
    if (parsed.data.save) {
      if (!access.canEdit) return jsonError("Forbidden", 403);
      const key =
        parsed.data.key ||
        (await uniqueProjectKey(projectId, lookup.suggestedKey));
      citation = await upsertProjectCitation(
        projectId,
        key,
        lookup.bibtex,
        lookup.source === "doi" ? lookup.identifier : null
      );
      await syncProjectFromLatex(projectId).catch(console.error);
    }

    return NextResponse.json({ ...lookup, citation }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Lookup failed", 400);
  }
}
