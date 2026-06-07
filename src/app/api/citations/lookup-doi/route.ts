import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError } from "@/lib/api";
import { lookupDoi } from "@/lib/citations/doi";

const schema = z.object({
  doi: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid DOI");

  try {
    const result = await lookupDoi(parsed.data.doi);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "DOI lookup failed", 400);
  }
}
