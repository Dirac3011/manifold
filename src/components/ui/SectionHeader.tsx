type Props = {
  children: React.ReactNode;
  className?: string;
};

export function SectionHeader({ children, className = "" }: Props) {
  return (
    <h3
      className={`text-ui-xs font-medium uppercase tracking-wider text-[var(--muted)] ${className}`}
    >
      {children}
    </h3>
  );
}
