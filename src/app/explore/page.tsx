"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  Eye,
  Flame,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { TokenCard } from "@/components/tokens/token-card";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type ViewTab =
  | "graduated"
  | "bonding"
  | "trending"
  | "movers"
  | "new"
  | "volume";

const TABS: {
  id: ViewTab;
  label: string;
  description: string;
  icon: ReactNode;
  showCount?: boolean;
}[] = [
  {
    id: "graduated",
    label: "Graduated",
    description: "Fully bonded — ready for DEX liquidity",
    icon: <Eye className="w-3.5 h-3.5" strokeWidth={2.25} />,
    showCount: true,
  },
  {
    id: "bonding",
    label: "Bonding Curve",
    description: "Fair launch — price rises with buys before graduation",
    icon: <TrendingUp className="w-3.5 h-3.5" strokeWidth={2.25} />,
    showCount: true,
  },
  {
    id: "trending",
    label: "Trending",
    description: "Hottest tokens on Robinhood Chain right now",
    icon: <Flame className="w-3.5 h-3.5" strokeWidth={2.25} />,
  },
  {
    id: "movers",
    label: "Top Movers",
    description: "Biggest 24h price swings",
    icon: <Zap className="w-3.5 h-3.5" strokeWidth={2.25} />,
  },
  {
    id: "new",
    label: "New",
    description: "Recently launched coins",
    icon: <Sparkles className="w-3.5 h-3.5" strokeWidth={2.25} />,
  },
  {
    id: "volume",
    label: "Volume",
    description: "Highest 24h trading volume",
    icon: <BarChart3 className="w-3.5 h-3.5" strokeWidth={2.25} />,
  },
];

export default function ExplorePage() {
  const { tokens, hydrated } = useAppStore();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ViewTab>("bonding");

  const counts = useMemo(
    () => ({
      graduated: tokens.filter((t) => t.graduated).length,
      bonding: tokens.filter((t) => !t.graduated).length,
    }),
    [tokens]
  );

  const active = TABS.find((t) => t.id === tab) ?? TABS[1];

  const filtered = useMemo(() => {
    let result = [...tokens];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q)
      );
    }

    switch (tab) {
      case "graduated":
        result = result.filter((t) => t.graduated);
        result.sort((a, b) => b.marketCap - a.marketCap);
        break;
      case "bonding":
        result = result.filter((t) => !t.graduated);
        result.sort((a, b) => b.progress - a.progress || b.marketCap - a.marketCap);
        break;
      case "trending":
        result.sort(
          (a, b) =>
            b.volume24h * 2 + Math.abs(b.priceChange24h) -
            (a.volume24h * 2 + Math.abs(a.priceChange24h))
        );
        break;
      case "movers":
        result.sort(
          (a, b) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h)
        );
        break;
      case "new":
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case "volume":
        result.sort((a, b) => b.volume24h - a.volume24h);
        break;
    }

    return result;
  }, [tokens, search, tab]);

  const emptyCopy: Record<ViewTab, string> = {
    graduated: "No graduated tokens yet.",
    bonding: "No bonding-curve tokens yet.",
    trending: "Nothing trending yet.",
    movers: "No movers yet.",
    new: "No new launches yet.",
    volume: "No volume yet.",
  };

  return (
    <div className="rh-container py-12 sm:py-16">
      <h1 className="rh-display text-4xl sm:text-5xl mb-3">Explore</h1>
      <p className="text-rh-muted mb-8 max-w-xl">
        Explore all tokens — bonding-curve launches and graduated coins on
        Robinhood Chain.
      </p>

      <input
        type="search"
        placeholder="Search name or symbol"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md mb-6 px-5 py-3 bg-rh-raised border border-transparent rounded-full text-sm focus:outline-none focus:border-rh-lime/40 placeholder:text-rh-dim"
      />

      {/* Segmented view options — robinlaunch-style */}
      <div className="mb-3 overflow-x-auto -mx-1 px-1">
        <div
          role="tablist"
          aria-label="Token views"
          className="inline-flex min-w-full sm:min-w-0 items-center gap-1 p-1.5 rounded-full bg-rh-raised border border-white/[0.06]"
        >
          {TABS.map((t) => {
            const selected = tab === t.id;
            const count =
              t.id === "graduated"
                ? counts.graduated
                : t.id === "bonding"
                  ? counts.bonding
                  : undefined;

            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-full text-sm whitespace-nowrap transition-colors shrink-0",
                  selected
                    ? "bg-rh-lime text-rh-on-lime font-medium"
                    : "text-rh-muted hover:text-white"
                )}
              >
                <span className={selected ? "text-rh-on-lime" : "text-rh-dim"}>
                  {t.icon}
                </span>
                {t.label}
                {t.showCount && typeof count === "number" && (
                  <span
                    className={cn(
                      "min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-semibold tabular-nums inline-flex items-center justify-center",
                      selected
                        ? "bg-black/20 text-rh-on-lime"
                        : "bg-white/10 text-rh-muted"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-sm text-rh-muted mb-8">{active.description}</p>

      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="text-[11px] uppercase tracking-[0.14em] text-rh-dim font-medium">
            {active.label}
          </h2>
          <p className="text-xs text-rh-muted mt-1 sm:hidden">{active.description}</p>
        </div>
        <p className="text-xs text-rh-dim tabular-nums shrink-0">
          {hydrated ? `${filtered.length} tokens` : "Loading…"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="py-20 sm:py-24 rounded-2xl bg-rh-raised/60 border border-white/[0.04] text-center">
          <p className="text-rh-muted text-sm">
            {hydrated ? emptyCopy[tab] : "Loading…"}
          </p>
          {hydrated && tab !== "bonding" && (
            <button
              type="button"
              onClick={() => setTab("bonding")}
              className="mt-4 text-sm text-rh-lime hover:underline"
            >
              View bonding curve
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((token, i) => (
            <TokenCard key={token.address} token={token} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
