import { NextRequest, NextResponse } from "next/server";
import { requireAuth, jsonError } from "@/lib/api";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const access = await getProjectAccess(projectId, session!.user.id);
  if (!access?.canView) return jsonError("Not found", 404);

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const [files, objects, citations] = await Promise.all([
    prisma.file.findMany({ where: { projectId }, select: { id: true, name: true, path: true, content: true } }),
    prisma.mathObject.findMany({
      where: { projectId },
      select: { id: true, type: true, label: true, title: true, rawLatex: true, startLine: true, status: true },
    }),
    prisma.citation.findMany({
      where: { projectId },
      select: { id: true, key: true, title: true, authors: true, rawBibtex: true },
    }),
  ]);

  type Result = {
    kind: "file" | "object" | "citation";
    id: string;
    label: string;
    detail?: string;
    line?: number;
  };

  const results: Result[] = [];

  for (const f of files) {
    if (f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)) {
      results.push({ kind: "file", id: f.id, label: f.name, detail: f.path });
    } else {
      const idx = f.content.toLowerCase().indexOf(q);
      if (idx >= 0) {
        const line = f.content.slice(0, idx).split("\n").length;
        results.push({ kind: "file", id: f.id, label: f.name, detail: `Line ${line}`, line });
      }
    }
  }

  for (const o of objects) {
    const hay = [o.type, o.label, o.title, o.rawLatex].filter(Boolean).join(" ").toLowerCase();
    if (hay.includes(q)) {
      results.push({
        kind: "object",
        id: o.id,
        label: o.label || `${o.type} L${o.startLine}`,
        detail: o.status === "DEPRECATED" ? "archived" : o.type,
        line: o.startLine,
      });
    }
  }

  for (const c of citations) {
    const hay = [c.key, c.title, c.authors, c.rawBibtex].filter(Boolean).join(" ").toLowerCase();
    if (hay.includes(q)) {
      results.push({ kind: "citation", id: c.id, label: c.key, detail: c.title || undefined });
    }
  }

  return NextResponse.json({ results: results.slice(0, 40) });
}
