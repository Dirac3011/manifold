import type { Monaco } from "@monaco-editor/react";
import { loader } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { registerLatexCompletion } from "./monaco-completion";
import { setupMonacoThemes } from "./monaco-themes";

let registered = false;

/**
 * Overleaf-style LaTeX highlighting:
 * - \commands (begin, section, label, …) → purple
 * - {arguments} (lemma, labels, titles, …) → orange-red
 * - $math$ / \[...\] → lime green
 * - plain text → default foreground (white)
 */
export function setupLatexLanguage(monaco: Monaco) {
  setupMonacoThemes(monaco);
  registerLatexCompletion(monaco);

  if (!registered) {
    registered = true;
    monaco.languages.register({ id: "latex", extensions: [".tex", ".latex"] });
    monaco.languages.setLanguageConfiguration("latex", {
      comments: { lineComment: "%" },
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"],
        ["\\begin{", "}\\end{"],
      ],
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: "$", close: "$" },
        { open: "\\begin{", close: "}" },
      ],
      surroundingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "$", close: "$" },
      ],
    });
  }

  monaco.languages.setMonarchTokensProvider("latex", {
    defaultToken: "",
    tokenizer: {
      root: [
        [/%.*/, "comment"],
        [/\$\$/, { token: "string.math", next: "@displaymath" }],
        [/\$/, { token: "string.math", next: "@inlinemath" }],
        [/\\\[/, { token: "string.math", next: "@displaymathSq" }],
        [/\\[a-zA-Z@*]+/, "keyword.command"],
        [/\{/, { token: "delimiter.brace", next: "@inbraces" }],
        [/\[/, { token: "delimiter.bracket", next: "@inbracket" }],
        [/[0-9]+/, "number"],
      ],
      inbraces: [
        [/\\[a-zA-Z@*]+/, "keyword.command"],
        [/\{/, { token: "delimiter.brace", next: "@push" }],
        [/\}/, { token: "delimiter.brace", next: "@pop" }],
        [/[^{}\\]+/, "type.arg"],
      ],
      inbracket: [
        [/\\[a-zA-Z@*]+/, "keyword.command"],
        [/[^\]]+/, "type.arg"],
        [/\]/, { token: "delimiter.bracket", next: "@pop" }],
      ],
      inlinemath: [
        [/[^$\\]+/, "string.math"],
        [/\\[a-zA-Z@*]+/, "keyword.math"],
        [/\$/, { token: "string.math", next: "@pop" }],
      ],
      displaymath: [
        [/[^$\\]+/, "string.math"],
        [/\\[a-zA-Z@*]+/, "keyword.math"],
        [/\$\$/, { token: "string.math", next: "@pop" }],
      ],
      displaymathSq: [
        [/\\\]/, { token: "string.math", next: "@pop" }],
        [/\\[a-zA-Z@*]+/, "keyword.math"],
        [/[^\]]+/, "string.math"],
      ],
    },
  });
}

/** Register latex language as early as possible (before the editor model is created). */
export function ensureLatexLanguageSetup(): Promise<void> {
  return loader.init().then((monaco) => {
    setupLatexLanguage(monaco);
  });
}

if (typeof window !== "undefined") {
  void ensureLatexLanguageSetup();
}

function findUnmatchedEnvironments(content: string): editor.IMarkerData[] {
  const markers: editor.IMarkerData[] = [];
  const stack: { env: string; line: number }[] = [];
  const beginRe = /\\begin\{(\w+)\}/g;
  const endRe = /\\end\{(\w+)\}/g;
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m: RegExpExecArray | null;
    beginRe.lastIndex = 0;
    while ((m = beginRe.exec(line)) !== null) {
      stack.push({ env: m[1], line: i + 1 });
    }
    endRe.lastIndex = 0;
    while ((m = endRe.exec(line)) !== null) {
      const top = stack.pop();
      if (!top || top.env !== m[1]) {
        markers.push({
          severity: 8,
          message: top
            ? `Mismatched \\end{${m[1]}} — expected \\end{${top.env}}`
            : `Unexpected \\end{${m[1]}}`,
          startLineNumber: i + 1,
          startColumn: m.index + 1,
          endLineNumber: i + 1,
          endColumn: m.index + m[0].length + 1,
        });
      }
    }
  }

  for (const unclosed of stack) {
    markers.push({
      severity: 4,
      message: `Unclosed environment \\begin{${unclosed.env}}`,
      startLineNumber: unclosed.line,
      startColumn: 1,
      endLineNumber: unclosed.line,
      endColumn: 80,
    });
  }

  return markers;
}

function findBraceIssues(content: string): editor.IMarkerData[] {
  const markers: editor.IMarkerData[] = [];
  let depth = 0;
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      if (line[j] === "\\") {
        j++;
        continue;
      }
      if (line[j] === "{") depth++;
      else if (line[j] === "}") {
        depth--;
        if (depth < 0) {
          markers.push({
            severity: 8,
            message: "Unexpected closing brace",
            startLineNumber: i + 1,
            startColumn: j + 1,
            endLineNumber: i + 1,
            endColumn: j + 2,
          });
          depth = 0;
        }
      }
    }
  }

  if (depth > 0) {
    markers.push({
      severity: 4,
      message: `${depth} unclosed brace(s) in file`,
      startLineNumber: lines.length,
      startColumn: 1,
      endLineNumber: lines.length,
      endColumn: 80,
    });
  }

  return markers;
}

export function lintLatexDocument(
  monaco: Monaco,
  model: editor.ITextModel
) {
  const content = model.getValue();
  const markers = [
    ...findUnmatchedEnvironments(content),
    ...findBraceIssues(content),
  ];
  monaco.editor.setModelMarkers(model, "latex-lint", markers);
}

export function attachLatexLinting(
  monaco: Monaco,
  editorInstance: editor.IStandaloneCodeEditor
) {
  const model = editorInstance.getModel();
  if (!model) return () => {};

  const run = () => lintLatexDocument(monaco, model);
  run();

  const sub = model.onDidChangeContent(() => {
    window.clearTimeout((model as unknown as { _lintTimer?: number })._lintTimer);
    (model as unknown as { _lintTimer?: number })._lintTimer = window.setTimeout(
      run,
      400
    );
  });

  return () => sub.dispose();
}
