import { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function PanelHeader({ title, subtitle, actions, className = "" }: Props) {
  return (
    <div
      className={`flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-3 py-2.5 ${className}`}
    >
      <div className="min-w-0">
        <h2 className="text-ui-md font-semibold tracking-tight text-[var(--foreground)]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-ui-xs text-[var(--muted)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
