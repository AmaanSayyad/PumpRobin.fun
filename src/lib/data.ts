import { CHAIN_CONFIG } from "@/lib/chain";
import type {
  LaunchMetadata,
  LeaderboardEntry,
  PlatformState,
  PlatformStats,
  TokenData,
  TokenRecord,
  TradeData,
  TradeRecord,
} from "@/lib/data-types";
import {
  EMPTY_STATS,
  deserializeTrade,
  isTokenFeatured,
  LAUNCH_EXTRA_SOCIAL_FIELDS,
  LAUNCH_PRIMARY_SOCIAL_FIELDS,
  LAUNCH_SOCIAL_FIELDS,
  pickSocialMetadata,
} from "@/lib/data-client";

export type {
  LaunchMetadata,
  LeaderboardEntry,
  PlatformState,
  PlatformStats,
  TokenData,
  TokenRecord,
  TradeData,
  TradeRecord,
} from "@/lib/data-types";

export type { LaunchSocialKey } from "@/lib/data-client";

export {
  EMPTY_STATS,
  deserializeTrade,
  isTokenFeatured,
  LAUNCH_EXTRA_SOCIAL_FIELDS,
  LAUNCH_PRIMARY_SOCIAL_FIELDS,
  LAUNCH_SOCIAL_FIELDS,
  pickSocialMetadata,
};

/** Prefer execution price (eth/token) — curve `getPrice()` is wrong after instant Uniswap seed. */
export function tradeExecutionPrice(t: {
  ethAmount: number;
  tokenAmount: number;
  price: number;
}): number {
  if (t.tokenAmount > 0 && t.ethAmount > 0) {
    return t.ethAmount / t.tokenAmount;
  }
  return t.price > 0 ? t.price : 0;
}

function priceOf(token: TokenRecord): number {
  const spot = token.metadata?.spotPriceEth;
  if (
    token.graduated &&
    typeof spot === "number" &&
    Number.isFinite(spot) &&
    spot > 0
  ) {
    return spot;
  }
  if (token.virtualTokenReserves <= 0) return 0;
  return token.virtualEthReserves / token.virtualTokenReserves;
}

function volumeInWindow(
  trades: TradeRecord[],
  tokenAddress: string | null,
  sinceMs: number
): number {
  return trades
    .filter(
      (t) =>
        (!tokenAddress || t.tokenAddress === tokenAddress) &&
        new Date(t.timestamp).getTime() >= sinceMs
    )
    .reduce((s, t) => s + t.ethAmount, 0);
}

function uniqueHolders(
  trades: TradeRecord[],
  tokenAddress: string,
  bondingCurve?: string | null
): number {
  const curve = bondingCurve?.toLowerCase();
  const net = new Map<string, number>();
  for (const t of trades) {
    if (t.tokenAddress.toLowerCase() !== tokenAddress.toLowerCase()) continue;
    const key = t.trader.toLowerCase();
    if (curve && key === curve) continue;
    const prev = net.get(key) ?? 0;
    net.set(key, prev + (t.isBuy ? t.tokenAmount : -t.tokenAmount));
  }
  let count = 0;
  for (const bal of net.values()) {
    if (bal > 1e-9) count++;
  }
  return count;
}

function priceChange24h(
  trades: TradeRecord[],
  tokenAddress: string,
  currentPrice: number
): number {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const older = trades
    .filter(
      (t) =>
        t.tokenAddress === tokenAddress &&
        new Date(t.timestamp).getTime() < since
    )
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];

  const recent = trades
    .filter(
      (t) =>
        t.tokenAddress === tokenAddress &&
        new Date(t.timestamp).getTime() >= since
    )
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )[0];

  const baseTrade = older ?? recent;
  const base = baseTrade ? tradeExecutionPrice(baseTrade) : 0;
  if (!base || base === 0) return 0;
  return ((currentPrice - base) / base) * 100;
}

