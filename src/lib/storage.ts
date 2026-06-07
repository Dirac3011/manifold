import fs from "fs/promises";
import path from "path";

const STORAGE_ROOT = path.resolve(
  process.env.STORAGE_PATH || "./storage"
);

/** Validate and resolve a path within storage — prevents path traversal */
export function safeStoragePath(...segments: string[]): string {
  const resolved = path.resolve(STORAGE_ROOT, ...segments);
  if (!resolved.startsWith(STORAGE_ROOT)) {
    throw new Error("Invalid storage path");
  }
  return resolved;
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeFile(
  relativePath: string,
  data: Buffer | string
): Promise<string> {
  const fullPath = safeStoragePath(relativePath);
  await ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, data);
  return fullPath;
}

export async function readFile(relativePath: string): Promise<Buffer> {
  return fs.readFile(safeStoragePath(relativePath));
}

export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(safeStoragePath(relativePath));
    return true;
  } catch {
    return false;
  }
}
