import { StatusPill } from "./StatusPill";
import { Button } from "./Button";

type Props = {
  citeKey: string;
  title: string | null;
  authors: string | null;
  year?: string | null;
  status: "used" | "unused" | "missing";
  onCopy: () => void;
};

const statusTone = {
  used: "success" as const,
  unused: "warning" as const,
  missing: "danger" as const,
};

const statusLabel = {
  used: "used",
  unused: "unused",
  missing: "missing",
};

export function CitationListItem({
  citeKey,
  title,
  authors,
  year,
  status,
  onCopy,
}: Props) {
  return (
    <div className="group/cite border-b border-[var(--border-subtle)] px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-ui-xs font-medium text-[var(--accent)]">
              {citeKey}
            </code>
            <StatusPill tone={statusTone[status]}>{statusLabel[status]}</StatusPill>
          </div>
          {title && (
            <p className="mt-1 line-clamp-2 text-ui-sm leading-snug text-[var(--foreground)]">
              {title}
            </p>
          )}
          {(authors || year) && (
            <p className="mt-0.5 text-ui-xs text-[var(--muted)]">
              {[authors, year].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          className="shrink-0 opacity-0 group-hover/cite:opacity-100"
          title={`Copy \\cite{${citeKey}}`}
        >
          Copy cite
        </Button>
      </div>
    </div>
  );
}
