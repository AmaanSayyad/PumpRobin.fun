"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type TokenChartProps = {
  tokenAddress: string;
  poolAddress?: string | null;
  graduated: boolean;
};

type Tab = "gmgn" | "dex";

/** GMGN public embed — https://docs.gmgn.ai/index/cooperation-api-integrate-gmgn-price-chart */
function gmgnKlineEmbed(tokenAddress: string) {
  const ca = tokenAddress.toLowerCase();
  return `https://www.gmgn.cc/kline/robinhood/${ca}?theme=dark&interval=5`;
}

export function TokenChart({
  tokenAddress,
  poolAddress,
  graduated,
}: TokenChartProps) {
  const [tab, setTab] = useState<Tab>("gmgn");

  const chartTarget = (poolAddress || tokenAddress).toLowerCase();
  const dexPage = `https://dexscreener.com/robinhood/${chartTarget}`;
  const dexEmbed = `${dexPage}?embed=1&theme=dark&trades=0&info=0`;
  const gmgnPage = `https://gmgn.ai/robinhood/token/${tokenAddress}`;
  const gmgnEmbed = gmgnKlineEmbed(tokenAddress);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "gmgn", label: "GMGN" },
    { id: "dex", label: "DEX" },
  ];

  const openHref = tab === "gmgn" ? gmgnPage : dexPage;

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
        <a
          href={openHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-rh-muted hover:text-rh-lime"
        >
          Open {tab === "gmgn" ? "GMGN" : "DEX"}{" "}
          <ExternalLink className="h-3 w-3" />
        </a>
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
                Bonding-curve phase — GMGN/DEX charts appear after graduation to
                Uniswap (~8 ETH raised). Trade on PumpRobin until then.
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
                DEX chart unlocks when the curve graduates to Uniswap V3.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
