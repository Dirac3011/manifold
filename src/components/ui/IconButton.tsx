import { ButtonHTMLAttributes, forwardRef } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  badge?: number;
  label: string;
};

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { active, badge, label, className = "", children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={`group/rail relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)] ${
        active
          ? "bg-[var(--accent)]/12 text-[var(--accent)]"
          : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
      } ${className}`}
      {...props}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--warning)] px-1 text-[10px] font-medium leading-none text-[var(--accent-foreground)]">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-ui-xs text-[var(--foreground)] shadow-[var(--shadow-sm)] group-hover/rail:block">
        {label}
      </span>
    </button>
  );
});
