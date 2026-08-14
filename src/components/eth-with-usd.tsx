"use client";

import { cn, ethToUsd, formatEthAmount, formatUsd } from "@/lib/utils";

export function EthWithUsd({
  eth,
  ethUsd,
  layout = "inline",
  decimals = 4,
  className,
  ethClassName,
  usdClassName,
  showEthUnit = true,
}: {
  eth: number | string;
  ethUsd: number | null | undefined;
  layout?: "inline" | "stacked";
  decimals?: number;
  className?: string;
  ethClassName?: string;
  usdClassName?: string;
  showEthUnit?: boolean;
}) {
  const n = typeof eth === "string" ? Number(eth) : eth;
  if (!Number.isFinite(n)) return <span className={className}>—</span>;

  const ethText = showEthUnit
    ? `${formatEthAmount(n, decimals)} ETH`
    : formatEthAmount(n, decimals);
  const usd =
    ethUsd != null && Number.isFinite(ethUsd)
      ? formatUsd(ethToUsd(n, ethUsd))
      : null;

  if (layout === "stacked") {
    return (
      <span className={cn("inline-flex flex-col", className)}>
        <span className={cn("tabular-nums", ethClassName)}>{ethText}</span>
        {usd && (
          <span className={cn("text-[11px] tabular-nums text-rh-muted", usdClassName)}>
            ~{usd}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={cn("tabular-nums", className)}>
      <span className={ethClassName}>{ethText}</span>
      {usd && (
        <span className={cn(" text-rh-muted", usdClassName)}> (~{usd})</span>
      )}
    </span>
  );
}
