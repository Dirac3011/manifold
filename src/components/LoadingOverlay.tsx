type Props = {
  message?: string;
  fullScreen?: boolean;
};

export function LoadingOverlay({ message = "Loading...", fullScreen = false }: Props) {
  return (
    <div
      className={`${fullScreen ? "fixed" : "absolute"} inset-0 z-50 flex flex-col items-center justify-center bg-[var(--background)]/90 backdrop-blur-sm`}
    >
      <div className="loading-spinner" aria-hidden />
      <p className="mt-4 text-sm text-[var(--muted)]">{message}</p>
    </div>
  );
}
