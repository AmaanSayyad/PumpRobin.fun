export interface LaunchMetadata {
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  linkedin?: string;
  github?: string;
  litepaper?: string;
  teaserVideo?: string;
  pitchDeck?: string;
  docs?: string;
  instagram?: string;
  reddit?: string;
  tiktok?: string;
  farcaster?: string;
  bannerUri?: string;
  communityCoin?: boolean;
  communityBoard?: boolean;
  antiSnipe?: boolean;
  maxWallet2pct?: boolean;
  customSupply?: boolean;
  supply?: number;
  decimals?: number;
  initialBuyEth?: number;
  /** Buy this % of supply at launch (sets initialBuyEth) */
  ownershipPct?: number;
  /** Share creator fee stream with other wallets (metadata until on-chain split ships) */
  feeSharing?: boolean;
  feeShares?: Array<{ address: string; pct: number }>;
  /** Set after bonding-curve graduation */
  uniswapPool?: string;
}

/** Always-visible socials on the launch form */
export const LAUNCH_PRIMARY_SOCIAL_FIELDS = [
  { key: "website", label: "Website link", placeholder: "https://" },
  { key: "twitter", label: "X / Twitter link", placeholder: "https://x.com/…" },
  { key: "telegram", label: "Telegram link", placeholder: "https://t.me/…" },
] as const satisfies ReadonlyArray<{
  key: keyof LaunchMetadata;
  label: string;
  placeholder: string;
}>;

/** Extra optional links (collapsed under “Add social links”) */
export const LAUNCH_EXTRA_SOCIAL_FIELDS = [
  { key: "discord", label: "Discord link", placeholder: "https://discord.gg/…" },
  { key: "linkedin", label: "LinkedIn link", placeholder: "https://linkedin.com/…" },
  { key: "github", label: "GitHub link", placeholder: "https://github.com/…" },
  { key: "litepaper", label: "Litepaper link", placeholder: "https://…" },
  { key: "teaserVideo", label: "Teaser video link", placeholder: "https://…" },
  { key: "pitchDeck", label: "Pitch deck link", placeholder: "https://…" },
  { key: "docs", label: "Docs link", placeholder: "https://…" },
  { key: "instagram", label: "Instagram link", placeholder: "https://instagram.com/…" },
  { key: "reddit", label: "Reddit link", placeholder: "https://reddit.com/…" },
  { key: "tiktok", label: "TikTok link", placeholder: "https://tiktok.com/…" },
  { key: "farcaster", label: "Farcaster link", placeholder: "https://warpcast.com/…" },
] as const satisfies ReadonlyArray<{
  key: keyof LaunchMetadata;
  label: string;
  placeholder: string;
}>;

/** Optional link keys shown on the launch form / token page */
export const LAUNCH_SOCIAL_FIELDS = [
  ...LAUNCH_PRIMARY_SOCIAL_FIELDS,
  ...LAUNCH_EXTRA_SOCIAL_FIELDS,
] as const;

export type LaunchSocialKey =
  | (typeof LAUNCH_PRIMARY_SOCIAL_FIELDS)[number]["key"]
  | (typeof LAUNCH_EXTRA_SOCIAL_FIELDS)[number]["key"];

export function pickSocialMetadata(
  meta: Partial<LaunchMetadata> | null | undefined
): Partial<LaunchMetadata> {
  if (!meta) return {};
  const out: Partial<LaunchMetadata> = {};
  for (const { key } of LAUNCH_SOCIAL_FIELDS) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out;
}

export interface TokenRecord {
  address: string;
  bondingCurve: string;
  name: string;
  symbol: string;
  imageUri: string;
  description: string;
  creator: string;
  createdAt: string; // ISO
  /** Curve state — all ETH amounts in ETH units, tokens in whole tokens */
  virtualEthReserves: number;
  virtualTokenReserves: number;
  realEthReserves: number;
  realTokenReserves: number;
  graduated: boolean;
  source: "registry" | "onchain";
  txHash?: string;
  metadata?: LaunchMetadata;
}

export interface TradeRecord {
  id: string;
  tokenAddress: string;
  trader: string;
  isBuy: boolean;
  ethAmount: number;
  tokenAmount: number;
  price: number;
  feeEth: number;
  timestamp: string; // ISO
}

export interface PlatformState {
  tokens: TokenRecord[];
  trades: TradeRecord[];
  autoLaunchEnabled: boolean;
  lastAutoLaunch: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TokenData {
  address: string;
  bondingCurve: string;
  name: string;
  symbol: string;
  imageUri: string;
  description: string;
  creator: string;
  createdAt: Date;
  price: number; // ETH per token
  marketCap: number; // ETH
  volume24h: number; // ETH
  holders: number;
  progress: number;
  graduated: boolean;
  priceChange24h: number; // percent
  ethReserves: number;
  virtualEthReserves: number;
  virtualTokenReserves: number;
  realTokenReserves: number;
  source: "registry" | "onchain";
  txHash?: string;
  metadata?: LaunchMetadata;
}

export interface TradeData {
  id: string;
  tokenAddress: string;
  trader: string;
  isBuy: boolean;
  ethAmount: number;
  tokenAmount: number;
  price: number;
  feeEth: number;
  timestamp: Date;
}

export interface PlatformStats {
  totalTokens: number;
  totalVolume: number; // ETH all-time
  totalTrades: number;
  activeTraders: number;
  graduatedTokens: number;
  volume24h: number; // ETH
  feesCollected: number; // ETH
  avgGraduationTime: number | null; // hours, null if none
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  name: string;
  symbol: string;
  imageUri: string;
  marketCap: number;
  volume24h: number;
  holders: number;
  progress: number;
}

export const EMPTY_STATS: PlatformStats = {
  totalTokens: 0,
  totalVolume: 0,
  totalTrades: 0,
  activeTraders: 0,
  graduatedTokens: 0,
  volume24h: 0,
  feesCollected: 0,
  avgGraduationTime: null,
};

function priceOf(token: TokenRecord): number {
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

function uniqueHolders(trades: TradeRecord[], tokenAddress: string): number {
  const net = new Map<string, number>();
  for (const t of trades) {
    if (t.tokenAddress !== tokenAddress) continue;
    const prev = net.get(t.trader.toLowerCase()) ?? 0;
    net.set(
      t.trader.toLowerCase(),
      prev + (t.isBuy ? t.tokenAmount : -t.tokenAmount)
    );
  }
  let count = 0;
  for (const bal of net.values()) {
    if (bal > 1e-12) count++;
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

  const base = older?.price ?? recent?.price;
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
    marketCap: price * supply,
    volume24h: volumeInWindow(trades, token.address, since24h),
    holders: uniqueHolders(trades, token.address),
    progress: token.graduated
      ? 100
      : Math.min(100, (token.realEthReserves / 5) * 100),
    graduated: token.graduated,
    priceChange24h: priceChange24h(trades, token.address, price),
    ethReserves: token.realEthReserves,
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

export function deserializeTrade(t: TradeRecord): TradeData {
  return {
    ...t,
    feeEth: t.feeEth ?? 0,
    timestamp: new Date(t.timestamp),
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