export function enrichToken(
  token: TokenRecord,
  trades: TradeRecord[]
): TokenData {
  const price = priceOf(token);
  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const supply = token.metadata?.supply ?? 1_000_000_000;
  const deadSupply = token.metadata?.deadSupply ?? 0;
  const circulatingSupply = Math.max(0, supply - deadSupply);
  const marketCapFdv = price * supply;
  const marketCapCirculating = price * circulatingSupply;
  const mostlyBurned =
    deadSupply > 0 && deadSupply >= supply * 0.5;
  const marketCap = mostlyBurned ? marketCapCirculating : marketCapFdv;
  /** Classic bonding-curve open FDV — NOT the Uniswap seed price */
  const launchFdv = (1.3 / 1_073_000_000) * supply;

  let athFromTrades = 0;
  for (const t of trades) {
    if (t.tokenAddress.toLowerCase() !== token.address.toLowerCase()) continue;
    const px = tradeExecutionPrice(t);
    if (px > 0) {
      const athSupply = mostlyBurned ? circulatingSupply : supply;
      athFromTrades = Math.max(athFromTrades, px * athSupply);
    }
  }

  const prevAth = token.metadata?.athMarketCapEth ?? 0;
  // Drop ATH that was frozen at bogus virtual-curve FDV after instant Uniswap seed
  const prevAthIsVirtualFloor =
    token.graduated &&
    prevAth > 0 &&
    Math.abs(prevAth - launchFdv) / launchFdv < 0.05;
  // Drop FDV-based ATH when most supply is burned (circulating mcap is primary)
  const prevAthIsFdvBased =
    mostlyBurned &&
    marketCapFdv > 0 &&
    prevAth > 0 &&
    Math.abs(prevAth - marketCapFdv) / marketCapFdv < 0.15;

  const athMarketCap = token.graduated
    ? Math.max(
        marketCap,
        mostlyBurned ? price * circulatingSupply : marketCapFdv,
        athFromTrades,
        prevAthIsVirtualFloor || prevAthIsFdvBased ? 0 : prevAth
      )
    : Math.max(marketCap, launchFdv, athFromTrades, prevAth);

  const holders = uniqueHolders(trades, token.address, token.bondingCurve);
  const soldFromCurve =
    supply > 0 && token.realTokenReserves < supply - 1
      ? Math.max(0, supply - token.realTokenReserves)
      : 0;
  // If curve has sold tokens but trades weren't indexed, show at least 1 holder
  const holdersFixed =
    holders > 0 ? holders : soldFromCurve > 1e-6 ? 1 : 0;
  const explorerHolders = token.metadata?.holdersCount;
  const holdersFinal =
    typeof explorerHolders === "number" && explorerHolders > holdersFixed
      ? explorerHolders
      : holdersFixed;

  const graduationEth = CHAIN_CONFIG.graduationThreshold;
  const liquidityEth = token.metadata?.liquidityEth;

  return {
    address: token.address,
    bondingCurve: token.bondingCurve,
    name: token.name,
    symbol: token.symbol,
    imageUri: token.imageUri,
    description: token.description,
    creator: token.creator,
    createdAt: new Date(token.createdAt),
    price,
    marketCap,
    marketCapFdv,
    circulatingSupply,
    athMarketCap,
    volume24h: volumeInWindow(trades, token.address, since24h),
    holders: holdersFinal,
    progress: token.graduated
      ? 100
      : Math.min(100, (token.realEthReserves / graduationEth) * 100),
    graduated: token.graduated,
    priceChange24h: priceChange24h(trades, token.address, price),
    ethReserves:
      token.graduated && typeof liquidityEth === "number"
        ? liquidityEth
        : token.realEthReserves,
    virtualEthReserves: token.virtualEthReserves,
    virtualTokenReserves: token.virtualTokenReserves,
    realTokenReserves: token.realTokenReserves,
    source: token.source,
    txHash: token.txHash,
    metadata: token.metadata,
  };
}

export function getPlatformStats(
  tokens: TokenRecord[],
  trades: TradeRecord[]
): PlatformStats {
  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const traders = new Set(trades.map((t) => t.trader.toLowerCase()));
  const activeTraders = new Set(
    trades
      .filter((t) => new Date(t.timestamp).getTime() >= since24h)
      .map((t) => t.trader.toLowerCase())
  );

  const graduated = tokens.filter((t) => t.graduated);
  let avgGraduationTime: number | null = null;
  if (graduated.length > 0) {
    // Approximate: use first trade after creation that pushes over threshold — store not available,
    // so average time from create to now for graduated is dishonest. Use create→updated via trade that graduated.
    // Prefer null until we store graduatedAt. For now compute from last trade before graduation if any.
    avgGraduationTime = null;
  }

  return {
    totalTokens: tokens.length,
    totalVolume: trades.reduce((s, t) => s + t.ethAmount, 0),
    totalTrades: trades.length,
    activeTraders: activeTraders.size,
    graduatedTokens: graduated.length,
    volume24h: volumeInWindow(trades, null, since24h),
    feesCollected: trades.reduce((s, t) => s + (t.feeEth || 0), 0),
    avgGraduationTime,
  };
}

