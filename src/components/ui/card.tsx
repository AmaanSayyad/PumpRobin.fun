"use client";

import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "bg-rh-surface border border-rh-raised rounded-2xl p-6",
        className
      )}
    >
      {children}
    </div>
  );
}
