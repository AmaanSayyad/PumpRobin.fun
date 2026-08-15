"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  Eye,
  Flame,
  Rocket,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { MarketTable } from "@/components/tokens/market-table";
import { useAppStore } from "@/lib/store";
import { hasExploreTxns, hasTokenLogo, isHiddenToken, isPumpRobinLaunch, isTokenFeatured } from "@/lib/data-client";
import { cn } from "@/lib/utils";
import type { TokenData } from "@/lib/data-types";

type ViewTab =
  | "trending"
  | "volume"
  | "gainers"
  | "new"
  | "pump"
  | "featured"
  | "graduated"
  | "bonding";

const TABS: {
  id: ViewTab;
  label: string;
  description: string;
  icon: ReactNode;
  market?: boolean;
  showCount?: boolean;
}[] = [
  {
    id: "volume",
    label: "Top Volume",
    description: "Highest 24h volume across Uniswap and other DEXes",
    icon: <BarChart3 className="w-3.5 h-3.5" strokeWidth={2.25} />,
    market: true,
  },
  {
    id: "trending",
    label: "Trending",
    description: "Hottest Robinhood Chain pairs right now",
    icon: <Flame className="w-3.5 h-3.5" strokeWidth={2.25} />,
    market: true,
  },
  {
    id: "gainers",
    label: "Gainers",
    description: "Biggest 24h price moves",
    icon: <Zap className="w-3.5 h-3.5" strokeWidth={2.25} />,
    market: true,
  },
  {
    id: "new",
    label: "New Pairs",
    description: "Recently created liquidity pools",
    icon: <Sparkles className="w-3.5 h-3.5" strokeWidth={2.25} />,
    market: true,
  },
  {
    id: "pump",
    label: "PumpRobin",
    description: "Tokens launched on PumpRobin",
    icon: <Rocket className="w-3.5 h-3.5" strokeWidth={2.25} />,
    showCount: true,
  },
  {
    id: "featured",
    label: "Featured",
    description: "Paid boosts — pinned launches on Explore",
    icon: <Sparkles className="w-3.5 h-3.5" strokeWidth={2.25} />,
    showCount: true,
  },
  {
    id: "graduated",
    label: "Graduated",
    description: "PumpRobin launches live on Uniswap",
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
];

function revive(t: TokenData): TokenData {
  return {
    ...t,
    createdAt: t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt),
  };
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[88rem] px-4 py-10 text-sm text-rh-muted">
          Loading markets…
        </div>
      }
    >
      <ExploreInner />
    </Suspense>
  );
}

