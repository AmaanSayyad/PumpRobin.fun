"use client";

import { Card } from "@/components/ui/card";
import { AnimatedCounter } from "@/components/motion/animated-counter";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon: LucideIcon;
  trend?: number;
  className?: string;
}

export function StatCard({
  label,
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  icon: Icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)} glow>
      <div className="absolute top-0 right-0 w-24 h-24 bg-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-white/50 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold">
            <AnimatedCounter
              value={value}
              prefix={prefix}
              suffix={suffix}
              decimals={decimals}
            />
          </p>
          {trend !== undefined && (
            <p className={cn("text-xs mt-1", trend >= 0 ? "text-lime" : "text-red-400")}>
              {trend >= 0 ? "+" : ""}
              {trend.toFixed(1)}% vs yesterday
            </p>
          )}
        </div>
        <div className="p-2.5 rounded-xl bg-lime/10 text-lime">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}
