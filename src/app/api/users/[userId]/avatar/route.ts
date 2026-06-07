import { NextResponse } from "next/server";
import { readFile } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ userId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarPath: true },
  });

  if (!user?.avatarPath) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const data = await readFile(user.avatarPath);
    const ext = user.avatarPath.split(".").pop();
    const type =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
