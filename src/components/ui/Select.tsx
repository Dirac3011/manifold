import { SelectHTMLAttributes, forwardRef } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { className = "", children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={`w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-ui-xs text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--accent)] ${className}`}
      {...props}
    >
      {children}
    </select>
  );
});