function ExploreInner() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const { tokens, hydrated } = useAppStore();
  const [search, setSearch] = useState(initialQ);
  const [tab, setTab] = useState<ViewTab>("volume");
  const [market, setMarket] = useState<TokenData[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [searchHits, setSearchHits] = useState<TokenData[] | null>(null);
  const [searching, setSearching] = useState(false);

  const launches = useMemo(
    () => tokens.filter(isPumpRobinLaunch),
    [tokens]
  );
  const listed = useMemo(() => launches.filter(hasTokenLogo), [launches]);
  const counts = useMemo(
    () => ({
      pump: listed.length,
      featured: listed.filter((t) => isTokenFeatured(t.metadata)).length,
      graduated: listed.filter((t) => t.graduated).length,
      bonding: listed.filter((t) => !t.graduated).length,
    }),
    [listed]
  );

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const isMarketTab = Boolean(active.market);

  useEffect(() => {
    if (!isMarketTab) return;
    let cancelled = false;
    setMarketLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/market?tab=${tab}`);
        const data = await res.json();
        if (!cancelled) {
          setMarket(((data.tokens ?? []) as TokenData[]).map(revive));
        }
      } catch {
        if (!cancelled) setMarket([]);
      } finally {
        if (!cancelled) setMarketLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, isMarketTab]);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchHits(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          setSearchHits(((data.tokens ?? []) as TokenData[]).map(revive));
        } catch {
          setSearchHits([]);
        } finally {
          setSearching(false);
        }
      })();
    }, 280);
    return () => window.clearTimeout(handle);
  }, [search]);

  const pumpFiltered = useMemo(() => {
    let result = [...launches];
    if (search.trim() && !searchHits) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q)
      );
    }
    switch (tab) {
      case "featured":
        result = result.filter((t) => isTokenFeatured(t.metadata));
        break;
      case "graduated":
        result = result.filter((t) => t.graduated);
        result.sort((a, b) => b.marketCap - a.marketCap);
        break;
      case "bonding":
        result = result.filter((t) => !t.graduated);
        result.sort((a, b) => b.progress - a.progress || b.marketCap - a.marketCap);
        break;
      default:
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return result;
  }, [launches, search, searchHits, tab]);

  const browsing = isMarketTab ? market : pumpFiltered;
  const displayed = search.trim()
    ? (searchHits ?? browsing)
    : browsing.filter((t) =>
        !isHiddenToken(t) &&
        (isMarketTab ? hasTokenLogo(t) && hasExploreTxns(t) : hasTokenLogo(t))
      );
  const loading = search.trim()
    ? searching
    : isMarketTab
      ? marketLoading
      : !hydrated;

  const emptyCopy: Record<ViewTab, string> = {
    trending: "No trending pairs yet.",
    volume: "No volume yet.",
    gainers: "No movers yet.",
    new: "No new pairs yet.",
    pump: "No PumpRobin launches yet.",
    featured: "No featured launches right now — boost yours at launch.",
    graduated: "No graduated tokens yet.",
    bonding: "No bonding-curve tokens yet.",
  };

  return (
    <div className="mx-auto w-full max-w-[88rem] px-4 py-5 sm:px-6 sm:py-10">
      <h1 className="rh-display text-3xl sm:text-5xl mb-1 sm:mb-3">Explore</h1>
      <p className="hidden sm:block text-rh-muted mb-8 max-w-2xl">
        Search and trade any token on Robinhood Chain — PumpRobin launches plus
        every indexed DEX pair.
      </p>

      <input
        type="search"
        placeholder="Search name, ticker, or paste a contract address"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-xl mt-4 mb-4 sm:mt-0 sm:mb-6 px-4 py-2.5 sm:px-5 sm:py-3 bg-rh-raised border border-transparent rounded-full text-sm focus:outline-none focus:border-rh-lime/40 placeholder:text-rh-dim"
      />

      <div className="mb-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          role="tablist"
          aria-label="Token views"
          className="inline-flex min-w-full sm:min-w-0 items-center gap-0.5 p-1 rounded-full bg-rh-raised border border-white/[0.06]"
        >
          {TABS.map((t) => {
            const selected = tab === t.id;
            const count =
              t.id === "featured"
                ? counts.featured
                : t.id === "graduated"
                  ? counts.graduated
                  : t.id === "bonding"
                    ? counts.bonding
                    : t.id === "pump"
                      ? counts.pump
                      : undefined;

            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm whitespace-nowrap transition-colors shrink-0",
                  selected
                    ? "bg-rh-lime text-rh-on-lime font-medium"
                    : "text-rh-muted hover:text-white"
                )}
              >
                <span className={cn("hidden sm:inline", selected ? "text-rh-on-lime" : "text-rh-dim")}>
                  {t.icon}
                </span>
                {t.label}
                {t.showCount && typeof count === "number" && (
                  <span
                    className={cn(
                      "min-w-[1.1rem] h-4 px-1 rounded-full text-[10px] font-semibold tabular-nums inline-flex items-center justify-center",
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

      <div className="flex items-center justify-between gap-4 mb-2 sm:mb-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-rh-dim font-medium truncate">
          {search.trim() ? "Search" : active.label}
        </p>
        <p className="text-[11px] text-rh-dim tabular-nums shrink-0">
          {loading ? "Loading…" : `${displayed.length} tokens`}
        </p>
      </div>

      {displayed.length === 0 ? (
        <div className="py-16 sm:py-24 rounded-2xl bg-rh-raised/60 border border-white/[0.04] text-center">
          <p className="text-rh-muted text-sm">
            {loading
              ? "Loading…"
              : search.trim()
                ? "No tokens matched. Try a ticker or contract address."
                : emptyCopy[tab]}
          </p>
        </div>
      ) : (
        <MarketTable tokens={displayed} />
      )}
    </div>
  );
}
