"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ChartPoint = { time: number; price: number; volume: number };

type TokenChartProps = {
  tokenAddress: string;
  poolAddress?: string | null;
  graduated: boolean;
  chartData: ChartPoint[];
};

type Tab = "dex" | "gmgn" | "curve";

export function TokenChart({
  tokenAddress,
  poolAddress,
  graduated,
  chartData,
}: TokenChartProps) {
  const [tab, setTab] = useState<Tab>("dex");

  const chartTarget = (poolAddress || tokenAddress).toLowerCase();
  const dexPage = `https://dexscreener.com/robinhood/${chartTarget}`;
  const dexEmbed = `${dexPage}?embed=1&theme=dark&trades=0&info=0`;
  const gmgnPage = `https://gmgn.ai/robinhood/token/${tokenAddress}`;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "dex", label: "DEX Screener" },
    { id: "gmgn", label: "GMGN" },
    { id: "curve", label: "Curve" },
  ];

  return (
    <div className="overflow-hidden border border-rh-raised">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rh-raised px-3 py-2">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-rh-lime text-rh-on-lime"
                  : "text-rh-muted hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={dexPage}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-rh-lime hover:underline"
          >
            Open DEX Screener <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href={gmgnPage}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-rh-muted hover:text-rh-lime hover:underline"
          >
            Open GMGN <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="relative h-[420px] bg-black sm:h-[480px]">
        {tab === "dex" && (
          <>
            <iframe
              title="DEX Screener chart"
              src={dexEmbed}
              className="h-full w-full border-0"
              allow="clipboard-write; clipboard-read"
              loading="lazy"
            />
            {!graduated && (
              <p className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-lg bg-black/75 px-3 py-2 text-center text-[11px] text-rh-muted">
                DEX Screener / GMGN charts need a Uniswap pool. Buy on the curve
                until ~8 ETH — then the token graduates and the chart fills in.
              </p>
            )}
          </>
        )}

        {tab === "gmgn" && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="max-w-md text-sm text-rh-muted">
              GMGN blocks embedded charts. Open the token there for smart-money
              flow, holders, and live tape.
            </p>
            <a
              href={gmgnPage}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-rh-lime px-5 py-2.5 text-sm font-semibold text-rh-on-lime"
            >
              Open on GMGN <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href={dexPage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-rh-dim hover:text-rh-lime hover:underline"
            >
              Or view on DEX Screener
            </a>
          </div>
        )}

        {tab === "curve" &&
          (chartData.length < 2 ? (
            <p className="flex h-full items-center justify-center px-6 text-center text-sm text-rh-dim">
              PumpRobin curve chart appears after the first buy/sell on this
              page.
            </p>
          ) : (
            <div className="h-full p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#CCFF00" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#CCFF00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: "#111",
                      border: "1px solid #333",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#CCFF00"
                    fill="url(#curveFill)"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ))}
      </div>
    </div>
  );
}
