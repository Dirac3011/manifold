import { NextResponse } from "next/server";
import { COMPILER_PROFILES, DEFAULT_COMPILE_PROFILE } from "@/lib/latex/compilers";

/** Public list of available compiler profiles for the UI */
export async function GET() {
  return NextResponse.json({
    default: DEFAULT_COMPILE_PROFILE,
    profiles: Object.values(COMPILER_PROFILES).map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
    })),
  });
}
