import { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  hint?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, hint, className = "" }: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-10 text-center ${className}`}
    >
      <p className="text-ui-sm font-medium text-[var(--foreground)]">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-xs text-ui-xs leading-relaxed text-[var(--muted)]">
          {description}
        </p>
      )}
      {hint && (
        <div className="mt-4 w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background)] p-3 text-left font-mono text-ui-xs leading-relaxed text-[var(--muted)]">
          {hint}
        </div>
      )}
    </div>
  );
}
