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
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import { attachLatexLinting, ensureLatexLanguageSetup, setupLatexLanguage } from "@/lib/latex/monaco-latex";
import { setLatexCompletionContext } from "@/lib/latex/monaco-completion";
import { editorThemeForApp } from "@/lib/latex/monaco-themes";
import type { AppTheme } from "@/lib/theme";

export type LineRange = { startLine: number; endLine: number };

export type LatexEditorHandle = {
  jumpToLine: (line: number) => void;
  setHighlights: (ranges: LineRange[]) => void;
};

export type EditorTextSelection = {
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  text: string;
};

type CollabProps = {
  yText: Y.Text;
  awareness: Awareness;
  synced: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onCursorLine?: (line: number) => void;
  onSelectionChange?: (selection: EditorTextSelection | null) => void;
  readOnly?: boolean;
  appTheme?: AppTheme;
  projectTexBundle?: string;
  collab?: CollabProps | null;
};

export const LatexEditor = forwardRef<LatexEditorHandle, Props>(
  function LatexEditor(
    {
      value,
      onChange,
      onCursorLine,
      onSelectionChange,
      readOnly,
      appTheme = "dark",
      projectTexBundle = "",
      collab = null,
    },
    ref
  ) {
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
    const decorationIds = useRef<string[]>([]);
    const bindingRef = useRef<MonacoBinding | null>(null);
    const collabRef = useRef(collab);
    collabRef.current = collab;

    const useLiveCollab = !!(collab?.yText && collab.awareness && collab.synced);

    const attachBinding = useCallback(() => {
      const editor = editorRef.current;
      const c = collabRef.current;
      if (!editor || !c?.yText || !c.awareness || !c.synced) return;

      const model = editor.getModel();
      if (!model) return;

      const monaco = monacoRef.current;
      if (monaco && model.getLanguageId() !== "latex") {
        monaco.editor.setModelLanguage(model, "latex");
      }

      bindingRef.current?.destroy();
      bindingRef.current = new MonacoBinding(
        c.yText,
        model,
        new Set([editor]),
        c.awareness
      );
    }, []);

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

    const handleBeforeMount = useCallback((monaco: typeof import("monaco-editor")) => {
      setupLatexLanguage(monaco);
    }, []);

    const handleMount: OnMount = useCallback(
      (monacoEditor, monaco) => {
        editorRef.current = monacoEditor;
        monacoRef.current = monaco;
        setupLatexLanguage(monaco);
        monaco.editor.setTheme(editorThemeForApp(appTheme));

        const model = monacoEditor.getModel();
        if (model) {
          // Toggle language to force Monarch re-tokenization after provider updates.
          if (model.getLanguageId() === "latex") {
            monaco.editor.setModelLanguage(model, "plaintext");
          }
          monaco.editor.setModelLanguage(model, "latex");
        }

        lintCleanupRef.current?.();
        lintCleanupRef.current = attachLatexLinting(monaco, monacoEditor);

        monacoEditor.onDidChangeCursorPosition((e) =>
          onCursorLine?.(e.position.lineNumber)
        );

        monacoEditor.onDidChangeCursorSelection((e) => {
          const model = monacoEditor.getModel();
          if (!model) {
            onSelectionChange?.(null);
            return;
          }
          const sel = e.selection;
          if (sel.isEmpty()) {
            onSelectionChange?.(null);
            return;
          }
          const text = model.getValueInRange(sel);
          if (!text.trim()) {
            onSelectionChange?.(null);
            return;
          }
          onSelectionChange?.({
            startLine: sel.startLineNumber,
            endLine: sel.endLineNumber,
            startColumn: sel.startColumn,
            endColumn: sel.endColumn,
            text,
          });
        });

        attachBinding();
      },
      [onCursorLine, onSelectionChange, appTheme, attachBinding]
    );

    useEffect(() => {
      attachBinding();
    }, [attachBinding, collab?.synced, collab?.yText, collab?.awareness]);

    useEffect(() => {
      const monaco = monacoRef.current;
      if (monaco) monaco.editor.setTheme(editorThemeForApp(appTheme));
    }, [appTheme]);

    useEffect(() => {
      setLatexCompletionContext(projectTexBundle);
    }, [projectTexBundle]);

    useEffect(() => {
      void ensureLatexLanguageSetup();
    }, []);

    useEffect(() => () => lintCleanupRef.current?.(), []);
    useEffect(() => () => bindingRef.current?.destroy(), []);

    const waitingForCollab = collab && !collab.synced;

    return (
      <div className="monaco-container relative h-full">
        {waitingForCollab && (
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center bg-[var(--surface)]/90 py-1.5 text-ui-xs text-[var(--muted)]">
            Connecting to collaborators…
          </div>
        )}
        <Editor
          height="100%"
          language="latex"
          theme={editorThemeForApp(appTheme)}
          defaultValue={value}
          value={useLiveCollab ? undefined : value}
          onChange={useLiveCollab ? undefined : (v) => onChange(v || "")}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            wordWrap: "on",
            readOnly: readOnly || !!waitingForCollab,
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
