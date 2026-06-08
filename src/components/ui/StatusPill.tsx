type Tone = "neutral" | "success" | "warning" | "danger" | "muted" | "accent";

type Props = {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
};

const toneClass: Record<Tone, string> = {
  neutral: "bg-[var(--surface-hover)] text-[var(--muted)]",
  success: "bg-[var(--success)]/10 text-[var(--success)]",
  warning: "bg-[var(--warning)]/10 text-[var(--warning)]",
  danger: "bg-[var(--danger)]/10 text-[var(--danger)]",
  muted: "bg-transparent text-[var(--muted)]",
  accent: "bg-[var(--accent)]/10 text-[var(--accent)]",
};

const dotClass: Record<Tone, string> = {
  neutral: "bg-[var(--muted)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  muted: "bg-[var(--muted)]",
  accent: "bg-[var(--accent)]",
};

export function StatusPill({ children, tone = "neutral", dot, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-ui-xs font-medium ${toneClass[tone]} ${className}`}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass[tone]}`} />
      )}
      {children}
    </span>
  );
}
