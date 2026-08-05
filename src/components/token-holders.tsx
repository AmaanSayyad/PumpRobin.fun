"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { cn, formatEth, shortenAddress } from "@/lib/utils";
import { explorerAddressUrl } from "@/lib/chain";
import type { TradeData } from "@/lib/data";
import { DEFAULT_SUPPLY } from "@/lib/curve";

export type HolderRow = {
  address: string;
  balance: number;
  pct: number;
  label?: string;
  isCurve?: boolean;
  isDev?: boolean;
};

/** Net token balances from indexed trades + bonding-curve remainder. */
export function buildTopHolders(input: {
  trades: TradeData[];
  tokenAddress: string;
  bondingCurve?: string | null;
  realTokenReserves?: number;
  creator?: string;
  supply?: number;
  limit?: number;
}): HolderRow[] {
  const supply = input.supply && input.supply > 0 ? input.supply : DEFAULT_SUPPLY;
  const net = new Map<string, number>();

  for (const t of input.trades) {
    if (t.tokenAddress.toLowerCase() !== input.tokenAddress.toLowerCase()) {
      continue;
    }
    const key = t.trader.toLowerCase();
    const prev = net.get(key) ?? 0;
    net.set(key, prev + (t.isBuy ? t.tokenAmount : -t.tokenAmount));
  }

  const curveAddr = input.bondingCurve?.toLowerCase();
  let curveBal = Math.max(0, input.realTokenReserves ?? 0);
  // Pre-trade / bad index: curve still holds the full mint
  if (curveAddr && curveBal <= 0 && net.size === 0) {
    curveBal = supply;
  }
  if (curveAddr && curveBal > 0) {
    net.set(curveAddr, (net.get(curveAddr) ?? 0) + curveBal);
  }

  const creator = input.creator?.toLowerCase();
  const rows: HolderRow[] = [];

  for (const [address, balance] of net) {
    if (balance <= 1e-6) continue;
    const pct = (balance / supply) * 100;
    rows.push({
      address,
      balance,
      pct,
      isCurve: Boolean(curveAddr && address === curveAddr),
      isDev: Boolean(creator && address === creator),
      label:
        curveAddr && address === curveAddr
          ? "Bonding curve"
          : creator && address === creator
            ? "Dev"
            : undefined,
    });
  }

  rows.sort((a, b) => b.balance - a.balance);
  return rows.slice(0, input.limit ?? 10);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}

export function TopHoldersPanel({
  holders,
  className,
}: {
  holders: HolderRow[];
  className?: string;
}) {
  const top10Pct = holders.reduce((s, h) => s + h.pct, 0);

  return (
    <div
      className={cn(
        "relative isolate border border-rh-raised bg-black p-5",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-rh-lime" />
          Top holders
        </h3>
        <span
          className={cn(
            "text-[11px] tabular-nums",
            top10Pct > 50 ? "text-amber-300" : "text-rh-dim"
          )}
        >
          Top {holders.length}: {top10Pct.toFixed(1)}%
        </span>
      </div>

      {holders.length === 0 ? (
        <p className="text-sm text-rh-dim">
          No holders indexed yet — first buy will show here.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {holders.map((h, i) => (
            <li key={h.address} className="flex items-center gap-2 text-sm">
              <span className="w-4 shrink-0 text-[11px] tabular-nums text-rh-dim">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {h.isCurve ? (
                    <span className="font-mono text-[12px] text-white/80">
                      {shortenAddress(h.address, 4)}
                    </span>
                  ) : (
                    <Link
                      href={`/wallet/${h.address}`}
                      className="font-mono text-[12px] text-white hover:text-rh-lime"
                    >
                      {shortenAddress(h.address, 4)}
                    </Link>
                  )}
                  <a
                    href={explorerAddressUrl(h.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rh-dim hover:text-rh-lime"
                    aria-label="Open in explorer"
                  >
                    ↗
                  </a>
                  {h.label && (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        h.isCurve
                          ? "bg-white/10 text-rh-muted"
                          : "bg-rh-lime/15 text-rh-lime"
                      )}
                    >
                      {h.label}
                    </span>
                  )}
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      h.isCurve ? "bg-white/30" : "bg-rh-lime"
                    )}
                    style={{ width: `${Math.min(100, Math.max(1, h.pct))}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[12px] tabular-nums text-white">
                  {h.pct.toFixed(2)}%
                </p>
                <p className="text-[10px] tabular-nums text-rh-dim">
                  {formatTokens(h.balance)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-rh-dim">
        Holders = wallets with a balance. Bonding curve inventory is shown
        separately and does not count toward the holder total.
      </p>
    </div>
  );
}

export function SameTickerPanel({
  symbol,
  tokens,
  currentAddress,
}: {
  symbol: string;
  tokens: Array<{
    address: string;
    name: string;
    symbol: string;
    imageUri: string;
    marketCap: number;
    progress: number;
    graduated: boolean;
  }>;
  currentAddress: string;
}) {
  const others = tokens
    .filter(
      (t) =>
        t.symbol.toLowerCase() === symbol.toLowerCase() &&
        t.address.toLowerCase() !== currentAddress.toLowerCase()
    )
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 8);

  return (
    <div className="relative isolate border border-rh-raised bg-black p-5">
      <h3 className="mb-3 text-sm font-medium">
        Same ticker{" "}
        <span className="text-rh-muted">${symbol.toUpperCase()}</span>
      </h3>

      {others.length === 0 ? (
        <p className="text-sm text-rh-dim">
          No other ${symbol.toUpperCase()} launches on PumpRobin yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {others.map((t) => (
            <li key={t.address}>
              <Link
                href={`/token/${t.address}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]"
              >
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-rh-raised">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.imageUri || "/brand/logo.png"}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {t.name}
                  </p>
                  <p className="font-mono text-[10px] text-rh-dim">
                    {shortenAddress(t.address, 4)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[12px] tabular-nums text-white">
                    {formatEth(t.marketCap)} ETH
                  </p>
                  <p className="text-[10px] text-rh-dim">
                    {t.graduated ? "Graduated" : `${t.progress.toFixed(0)}%`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
