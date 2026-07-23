"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  graduated?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  className,
  showLabel = true,
  graduated = false,
}: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100);

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-white/50">
            {graduated ? "Graduated to DEX" : "Bonding Curve Progress"}
          </span>
          <span className={graduated ? "text-cyan font-medium" : "text-lime font-medium"}>
            {pct.toFixed(1)}%
          </span>
        </div>
      )}
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000",
            graduated
              ? "bg-gradient-to-r from-cyan via-lime to-lime"
              : "bg-gradient-to-r from-lime/80 to-lime"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
