/**
 * Sandboxed LaTeX compilation via Docker.
 * Security: no shell escape, isolated container, timeout, memory limits, path validation.
 */
import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { safeStoragePath, writeFile } from "../storage";
import {
  CompileProfile,
  COMPILER_PROFILES,
  DEFAULT_COMPILE_PROFILE,
} from "./compilers";

const execFileAsync = promisify(execFile);

const COMPILE_WORKSPACE = path.resolve(
  process.env.COMPILE_WORKSPACE || "./compile-workspace"
);
const DOCKER_IMAGE = process.env.LATEX_DOCKER_IMAGE || "manifold-latex";

export type CompileFile = {
  path: string;
  content: string;
};

export type CompileResult = {
  success: boolean;
  log: string;
  pdfBuffer: Buffer | null;
  pdfRelativePath: string | null;
  profile: CompileProfile;
};

function safeWorkspacePath(projectId: string, ...segments: string[]): string {
  const base = path.resolve(COMPILE_WORKSPACE, projectId);
  const resolved = path.resolve(base, ...segments);
  if (!resolved.startsWith(base)) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

async function prepareWorkspace(
  projectId: string,
  files: CompileFile[]
): Promise<string> {
  const wsPath = safeWorkspacePath(projectId);
  await fs.rm(wsPath, { recursive: true, force: true });
  await fs.mkdir(wsPath, { recursive: true });

  for (const file of files) {
    const normalized = path.normalize(file.path).replace(/^(\.\.(\/|\\|$))+/, "");
    if (normalized.includes("..")) {
      throw new Error(`Invalid file path: ${file.path}`);
    }
    const filePath = safeWorkspacePath(projectId, normalized);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file.content, "utf-8");
  }

  return wsPath;
}

export async function compileLatex(
  projectId: string,
  files: CompileFile[],
  mainFile: string = "main.tex",
  profile: CompileProfile = DEFAULT_COMPILE_PROFILE
): Promise<CompileResult> {
  const config = COMPILER_PROFILES[profile];
  const wsPath = await prepareWorkspace(projectId, files);
  const mainPath = safeWorkspacePath(projectId, mainFile);

  if (!(await fileExists(mainPath))) {
    return {
      success: false,
      log: `Main file not found: ${mainFile}`,
      pdfBuffer: null,
      pdfRelativePath: null,
      profile,
    };
  }

  const dockerArgs = [
    "run",
    "--rm",
    "--network=none",
    "--memory=1g",
    "--cpus=1",
    "--pids-limit=256",
    "-v",
    `${wsPath}:/work:rw`,
    "-w",
    "/work",
    "--entrypoint",
    config.entrypoint,
    DOCKER_IMAGE,
    ...config.args,
    mainFile,
  ];

  let log = `[compiler: ${profile}] ${config.label}\n${"─".repeat(40)}\n`;
  let success = false;

  try {
    const { stdout, stderr } = await execFileAsync("docker", dockerArgs, {
      timeout: config.timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    log += [stdout, stderr].filter(Boolean).join("\n");
    success = true;
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    log += [error.stdout, error.stderr, error.message]
      .filter(Boolean)
      .join("\n");
    success = false;
  }

  const pdfName = mainFile.replace(/\.tex$/, ".pdf");
  const pdfPath = safeWorkspacePath(projectId, pdfName);

  let pdfBuffer: Buffer | null = null;
  let pdfRelativePath: string | null = null;

  const pdfGenerated = await fileExists(pdfPath);

  if (pdfGenerated) {
    pdfBuffer = await fs.readFile(pdfPath);
    const storagePath = `projects/${projectId}/builds/${Date.now()}-${profile}.pdf`;
    await writeFile(storagePath, pdfBuffer);
    pdfRelativePath = storagePath;
    success = true;
  } else if (
    !log.includes("Output written") &&
    profile !== "draft"
  ) {
    success = false;
  } else if (!pdfGenerated) {
    success = false;
  }

  await fs.rm(wsPath, { recursive: true, force: true }).catch(() => {});

  return { success, log, pdfBuffer, pdfRelativePath, profile };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Extract line-numbered errors from latexmk/pdflatex log */
export function parseCompileErrors(log: string): Array<{
  file: string;
  line: number;
  message: string;
}> {
  const errors: Array<{ file: string; line: number; message: string }> = [];
  const re = /^(.+):(\d+):\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(log)) !== null) {
    errors.push({
      file: m[1],
      line: parseInt(m[2], 10),
      message: m[3],
    });
  }
  return errors;
}
