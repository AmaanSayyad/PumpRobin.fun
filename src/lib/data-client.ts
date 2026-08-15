import type { LaunchMetadata, PlatformStats, TradeData, TradeRecord } from "./data-types";

/** Tokens that must never appear in browse, search, or token pages. */
const HIDDEN_TOKEN_ADDRESSES = new Set([
  "0x35a59ed3b6c90ef7e9db18d64c6e577633281375",
]);
const HIDDEN_TICKERS = new Set(["vlad"]);

export function isHiddenAddress(address?: string | null): boolean {
  return Boolean(address && HIDDEN_TOKEN_ADDRESSES.has(address.toLowerCase()));
}

export function isHiddenToken(token: {
  address?: string | null;
  symbol?: string | null;
  name?: string | null;
}): boolean {
  if (isHiddenAddress(token.address)) return true;
  const symbol = token.symbol?.trim().toLowerCase();
  const name = token.name?.trim().toLowerCase();
  return Boolean(
    (symbol && HIDDEN_TICKERS.has(symbol)) || (name && HIDDEN_TICKERS.has(name))
  );
}

/** Chain-wide DEX tokens (not launched through PumpRobin). */
export function isMarketToken(token: {
  source?: string;
  bondingCurve?: string;
}): boolean {
  if (token.source === "market") return true;
  return !token.bondingCurve || token.bondingCurve === "0x0000000000000000000000000000000000000000";
}

/** Tokens created through PumpRobin (registry or on-chain factory). */
export function isPumpRobinLaunch(token: { source?: string }): boolean {
  return token.source === "registry" || token.source === "onchain";
}

/** Whether a token's paid Explore feature is still active. */
export function isTokenFeatured(meta?: LaunchMetadata | null): boolean {
  if (!meta?.featured || !meta.featuredUntil) return false;
  const until = new Date(meta.featuredUntil).getTime();
  return Number.isFinite(until) && until > Date.now();
}

/** Real artwork — empty / indexer placeholders are hidden from Explore browse. */
export function hasTokenLogo(token: { imageUri?: string | null }): boolean {
  const src = token.imageUri?.trim() ?? "";
  if (!src) return false;
  if (/missing/i.test(src)) return false;
  return true;
}

const MIN_EXPLORE_TXNS = 100;

/** Browse lists hide illiquid / spam pairs; search still returns them. */
export function hasExploreTxns(token: {
  metadata?: { txns24h?: number } | null;
}): boolean {
  return (token.metadata?.txns24h ?? 0) >= MIN_EXPLORE_TXNS;
}

export const LAUNCH_PRIMARY_SOCIAL_FIELDS = [
  { key: "website", label: "Website link", placeholder: "https://" },
  { key: "twitter", label: "X / Twitter link", placeholder: "https://x.com/…" },
  { key: "telegram", label: "Telegram link", placeholder: "https://t.me/…" },
] as const satisfies ReadonlyArray<{
  key: keyof LaunchMetadata;
  label: string;
  placeholder: string;
}>;

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

export const EMPTY_STATS: PlatformStats = {
  totalTokens: 0,
  totalVolume: 0,
  totalTrades: 0,
  activeTraders: 0,
  graduatedTokens: 0,
  volume24h: 0,
  volume24hUsd: 0,
  totalVolumeUsd: 0,
  feesCollected: 0,
  avgGraduationTime: null,
};

export function deserializeTrade(t: TradeRecord): TradeData {
  return {
    ...t,
    feeEth: t.feeEth ?? 0,
    timestamp: new Date(t.timestamp),
  };
}
