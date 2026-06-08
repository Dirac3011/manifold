import {
  formatObjectType,
  formatStatus,
  OBJECT_TYPE_STYLES,
  statusTone,
} from "@/lib/ui/object-styles";
import { StatusPill } from "./StatusPill";

type Props = {
  type: string;
  label: string | null;
  title: string | null;
  status: string;
  startLine: number;
  selected?: boolean;
  atCursor?: boolean;
  unresolvedCount?: number;
  totalCommentCount?: number;
  hasCiteIssue?: boolean;
  missingLabel?: boolean;
  dependencyHint?: string | null;
  proofComplete?: boolean;
  onClick: () => void;
  onDiscussionClick?: () => void;
};

export function ObjectListItem({
  type,
  label,
  title,
  status,
  startLine,
  selected,
  atCursor,
  unresolvedCount = 0,
  totalCommentCount = 0,
  hasCiteIssue,
  missingLabel,
  dependencyHint,
  proofComplete,
  onClick,
  onDiscussionClick,
}: Props) {
  const typeStyle = OBJECT_TYPE_STYLES[type];
  const stripeColor = typeStyle?.stripe ?? "var(--muted)";

  return (
    <div
      className={`group/obj relative border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-hover)] ${
        selected ? "bg-[var(--surface-hover)]" : ""
      } ${atCursor ? "bg-[var(--accent)]/[0.04]" : ""}`}
    >
      <button
        type="button"
        onClick={onClick}
        className="block w-full px-3 py-2.5 text-left"
      >
        <span
          className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full"
          style={{ background: stripeColor }}
          aria-hidden
        />
        <div className="pl-2">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`text-ui-xs font-semibold uppercase tracking-wide ${typeStyle?.text ?? "text-[var(--muted)]"}`}
            >
              {formatObjectType(type)}
            </span>
          </div>
          {title && (
            <p className="mt-0.5 line-clamp-1 text-ui-sm font-medium text-[var(--foreground)]">
              {title}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-ui-xs text-[var(--muted)]">
            <span className="font-mono">{label ?? `L${startLine}`}</span>
            <span aria-hidden>·</span>
            <StatusPill tone={statusTone(status)} dot>
              {formatStatus(status)}
            </StatusPill>
            {proofComplete && status !== "PROOF_COMPLETE" && (
              <>
                <span aria-hidden>·</span>
                <span>proof detected</span>
              </>
            )}
            {missingLabel && (
              <>
                <span aria-hidden>·</span>
                <span className="text-[var(--warning)]">no label</span>
              </>
            )}
            {hasCiteIssue && (
              <>
                <span aria-hidden>·</span>
                <span className="text-[var(--danger)]">cite issue</span>
              </>
            )}
          </div>
          {dependencyHint && (
            <p className="mt-0.5 line-clamp-1 text-ui-xs text-[var(--muted)]">
              {dependencyHint}
            </p>
          )}
        </div>
      </button>
      {(unresolvedCount > 0 || totalCommentCount > 0) && onDiscussionClick && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDiscussionClick();
          }}
          className="absolute right-2 top-2 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-ui-xs text-[var(--accent)] hover:bg-[var(--accent)]/10"
          title="Open discussion"
        >
          {unresolvedCount > 0
            ? `${unresolvedCount} unresolved`
            : `${totalCommentCount} note${totalCommentCount !== 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}
