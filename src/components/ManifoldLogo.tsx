import Image from "next/image";
import logo from "@/assets/logo.png";

type Props = {
  size?: number;
  className?: string;
  priority?: boolean;
};

/** Transparent PNG — bundled at build time; no background wrapper. */
export function ManifoldLogo({ size = 28, className = "", priority = false }: Props) {
  return (
    <Image
      src={logo}
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={className}
      aria-hidden
    />
  );
}
