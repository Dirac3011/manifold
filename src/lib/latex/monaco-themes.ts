import type { Monaco } from "@monaco-editor/react";

export type EditorThemeId = "manifold-dark" | "manifold-light";

/** Overleaf-inspired: purple commands, orange args, lime math, white prose. */
export function setupMonacoThemes(monaco: Monaco) {
  monaco.editor.defineTheme("manifold-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6b7280", fontStyle: "italic" },
      { token: "keyword.command", foreground: "c792ea" },
      { token: "type.arg", foreground: "f07178" },
      { token: "string.math", foreground: "c3e88d" },
      { token: "keyword.math", foreground: "c3e88d" },
      { token: "delimiter.brace", foreground: "e5c07b" },
      { token: "delimiter.bracket", foreground: "e5c07b" },
      { token: "number", foreground: "f78c6c" },
    ],
    colors: {
      "editor.background": "#0f1117",
      "editor.foreground": "#e8eaed",
      "editorLineNumber.foreground": "#4b5563",
      "editorLineNumber.activeForeground": "#9ca3af",
      "editor.selectionBackground": "#3d4f7c",
      "editor.lineHighlightBackground": "#1a1d27",
      "editorCursor.foreground": "#6c9eff",
    },
  });

  monaco.editor.defineTheme("manifold-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "9ca3af", fontStyle: "italic" },
      { token: "keyword.command", foreground: "7c4dff" },
      { token: "type.arg", foreground: "d84315" },
      { token: "string.math", foreground: "689f38" },
      { token: "keyword.math", foreground: "689f38" },
      { token: "delimiter.brace", foreground: "b58900" },
      { token: "delimiter.bracket", foreground: "b58900" },
      { token: "number", foreground: "c62828" },
    ],
    colors: {
      "editor.background": "#fafafa",
      "editor.foreground": "#1e293b",
      "editorLineNumber.foreground": "#9ca3af",
      "editorLineNumber.activeForeground": "#64748b",
      "editor.selectionBackground": "#bfdbfe",
      "editor.lineHighlightBackground": "#f1f5f9",
      "editorCursor.foreground": "#2563eb",
    },
  });
}

export function editorThemeForApp(theme: "dark" | "light"): EditorThemeId {
  return theme === "light" ? "manifold-light" : "manifold-dark";
}
