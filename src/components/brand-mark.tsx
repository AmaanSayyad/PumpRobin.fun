import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Pre-rendered crisp PNGs — pick ≥2× display size for retina */
function logoSrc(displayPx: number) {
  const need = displayPx * 2;
  if (need <= 64) return "/brand/pumprobin-logo-64.png";
  if (need <= 96) return "/brand/pumprobin-logo-96.png";
  if (need <= 128) return "/brand/pumprobin-logo-128.png";
  if (need <= 256) return "/brand/pumprobin-logo-256.png";
  return "/brand/pumprobin-logo.png";
}

type BrandMarkProps = {
  href?: string | false;
  size?: number;
  className?: string;
  textClassName?: string;
  /** Show "PumpRobin.fun" label next to the mark */
  showWordmark?: boolean;
};

export function BrandMark({
  href = "/",
  size = 28,
  className,
  textClassName,
  showWordmark = true,
}: BrandMarkProps) {
  const content = (
    <>
      <Image
        src={logoSrc(size)}
        alt=""
        width={size}
        height={size}
        unoptimized
        priority={size >= 24}
        className="rounded-[5px] shrink-0"
        style={{ width: size, height: size }}
      />
      {showWordmark && (
        <span
          className={cn(
            "font-medium tracking-tight whitespace-nowrap",
            textClassName
          )}
        >
          PumpRobin.fun
        </span>
      )}
    </>
  );

  if (href === false) {
    return (
      <span className={cn("inline-flex items-center gap-2.5", className)}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn("inline-flex min-w-0 items-center gap-2.5", className)}
    >
      {content}
    </Link>
  );
}
