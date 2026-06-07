import { NextRequest, NextResponse } from "next/server";
import { requireAuth, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { writeFile } from "@/lib/storage";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const form = await req.formData();
  const file = form.get("avatar");
  if (!file || !(file instanceof Blob)) {
    return jsonError("No image provided");
  }

  if (!ALLOWED.has(file.type)) {
    return jsonError("Only JPEG, PNG, WebP, and GIF allowed");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    return jsonError("Image must be under 2 MB");
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const relativePath = `users/${session!.user.id}/avatar.${ext}`;
  await writeFile(relativePath, buffer);

  const user = await prisma.user.update({
    where: { id: session!.user.id },
    data: { avatarPath: relativePath },
    select: { id: true, avatarPath: true },
  });

  return NextResponse.json(user);
}
