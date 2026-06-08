export default function ProjectLoading() {
  return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      <div className="h-11 shrink-0 animate-pulse border-b border-[var(--border-subtle)] bg-[var(--surface)]" />
      <div className="flex min-h-0 flex-1">
        <div className="w-11 shrink-0 animate-pulse border-r border-[var(--border-subtle)] bg-[var(--surface)]" />
        <div className="min-w-0 flex-1 animate-pulse bg-[var(--background)]" />
        <div className="hidden w-[38%] shrink-0 animate-pulse border-l border-[var(--border-subtle)] bg-[var(--surface)] md:block" />
      </div>
    </div>
  );
}
