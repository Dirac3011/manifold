type Props = {
  size?: number;
  className?: string;
  priority?: boolean;
};

/** Transparent PNG from /public — plain img avoids next/image optimizer (no sharp in Docker). */
export function ManifoldLogo({ size = 28, className = "", priority = false }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={className}
      aria-hidden
    />
  );
}
