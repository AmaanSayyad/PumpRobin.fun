import { WETH_ADDRESS } from "@/lib/chain";
import { fetchEthUsdPrice } from "@/lib/eth-usd";
import { getPlatformStats } from "@/lib/data";
import { readPlatformState } from "@/lib/registry";
import type { PlatformStats } from "@/lib/data-types";

const BLOCKSCOUT_STATS = "https://robinhoodchain.blockscout.com/api/v2/stats";
const MADEONSOL_STATS = "https://madeonsol.com/robinhood/stats";
const LLAMA_DEX =
  "https://api.llama.fi/overview/dexs/Robinhood%20Chain?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true";
const GECKO_API = "https://api.geckoterminal.com/api/v2";
const GECKO_NETWORK = "robinhood";

const ESTABLISHED_LIQ_USD = 25_000;
const GECKO_VOLUME_PAGES = 5;

const QUOTE_ADDRESSES = new Set([
  WETH_ADDRESS.toLowerCase(),
  "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34", // USDE
]);

const QUOTE_SYMBOLS = new Set([
  "WETH",
  "ETH",
  "USDG",
  "USDE",
  "USDC",
  "USDT",
  "DAI",
  "USD",
]);

type Cache = { at: number; stats: PlatformStats };
let cache: Cache | null = null;
const CACHE_MS = 5 * 60_000;

type GeckoPool = {
  attributes?: {
    reserve_in_usd?: string;
    transactions?: {
      h24?: { buyers?: number; sellers?: number; buys?: number; sells?: number };
    };
  };
  relationships?: {
    base_token?: { data?: { id?: string } };
    quote_token?: { data?: { id?: string } };
  };
};

type GeckoToken = {
  id?: string;
  attributes?: { address?: string; symbol?: string };
};

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function isQuote(address?: string, symbol?: string): boolean {
  if (address && QUOTE_ADDRESSES.has(address.toLowerCase())) return true;
  if (symbol && QUOTE_SYMBOLS.has(symbol.toUpperCase())) return true;
  return false;
}

async function fetchChainTokenCount(): Promise<number> {
  try {
    const res = await fetch(MADEONSOL_STATS, {
      headers: {
        accept: "text/html",
        "user-agent": "PumpRobin.fun/1.0",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return 0;
    const html = await res.text();
    const match = html.match(/tracks\s+([\d,]+)\s+tokens/i);
    if (!match) return 0;
    const n = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function fetchJson<T>(url: string, revalidate = 300): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "PumpRobin.fun/1.0",
      },
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function geckoDexSnapshot(): Promise<{
  tokens: Set<string>;
  established: number;
  traders: number;
}> {
  const paths = [
    ...Array.from(
      { length: GECKO_VOLUME_PAGES },
      (_, i) =>
        `/networks/${GECKO_NETWORK}/pools?page=${i + 1}&sort=h24_volume_usd_desc`
    ),
    `/networks/${GECKO_NETWORK}/trending_pools`,
    `/networks/${GECKO_NETWORK}/new_pools`,
  ];

  const pages = await Promise.all(
    paths.map((path) =>
      fetchJson<{ data?: GeckoPool[]; included?: GeckoToken[] }>(
        `${GECKO_API}${path}${path.includes("?") ? "&" : "?"}include=base_token,quote_token`
      )
    )
  );

  const included = new Map<string, GeckoToken>();
  for (const page of pages) {
    for (const t of page?.included ?? []) {
      if (t.id) included.set(t.id, t);
    }
  }

  const tokens = new Set<string>();
  const liqByToken = new Map<string, number>();
  const tradersByToken = new Map<string, number>();

  for (const page of pages) {
    for (const pool of page?.data ?? []) {
      const baseId = pool.relationships?.base_token?.data?.id;
      const quoteId = pool.relationships?.quote_token?.data?.id;
      const base = baseId ? included.get(baseId) : undefined;
      const quote = quoteId ? included.get(quoteId) : undefined;
      const baseAddr = base?.attributes?.address?.toLowerCase();
      const quoteAddr = quote?.attributes?.address?.toLowerCase();

      let listed: string | undefined;
      if (baseAddr && !isQuote(baseAddr, base?.attributes?.symbol)) listed = baseAddr;
      else if (quoteAddr && !isQuote(quoteAddr, quote?.attributes?.symbol)) {
        listed = quoteAddr;
      }
      if (!listed) continue;

      tokens.add(listed);
      const liq = num(pool.attributes?.reserve_in_usd);
      liqByToken.set(listed, Math.max(liqByToken.get(listed) ?? 0, liq));
      const tx = pool.attributes?.transactions?.h24;
      const traders = num(tx?.buyers) + num(tx?.sellers);
      tradersByToken.set(
        listed,
        Math.max(tradersByToken.get(listed) ?? 0, traders)
      );
    }
  }

  let established = 0;
  for (const liq of liqByToken.values()) {
    if (liq >= ESTABLISHED_LIQ_USD) established += 1;
  }

  let traders = 0;
  for (const n of tradersByToken.values()) traders += n;

  return { tokens, established, traders };
}

/**
 * Robinhood Chain-wide stats (DEX + explorer), not just PumpRobin launches.
 */
export async function getEcosystemStats(): Promise<PlatformStats> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.stats;

  const localState = await readPlatformState().catch(() => null);
  const local = localState
    ? getPlatformStats(localState.tokens, localState.trades)
    : null;

  const [chain, llama, dex, ethUsd, chainTokens] = await Promise.all([
    fetchJson<{
      total_transactions?: string;
      transactions_today?: string;
    }>(BLOCKSCOUT_STATS, 60),
    fetchJson<{
      total24h?: number;
      totalAllTime?: number;
    }>(LLAMA_DEX, 120),
    geckoDexSnapshot().catch(() => ({
      tokens: new Set<string>(),
      established: 0,
      traders: 0,
    })),
    fetchEthUsdPrice(),
    fetchChainTokenCount(),
  ]);

  const usd = ethUsd > 0 ? ethUsd : 2500;
  const volume24hUsd = Number(llama?.total24h) || 0;
  const volumeAllUsd = Number(llama?.totalAllTime) || 0;
  const chainTxs = Number(chain?.total_transactions) || 0;

  for (const t of localState?.tokens ?? []) {
    dex.tokens.add(t.address.toLowerCase());
  }

  const localGrad = (localState?.tokens ?? []).filter((t) => t.graduated).length;

  const stats: PlatformStats = {
    totalTokens: Math.max(chainTokens, dex.tokens.size, local?.totalTokens ?? 0),
    totalVolume: volumeAllUsd > 0 ? volumeAllUsd / usd : local?.totalVolume ?? 0,
    totalVolumeUsd: volumeAllUsd > 0 ? volumeAllUsd : undefined,
    totalTrades: chainTxs > 0 ? chainTxs : local?.totalTrades ?? 0,
    activeTraders: Math.max(dex.traders, local?.activeTraders ?? 0),
    graduatedTokens: Math.max(dex.established, localGrad),
    volume24h: volume24hUsd > 0 ? volume24hUsd / usd : local?.volume24h ?? 0,
    volume24hUsd: volume24hUsd > 0 ? volume24hUsd : undefined,
    feesCollected: local?.feesCollected ?? 0,
    avgGraduationTime: local?.avgGraduationTime ?? null,
  };

  cache = { at: Date.now(), stats };
  return stats;
}
