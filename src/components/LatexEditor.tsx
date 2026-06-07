"use client";

import Editor, { OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { attachLatexLinting, setupLatexLanguage } from "@/lib/latex/monaco-latex";
import { setLatexCompletionContext } from "@/lib/latex/monaco-completion";
import { editorThemeForApp } from "@/lib/latex/monaco-themes";
import type { AppTheme } from "@/lib/theme";

export type LineRange = { startLine: number; endLine: number };

export type LatexEditorHandle = {
  jumpToLine: (line: number) => void;
  setHighlights: (ranges: LineRange[]) => void;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onCursorLine?: (line: number) => void;
  readOnly?: boolean;
  appTheme?: AppTheme;
  /** All project .tex sources for cross-file macro/label completion */
  projectTexBundle?: string;
};

export const LatexEditor = forwardRef<LatexEditorHandle, Props>(
  function LatexEditor({ value, onChange, onCursorLine, readOnly, appTheme = "dark", projectTexBundle = "" }, ref) {
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
    const decorationIds = useRef<string[]>([]);

    useImperativeHandle(ref, () => ({
      jumpToLine(line: number) {
        const editor = editorRef.current;
        if (!editor) return;
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column: 1 });
        editor.focus();
      },
      setHighlights(ranges: LineRange[]) {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco) return;
        decorationIds.current = editor.deltaDecorations(
          decorationIds.current,
          ranges.map((r) => ({
            range: new monaco.Range(r.startLine, 1, r.endLine, 1),
            options: {
              isWholeLine: true,
              className: "theorem-line-highlight",
              marginClassName: "theorem-margin-highlight",
            },
          }))
        );
      },
    }));

    const lintCleanupRef = useRef<(() => void) | null>(null);

    const handleMount: OnMount = useCallback(
      (monacoEditor, monaco) => {
        editorRef.current = monacoEditor;
        monacoRef.current = monaco;
        setupLatexLanguage(monaco);
        monaco.editor.setTheme(editorThemeForApp(appTheme));
        lintCleanupRef.current?.();
        lintCleanupRef.current = attachLatexLinting(monaco, monacoEditor);
        monacoEditor.onDidChangeCursorPosition((e) =>
          onCursorLine?.(e.position.lineNumber)
        );
      },
      [onCursorLine, appTheme]
    );

    useEffect(() => {
      const monaco = monacoRef.current;
      if (monaco) monaco.editor.setTheme(editorThemeForApp(appTheme));
    }, [appTheme]);

    useEffect(() => {
      setLatexCompletionContext(projectTexBundle);
    }, [projectTexBundle]);

    useEffect(() => () => lintCleanupRef.current?.(), []);

    return (
      <div className="monaco-container h-full">
        <Editor
          height="100%"
          defaultLanguage="latex"
          theme={editorThemeForApp(appTheme)}
          value={value}
          onChange={(v) => onChange(v || "")}
          onMount={handleMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            wordWrap: "on",
            readOnly,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: { other: true, comments: false, strings: false },
          }}
        />
      </div>
    );
  }
);
