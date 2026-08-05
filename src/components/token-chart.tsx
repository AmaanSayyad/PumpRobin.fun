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

type Tab = "gmgn" | "dex" | "curve";

/** GMGN public embed — https://docs.gmgn.ai/index/cooperation-api-integrate-gmgn-price-chart */
function gmgnKlineEmbed(tokenAddress: string) {
  const ca = tokenAddress.toLowerCase();
  return `https://www.gmgn.cc/kline/robinhood/${ca}?theme=dark&interval=5`;
}

export function TokenChart({
  tokenAddress,
  poolAddress,
  graduated,
  chartData,
}: TokenChartProps) {
  const [tab, setTab] = useState<Tab>(graduated ? "gmgn" : "curve");

  const chartTarget = (poolAddress || tokenAddress).toLowerCase();
  const dexPage = `https://dexscreener.com/robinhood/${chartTarget}`;
  const dexEmbed = `${dexPage}?embed=1&theme=dark&trades=0&info=0`;
  const gmgnPage = `https://gmgn.ai/robinhood/token/${tokenAddress}`;
  const gmgnEmbed = gmgnKlineEmbed(tokenAddress);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "curve", label: "Curve" },
    { id: "gmgn", label: "GMGN" },
    { id: "dex", label: "DEX" },
  ];

  const openHref =
    tab === "gmgn" ? gmgnPage : tab === "dex" ? dexPage : null;

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
        {openHref && (
          <a
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-rh-muted hover:text-rh-lime"
          >
            Open {tab === "gmgn" ? "GMGN" : "DEX"}{" "}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="relative h-[380px] bg-black sm:h-[460px] lg:h-[520px]">
        {tab === "gmgn" && (
          <>
            <iframe
              title="GMGN price chart"
              src={gmgnEmbed}
              className="h-full w-full border-0"
              allow="clipboard-write; clipboard-read"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            {!graduated && (
              <p className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-lg bg-black/80 px-3 py-2 text-center text-[11px] text-rh-muted">
                Pre-grad charts may be empty — use Curve for PumpRobin trades.
              </p>
            )}
          </>
        )}

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
                DEX chart after ~8 ETH graduation to Uniswap.
              </p>
            )}
          </>
        )}

        {tab === "curve" &&
          (chartData.length < 2 ? (
            <p className="flex h-full items-center justify-center px-6 text-center text-sm text-rh-dim">
              Curve chart appears after the first buy/sell on PumpRobin.
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
