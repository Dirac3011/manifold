export type CompileErrorSummary = {
  file: string | null;
  line: number | null;
  message: string;
  raw: string;
};

/** Extract the first meaningful LaTeX error from a compiler log */
export function parseCompileError(log: string): CompileErrorSummary | null {
  if (!log.trim()) return null;

  const lines = log.split("\n");
  let message: string | null = null;
  let line: number | null = null;
  let file: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("! ")) {
      message = trimmed.slice(2).trim();
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const lineMatch = lines[j].match(/^l\.(\d+)\s/);
        if (lineMatch) {
          line = parseInt(lineMatch[1], 10);
          break;
        }
      }
      break;
    }
    if (/^error:/i.test(trimmed) && !message) {
      message = trimmed.replace(/^error:\s*/i, "");
    }
  }

  const fileMatch = log.match(/\(([^()]+\.tex)/);
  if (fileMatch) {
    const parts = fileMatch[1].split("/");
    file = parts[parts.length - 1] || fileMatch[1];
  }

  if (!message) {
    const failLines = lines.filter(
      (l) =>
        /failed|fatal|error/i.test(l) &&
        !/warning/i.test(l) &&
        l.trim().length > 0
    );
    if (failLines.length === 0) return null;
    message = failLines[failLines.length - 1].trim();
  }

  return { file, line, message, raw: log };
}

export function compileLogIndicatesFailure(log: string): boolean {
  if (!log.trim()) return false;
  return (
    /!\s/.test(log) ||
    /error:/i.test(log) ||
    /fatal error/i.test(log) ||
    /compilation failed/i.test(log)
  );
}
