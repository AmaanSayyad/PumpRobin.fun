"use client";

import Link from "next/link";
import { cn, formatNumber, formatUsd } from "@/lib/utils";
import type { TokenData } from "@/lib/data-types";
import { TokenLogo } from "@/components/token-logo";

function changeClass(n: number) {
  if (!n) return "text-rh-dim";
  return n > 0 ? "text-rh-lime" : "text-red-400";
}

function fmtChange(n: number) {
  if (!Number.isFinite(n) || n === 0) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtUsdPrice(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1) return formatUsd(n);
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

function ageShort(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 2_592_000) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 2_592_000)}mo`;
}

function quoteLabel(token: TokenData) {
  const dex = token.metadata?.dexId?.replace(/-robinhood$/i, "");
  if (dex) return `/${dex}`;
  return `$${token.symbol}`;
}

export function MarketTable({ tokens }: { tokens: TokenData[] }) {
  return (
    <div className="relative -mx-4 sm:mx-0">
      <div className="no-scrollbar overflow-x-auto overscroll-x-contain sm:rounded-xl sm:border sm:border-white/[0.06]">
        <table className="w-max min-w-full text-left text-[13px] leading-5 sm:text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.14em] text-rh-dim">
              <th className="sticky left-0 z-20 bg-black px-3 py-2 font-medium">
                Token
              </th>
              <th className="px-2 py-2 font-medium text-right">Mcap</th>
              <th className="px-2 py-2 font-medium text-right">Price</th>
              <th className="px-2 py-2 font-medium text-right">Age</th>
              <th className="px-2 py-2 font-medium text-right">Txns</th>
              <th className="px-2 py-2 font-medium text-right">Volume</th>
              <th className="px-2 py-2 font-medium text-right">5m</th>
              <th className="px-2 py-2 font-medium text-right">1h</th>
              <th className="px-2 py-2 font-medium text-right">6h</th>
              <th className="px-2 py-2 font-medium text-right">24h</th>
              <th className="px-3 py-2 font-medium text-right">Liq</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => {
              const m = t.metadata;
              const changes = [
                m?.priceChange5m,
                m?.priceChange1h,
                m?.priceChange6h,
                t.priceChange24h,
              ] as number[];
              return (
                <tr
                  key={t.address}
                  className="h-12 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="sticky left-0 z-10 bg-black px-3">
                    <Link
                      href={`/token/${t.address}`}
                      className="flex h-12 items-center gap-2.5 min-w-[9.5rem]"
                    >
                      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-rh-raised">
                        <TokenLogo
                          src={t.imageUri}
                          alt={t.name}
                          symbol={t.symbol}
                        />
                      </div>
                      <div className="min-w-0 flex items-baseline gap-1.5">
                        <span className="truncate font-medium">{t.symbol}</span>
                        <span className="truncate text-[11px] text-rh-dim">
                          {quoteLabel(t)}
                        </span>
                      </div>
                    </Link>
                  </td>
                  <td className="px-2 text-right tabular-nums whitespace-nowrap">
                    {m?.marketCapUsd ? formatUsd(m.marketCapUsd) : "—"}
                  </td>
                  <td className="px-2 text-right tabular-nums text-rh-muted whitespace-nowrap">
                    {fmtUsdPrice(m?.priceUsd ?? 0)}
                  </td>
                  <td className="px-2 text-right text-rh-muted tabular-nums whitespace-nowrap">
                    {ageShort(t.createdAt)}
                  </td>
                  <td className="px-2 text-right tabular-nums text-rh-muted whitespace-nowrap">
                    {m?.txns24h ? formatNumber(m.txns24h, 0) : "—"}
                  </td>
                  <td className="px-2 text-right tabular-nums whitespace-nowrap">
                    {m?.volumeUsd24h ? formatUsd(m.volumeUsd24h) : "—"}
                  </td>
                  {changes.map((chg, i) => (
                    <td
                      key={i}
                      className={cn(
                        "px-2 text-right tabular-nums whitespace-nowrap",
                        changeClass(chg || 0)
                      )}
                    >
                      {fmtChange(chg || 0)}
                    </td>
                  ))}
                  <td className="px-3 text-right tabular-nums text-rh-muted whitespace-nowrap">
                    {m?.liquidityUsd ? formatUsd(m.liquidityUsd) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black to-transparent sm:hidden"
      />
    </div>
  );
}

