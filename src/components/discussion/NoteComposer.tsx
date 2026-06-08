"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Highlighter,
  List,
  Type,
} from "lucide-react";
import { formatSelectionPreview } from "@/lib/discussion/detect-selection-context";
import {
  prefixLinesWithBullet,
  wrapSelection,
} from "@/lib/discussion/markdown-format";
import { NoteContext } from "@/lib/discussion/types";

type Props = {
  canEdit: boolean;
  selectionContext?: NoteContext | null;
  hintText?: string;
  onSubmit: (data: { content: string; context: NoteContext }) => Promise<void>;
  submitting?: boolean;
};

export function NoteComposer({
  canEdit,
  selectionContext = null,
  hintText,
  onSubmit,
  submitting = false,
}: Props) {
  const [content, setContent] = useState("");
  const [formatting, setFormatting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!canEdit) return null;

  async function handleSubmit() {
    if (!content.trim() || submitting) return;
    const ctx = selectionContext
      ? (Object.fromEntries(
          Object.entries(selectionContext).filter(
            ([, v]) => v != null && v !== ""
          )
        ) as NoteContext)
      : {};
    try {
      await onSubmit({ content: content.trim(), context: ctx });
      setContent("");
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch {
      // Parent shows error; keep draft so the user can retry.
    }
  }

  function applyFormat(
    before: string,
    after: string,
    fallback?: string
  ) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end && fallback) {
      const next = content.slice(0, start) + fallback + content.slice(end);
      setContent(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + fallback.length;
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    const { next, cursorStart, cursorEnd } = wrapSelection(
      content,
      start,
      end,
      before,
      after
    );
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function applyBullet() {
    const el = textareaRef.current;
    if (!el) return;
    const { next, cursorStart, cursorEnd } = prefixLinesWithBullet(
      content,
      el.selectionStart,
      el.selectionEnd
    );
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === "c" || e.key === "v" || e.key === "x" || e.key === "a")) {
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !mod && !e.altKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const preview = formatSelectionPreview(selectionContext);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-1.5">
        <span className="min-w-0 truncate text-ui-xs text-[var(--muted)]">
          {preview ? (
            <span className="text-[var(--accent)]">{preview}</span>
          ) : (
            hintText ?? "Highlight source text to attach context · Enter to send"
          )}
        </span>
        <button
          type="button"
          onClick={() => setFormatting((f) => !f)}
          className={`flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] px-2 py-0.5 text-ui-xs transition-colors ${
            formatting
              ? "bg-[var(--accent)]/12 text-[var(--accent)]"
              : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          }`}
          title="Toggle formatting toolbar"
        >
          <Type className="h-3 w-3" />
          Format
        </button>
      </div>

      {formatting && (
        <div className="flex shrink-0 items-center gap-0.5 border-b border-[var(--border-subtle)] px-2 py-1">
          <FormatButton
            label="Bold"
            onClick={() => applyFormat("**", "**", "**text**")}
          >
            <Bold className="h-3.5 w-3.5" />
          </FormatButton>
          <FormatButton
            label="Italic"
            onClick={() => applyFormat("*", "*", "*text*")}
          >
            <Italic className="h-3.5 w-3.5" />
          </FormatButton>
          <FormatButton
            label="Highlight"
            onClick={() => applyFormat("==", "==", "==text==")}
          >
            <Highlighter className="h-3.5 w-3.5" />
          </FormatButton>
          <FormatButton label="Bullet list" onClick={applyBullet}>
            <List className="h-3.5 w-3.5" />
          </FormatButton>
          <span className="ml-2 text-ui-xs text-[var(--muted)]">
            **bold** · *italic* · ==highlight== · - list
          </span>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={(e) => e.stopPropagation()}
        onCopy={(e) => e.stopPropagation()}
        onCut={(e) => e.stopPropagation()}
        placeholder="Write a message… (@thm:label for objects, $$math$$ for equations)"
        spellCheck
        autoComplete="off"
        autoCorrect="off"
        className="min-h-0 w-full flex-1 resize-none border-0 bg-[var(--background)] px-3 py-3 text-ui-sm leading-relaxed text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none select-text"
        style={{ userSelect: "text", WebkitUserSelect: "text" }}
      />
    </div>
  );
}

function FormatButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-[var(--radius-sm)] p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
    >
      {children}
    </button>
  );
}
