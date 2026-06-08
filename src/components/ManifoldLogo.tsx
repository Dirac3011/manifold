import Image from "next/image";

type Props = {
  size?: number;
  className?: string;
  priority?: boolean;
};

/** Transparent PNG — no background wrapper; blends with parent surface. */
export function ManifoldLogo({ size = 28, className = "", priority = false }: Props) {
  return (
    <Image
      src="/logo.png"
      alt="Manifold"
      width={size}
      height={size}
      priority={priority}
      className={className}
      style={{ background: "transparent" }}
    />
  );
}
