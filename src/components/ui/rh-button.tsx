"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

interface RhButtonProps {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}

const sizes: Record<Size, string> = {
  sm: "text-sm px-4 py-2.5",
  md: "text-[0.9375rem] px-6 py-3.5",
  lg: "text-base px-8 py-4",
};

const variants: Record<Variant, string> = {
  primary: "bg-rh-lime text-rh-on-lime hover:bg-rh-lime-hover",
  outline: "border border-rh-lime text-white hover:bg-rh-lime/10",
  ghost: "border border-white/20 text-white hover:border-white/40",
};

export function RhButton({
  children,
  variant = "primary",
  size = "md",
  className,
  href,
  onClick,
  type = "button",
  disabled,
}: RhButtonProps) {
  const classes = cn(
    "rh-pill inline-flex items-center justify-center gap-2 font-medium disabled:opacity-40 disabled:pointer-events-none",
    sizes[size],
    variants[variant],
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
