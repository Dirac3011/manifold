import type { Monaco } from "@monaco-editor/react";

let themesRegistered = false;

export type EditorThemeId = "manifold-dark" | "manifold-light";

export function setupMonacoThemes(monaco: Monaco) {
  if (themesRegistered) return;
  themesRegistered = true;

  monaco.editor.defineTheme("manifold-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6b7280", fontStyle: "italic" },
      { token: "keyword.control", foreground: "c792ea" },
      { token: "type.environment", foreground: "ff8a65" },
      { token: "keyword", foreground: "82aaff" },
      { token: "string.math", foreground: "c3e88d" },
      { token: "keyword.math", foreground: "9cdc88" },
      { token: "delimiter.curly", foreground: "d4d4d8" },
      { token: "delimiter.square", foreground: "d4d4d8" },
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
      { token: "keyword.control", foreground: "7c4dff" },
      { token: "type.environment", foreground: "d84315" },
      { token: "keyword", foreground: "1565c0" },
      { token: "string.math", foreground: "558b2f" },
      { token: "keyword.math", foreground: "2e7d32" },
      { token: "delimiter.curly", foreground: "374151" },
      { token: "delimiter.square", foreground: "374151" },
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
