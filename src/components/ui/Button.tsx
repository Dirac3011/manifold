import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variantClass: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-dim)] border-transparent",
  secondary:
    "bg-transparent text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--surface-hover)]",
  ghost:
    "bg-transparent text-[var(--muted)] border-transparent hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
  danger:
    "bg-transparent text-[var(--danger)] border-[var(--danger)]/30 hover:bg-[var(--danger)]/10",
};

const sizeClass: Record<Size, string> = {
  sm: "px-2.5 py-1 text-ui-xs rounded-[var(--radius-sm)]",
  md: "px-3.5 py-1.5 text-ui-sm rounded-[var(--radius-md)]",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", size = "sm", className = "", children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-1.5 border font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-40 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
