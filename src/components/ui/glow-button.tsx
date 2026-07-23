"use client";

import { RhButton } from "./rh-button";

/** @deprecated Use RhButton — kept for pages still importing GlowButton */
export function GlowButton({
  children,
  variant = "primary",
  size = "md",
  className,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const map = {
    primary: "primary" as const,
    secondary: "outline" as const,
    ghost: "ghost" as const,
  };
  return (
    <RhButton
      variant={map[variant]}
      size={size}
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </RhButton>
  );
}