export function getLeaderboard(tokens: TokenData[]): LeaderboardEntry[] {
  return [...tokens]
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 20)
    .map((t, i) => ({
      rank: i + 1,
      address: t.address,
      name: t.name,
      symbol: t.symbol,
      imageUri: t.imageUri,
      marketCap: t.marketCap,
      volume24h: t.volume24h,
      holders: t.holders,
      progress: t.progress,
    }));
}

export function serializeTrade(t: TradeData): TradeRecord {
  return {
    id: t.id,
    tokenAddress: t.tokenAddress,
    trader: t.trader,
    isBuy: t.isBuy,
    ethAmount: t.ethAmount,
    tokenAmount: t.tokenAmount,
    price: t.price,
    feeEth: t.feeEth,
    timestamp: t.timestamp.toISOString(),
  };
}

export function hourlyBuckets(
  tokens: TokenRecord[],
  trades: TradeRecord[],
  hours = 24
): Array<{ hour: string; launches: number; volume: number; trades: number }> {
  const now = new Date();
  const buckets: Array<{
    hour: string;
    launches: number;
    volume: number;
    trades: number;
    start: number;
  }> = [];

  for (let i = hours - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() - i);
    buckets.push({
      hour: `${d.getHours().toString().padStart(2, "0")}:00`,
      launches: 0,
      volume: 0,
      trades: 0,
      start: d.getTime(),
    });
  }

  for (const token of tokens) {
    const ts = new Date(token.createdAt).getTime();
    for (let i = buckets.length - 1; i >= 0; i--) {
      const end =
        i === buckets.length - 1
          ? Infinity
          : buckets[i + 1].start;
      if (ts >= buckets[i].start && ts < end) {
        buckets[i].launches++;
        break;
      }
    }
  }

  for (const trade of trades) {
    const ts = new Date(trade.timestamp).getTime();
    for (let i = buckets.length - 1; i >= 0; i--) {
      const end =
        i === buckets.length - 1
          ? Infinity
          : buckets[i + 1].start;
      if (ts >= buckets[i].start && ts < end) {
        buckets[i].trades++;
        buckets[i].volume += trade.ethAmount;
        break;
      }
    }
  }

  return buckets.map(({ hour, launches, volume, trades: tradeCount }) => ({
    hour,
    launches,
    volume,
    trades: tradeCount,
  }));
}

export function dailyVolumeSeries(
  trades: TradeRecord[],
  days = 14
): Array<{ day: string; volume: number; tokens: number }> {
  const now = new Date();
  const series: Array<{ day: string; volume: number; tokens: number; start: number }> =
    [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    series.push({
      day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      volume: 0,
      tokens: 0,
      start: d.getTime(),
    });
  }

  const tokenDays = new Map<number, Set<string>>();

  for (const trade of trades) {
    const ts = new Date(trade.timestamp).getTime();
    for (let i = series.length - 1; i >= 0; i--) {
      const end =
        i === series.length - 1
          ? Infinity
          : series[i + 1].start;
      if (ts >= series[i].start && ts < end) {
        series[i].volume += trade.ethAmount;
        if (!tokenDays.has(i)) tokenDays.set(i, new Set());
        tokenDays.get(i)!.add(trade.tokenAddress);
        break;
      }
    }
  }

  return series.map((s, i) => ({
    day: s.day,
    volume: s.volume,
    tokens: tokenDays.get(i)?.size ?? 0,
  }));
}

export function weeklyGraduations(
  tokens: TokenRecord[]
): Array<{ day: string; graduated: number }> {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const t of tokens) {
    if (!t.graduated) continue;
    const ts = new Date(t.createdAt).getTime();
    // Without graduatedAt, approximate with create day only if graduated — not ideal.
    // Prefer counting only if updated recently; for honest stats use 0 unless we have Graduated events.
    if (ts >= weekAgo) {
      counts[new Date(t.createdAt).getDay()]++;
    }
  }

  // Return days Mon-Sun ordered for chart
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((d) => ({ day: labels[d], graduated: counts[d] }));
}
