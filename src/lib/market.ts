import { isAddress, type Address } from "viem";
import { ERC20_ABI, UNISWAP_V3_FACTORY_ABI } from "@/lib/contracts";
import { UNISWAP_V3, WETH_ADDRESS } from "@/lib/chain";
import { isHiddenAddress, isHiddenToken } from "@/lib/data-client";
import { fetchEthUsdPrice } from "@/lib/eth-usd";
import { getRobinhoodPublicClient } from "@/lib/onchain-curve";
import { enrichToken } from "@/lib/data";
import { readPlatformState } from "@/lib/registry";
import type { LaunchMetadata, TokenData, TokenRecord } from "@/lib/data-types";

export const DEXSCREENER_CHAIN = "robinhood";
export const GECKO_NETWORK = "robinhood";

const DEX_API = "https://api.dexscreener.com";
const GECKO_API = "https://api.geckoterminal.com/api/v2";
const ZERO = "0x0000000000000000000000000000000000000000";

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

const QUOTE_ADDRESSES = new Set([
  WETH_ADDRESS.toLowerCase(),
  "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34", // USDE
]);

const POOL_FEE_TIERS = [10_000, 3_000, 500, 100] as const;

export type MarketTab = "trending" | "volume" | "new" | "gainers";

type DexToken = {
  address?: string;
  name?: string;
  symbol?: string;
};

type DexPair = {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  pairCreatedAt?: number;
  url?: string;
  priceUsd?: string | number;
  priceNative?: string | number;
  fdv?: number;
  marketCap?: number;
  baseToken?: DexToken;
  quoteToken?: DexToken;
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  txns?: {
    h24?: { buys?: number; sells?: number; buyers?: number; sellers?: number };
  };
  info?: {
    imageUrl?: string;
    header?: string;
    websites?: Array<{ url?: string }>;
    socials?: Array<{ url?: string; type?: string }>;
  };
};

type GeckoPool = {
  id?: string;
  attributes?: {
    address?: string;
    name?: string;
    pool_created_at?: string;
    base_token_price_usd?: string;
    base_token_price_native_currency?: string;
    fdv_usd?: string;
    market_cap_usd?: string;
    reserve_in_usd?: string;
    volume_usd?: { h24?: string };
    price_change_percentage?: {
      m5?: string;
      h1?: string;
      h6?: string;
      h24?: string;
    };
    transactions?: {
      h24?: { buys?: number; sells?: number; buyers?: number; sellers?: number };
    };
  };
  relationships?: {
    base_token?: { data?: { id?: string } };
    quote_token?: { data?: { id?: string } };
    dex?: { data?: { id?: string } };
  };
};

type GeckoToken = {
  id?: string;
  attributes?: {
    address?: string;
    name?: string;
    symbol?: string;
    decimals?: number;
    image_url?: string;
  };
};

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function isQuoteToken(address?: string, symbol?: string): boolean {
  if (address && QUOTE_ADDRESSES.has(address.toLowerCase())) return true;
  if (symbol && QUOTE_SYMBOLS.has(symbol.toUpperCase())) return true;
  return false;
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit & { revalidate?: number }
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        accept: "application/json",
        "user-agent": "PumpRobin.fun/1.0",
        ...(init?.headers ?? {}),
      },
      next: { revalidate: init?.revalidate ?? 45 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function socialsFromDex(info?: DexPair["info"]): Partial<LaunchMetadata> {
  const websites = info?.websites ?? [];
  const socials = info?.socials ?? [];
  const twitter = socials.find((s) => /twitter|x/i.test(s.type || s.url || ""));
  const telegram = socials.find((s) => /telegram|t\.me/i.test(s.type || s.url || ""));
  const discord = socials.find((s) => /discord/i.test(s.type || s.url || ""));
  return {
    website: websites[0]?.url,
    twitter: twitter?.url,
    telegram: telegram?.url,
    discord: discord?.url,
    bannerUri: info?.header,
  };
}

function marketToken(input: {
  address: string;
  name: string;
  symbol: string;
  imageUri?: string;
  createdAt: Date;
  priceEth: number;
  priceUsd: number;
  marketCapUsd: number;
  volumeUsd24h: number;
  liquidityUsd: number;
  txns24h: number;
  traders24h: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange6h: number;
  priceChange24h: number;
  pool?: string;
  dexId?: string;
  decimals?: number;
  socials?: Partial<LaunchMetadata>;
  ethUsd: number;
}): TokenData {
  const ethUsd = input.ethUsd > 0 ? input.ethUsd : 2500;
  const marketCapEth = input.marketCapUsd / ethUsd;
  const volumeEth = input.volumeUsd24h / ethUsd;
  const liqEth = input.liquidityUsd / ethUsd;
  const metadata: LaunchMetadata = {
    ...input.socials,
    uniswapPool: input.pool,
    spotPriceEth: input.priceEth,
    liquidityEth: liqEth,
    decimals: input.decimals ?? 18,
    dexId: input.dexId,
    priceUsd: input.priceUsd,
    marketCapUsd: input.marketCapUsd,
    volumeUsd24h: input.volumeUsd24h,
    liquidityUsd: input.liquidityUsd,
    txns24h: input.txns24h,
    traders24h: input.traders24h,
    priceChange5m: input.priceChange5m,
    priceChange1h: input.priceChange1h,
    priceChange6h: input.priceChange6h,
  };

  return {
    address: input.address,
    bondingCurve: "",
    name: input.name || input.symbol || "Token",
    symbol: input.symbol || "TOKEN",
    imageUri: input.imageUri || "",
    description: "",
    creator: ZERO,
    createdAt: input.createdAt,
    price: input.priceEth,
    marketCap: marketCapEth,
    marketCapFdv: marketCapEth,
    circulatingSupply: 0,
    athMarketCap: marketCapEth,
    volume24h: volumeEth,
    holders: 0,
    progress: 100,
    graduated: true,
    priceChange24h: input.priceChange24h,
    ethReserves: liqEth,
    virtualEthReserves: 0,
    virtualTokenReserves: 0,
    realTokenReserves: 0,
    source: "market",
    metadata,
  };
}

function listedSide(pair: DexPair): {
  token: DexToken;
  quote: DexToken;
} | null {
  const base = pair.baseToken;
  const quote = pair.quoteToken;
  if (!base?.address || !quote?.address) return null;
  if (!isQuoteToken(base.address, base.symbol)) {
    return { token: base, quote };
  }
  if (!isQuoteToken(quote.address, quote.symbol)) {
    return { token: quote, quote: base };
  }
  return null;
}

export function dexPairToToken(pair: DexPair, ethUsd: number): TokenData | null {
  if (pair.chainId && pair.chainId !== DEXSCREENER_CHAIN) return null;
  const side = listedSide(pair);
  if (!side?.token.address) return null;
  const addr = side.token.address;
  const quoteIsWeth = side.quote.address?.toLowerCase() === WETH_ADDRESS.toLowerCase();
  const priceUsd = num(pair.priceUsd);
  const priceNative = num(pair.priceNative);
  const priceEth = quoteIsWeth && priceNative > 0 ? priceNative : priceUsd / (ethUsd || 2500);
  const tx = pair.txns?.h24;
  const created = pair.pairCreatedAt
    ? new Date(pair.pairCreatedAt)
    : new Date();

  return marketToken({
    address: addr,
    name: side.token.name || side.token.symbol || "Token",
    symbol: side.token.symbol || "TOKEN",
    imageUri: pair.info?.imageUrl,
    createdAt: created,
    priceEth,
    priceUsd,
    marketCapUsd: num(pair.marketCap) || num(pair.fdv),
    volumeUsd24h: num(pair.volume?.h24),
    liquidityUsd: num(pair.liquidity?.usd),
    txns24h: num(tx?.buys) + num(tx?.sells),
    traders24h: num(tx?.buyers) + num(tx?.sellers),
    priceChange5m: num(pair.priceChange?.m5),
    priceChange1h: num(pair.priceChange?.h1),
    priceChange6h: num(pair.priceChange?.h6),
    priceChange24h: num(pair.priceChange?.h24),
    pool: pair.pairAddress,
    dexId: pair.dexId,
    socials: socialsFromDex(pair.info),
    ethUsd,
  });
}

function geckoPoolToToken(
  pool: GeckoPool,
  tokens: Map<string, GeckoToken>,
  ethUsd: number
): TokenData | null {
  const baseId = pool.relationships?.base_token?.data?.id;
  const base = baseId ? tokens.get(baseId) : undefined;
  const baseAddr = base?.attributes?.address;
  if (!baseAddr) return null;
  if (isQuoteToken(baseAddr, base?.attributes?.symbol)) return null;

  const token = base;
  const tokenAddr = baseAddr;

  const a = pool.attributes ?? {};
  const tx = a.transactions?.h24;
  const created = a.pool_created_at ? new Date(a.pool_created_at) : new Date();
  const dexId = pool.relationships?.dex?.data?.id?.split("-")[0];

  return marketToken({
    address: tokenAddr,
    name: token?.attributes?.name || token?.attributes?.symbol || "Token",
    symbol: token?.attributes?.symbol || "TOKEN",
    imageUri:
      token?.attributes?.image_url &&
      !token.attributes.image_url.includes("missing")
        ? token.attributes.image_url
        : undefined,
    createdAt: created,
    priceEth: num(a.base_token_price_native_currency),
    priceUsd: num(a.base_token_price_usd),
    marketCapUsd: num(a.market_cap_usd) || num(a.fdv_usd),
    volumeUsd24h: num(a.volume_usd?.h24),
    liquidityUsd: num(a.reserve_in_usd),
    txns24h: num(tx?.buys) + num(tx?.sells),
    traders24h: num(tx?.buyers) + num(tx?.sellers),
    priceChange5m: num(a.price_change_percentage?.m5),
    priceChange1h: num(a.price_change_percentage?.h1),
    priceChange6h: num(a.price_change_percentage?.h6),
    priceChange24h: num(a.price_change_percentage?.h24),
    pool: a.address,
    dexId,
    decimals: token?.attributes?.decimals,
    ethUsd,
  });
}

function mergeTokens(list: TokenData[]): TokenData[] {
  const byAddr = new Map<string, TokenData>();
  for (const t of list) {
    if (!t.address || isHiddenToken(t) || t.name.length > 48 || t.symbol.length > 16) continue;
    const key = t.address.toLowerCase();
    const prev = byAddr.get(key);
    if (!prev) {
      byAddr.set(key, t);
      continue;
    }
    const prevLiq = prev.metadata?.liquidityUsd ?? 0;
    const nextLiq = t.metadata?.liquidityUsd ?? 0;
    const primary = nextLiq > prevLiq ? t : prev;
    const other = primary === t ? prev : t;
    byAddr.set(key, {
      ...primary,
      imageUri: primary.imageUri || other.imageUri,
      metadata: {
        ...primary.metadata,
        volumeUsd24h: Math.max(
          primary.metadata?.volumeUsd24h ?? 0,
          other.metadata?.volumeUsd24h ?? 0
        ),
        txns24h: Math.max(
          primary.metadata?.txns24h ?? 0,
          other.metadata?.txns24h ?? 0
        ),
        traders24h: Math.max(
          primary.metadata?.traders24h ?? 0,
          other.metadata?.traders24h ?? 0
        ),
        liquidityUsd: Math.max(prevLiq, nextLiq),
        marketCapUsd: Math.max(
          primary.metadata?.marketCapUsd ?? 0,
          other.metadata?.marketCapUsd ?? 0
        ),
      },
    });
  }
  return [...byAddr.values()];
}

async function geckoPools(
  path: string,
  ethUsd: number
): Promise<TokenData[]> {
  const joiner = path.includes("?") ? "&" : "?";
  const body = await fetchJson<{
    data?: GeckoPool[];
    included?: GeckoToken[];
  }>(`${GECKO_API}${path}${joiner}include=base_token,quote_token`, {
    revalidate: 45,
  });
  const tokens = new Map<string, GeckoToken>();
  for (const t of body?.included ?? []) {
    if (t.id) tokens.set(t.id, t);
  }
  const mapped = (body?.data ?? [])
    .map((p) => geckoPoolToToken(p, tokens, ethUsd))
    .filter((t): t is TokenData => Boolean(t));
  return mergeTokens(mapped);
}

async function geckoVolumePages(ethUsd: number, pages = 12): Promise<TokenData[]> {
  const out: TokenData[] = [];
  const batchSize = 4;
  for (let start = 0; start < pages; start += batchSize) {
    const n = Math.min(batchSize, pages - start);
    const batches = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        geckoPools(
          `/networks/${GECKO_NETWORK}/pools?page=${start + i + 1}&sort=h24_volume_usd_desc`,
          ethUsd
        )
      )
    );
    out.push(...batches.flat());
  }
  return mergeTokens(out);
}

const DEX_DISCOVERY_QUERIES = [
  "uniswap robinhood",
  "robinhood chain",
  "uniswap v3",
  "pons",
  "noxa",
  "flap",
  "USDG",
  "coco",
  "pipedog",
  "cashcat",
];

type DexBoost = {
  chainId?: string;
  tokenAddress?: string;
  icon?: string;
};

function dexPairsFromBody(body: DexPair[] | { pairs?: DexPair[] } | null): DexPair[] {
  if (!body) return [];
  return Array.isArray(body) ? body : body.pairs ?? [];
}

async function dexSearchRobinhood(ethUsd: number): Promise<TokenData[]> {
  const batches = await Promise.all(
    DEX_DISCOVERY_QUERIES.map(async (q) => {
      const body = await fetchJson<{ pairs?: DexPair[] }>(
        `${DEX_API}/latest/dex/search?q=${encodeURIComponent(q)}`,
        { revalidate: 60 }
      );
      return (body?.pairs ?? [])
        .filter((p) => p.chainId === DEXSCREENER_CHAIN)
        .map((p) => dexPairToToken(p, ethUsd))
        .filter((t): t is TokenData => Boolean(t));
    })
  );
  return mergeTokens(batches.flat());
}

async function dexBoostedRobinhood(ethUsd: number): Promise<TokenData[]> {
  const paths = [
    "/token-boosts/latest/v1",
    "/token-boosts/top/v1",
    "/token-profiles/latest/v1",
    "/token-profiles/recent-updates/v1",
  ];
  const pages = await Promise.all(
    paths.map((path) =>
      fetchJson<DexBoost[]>(`${DEX_API}${path}`, { revalidate: 60 })
    )
  );
  const icons = new Map<string, string>();
  const addrs: string[] = [];
  for (const page of pages) {
    for (const row of page ?? []) {
      if (row.chainId !== DEXSCREENER_CHAIN || !row.tokenAddress) continue;
      const addr = row.tokenAddress.toLowerCase();
      if (!icons.has(addr)) addrs.push(addr);
      if (row.icon) icons.set(addr, row.icon);
    }
  }
  if (addrs.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < addrs.length; i += 30) chunks.push(addrs.slice(i, i + 30));
  const bodies = await Promise.all(
    chunks.map((chunk) =>
      fetchJson<DexPair[] | { pairs?: DexPair[] }>(
        `${DEX_API}/tokens/v1/${DEXSCREENER_CHAIN}/${chunk.join(",")}`,
        { revalidate: 45 }
      )
    )
  );
  return mergeTokens(
    bodies
      .flatMap(dexPairsFromBody)
      .map((p) => {
        const token = dexPairToToken(p, ethUsd);
        if (!token) return null;
        const icon = icons.get(token.address.toLowerCase());
        return icon && !token.imageUri ? { ...token, imageUri: icon } : token;
      })
      .filter((t): t is TokenData => Boolean(t))
  );
}

async function fetchDexscreenerMarket(ethUsd: number): Promise<TokenData[]> {
  const [search, boosted] = await Promise.all([
    dexSearchRobinhood(ethUsd),
    dexBoostedRobinhood(ethUsd),
  ]);
  return mergeTokens([...search, ...boosted]);
}

function sortByVolume(tokens: TokenData[]): TokenData[] {
  return [...tokens].sort(
    (a, b) => (b.metadata?.volumeUsd24h ?? 0) - (a.metadata?.volumeUsd24h ?? 0)
  );
}

export async function fetchMarketTokens(tab: MarketTab): Promise<TokenData[]> {
  const ethUsd = await fetchEthUsdPrice();
  const dex = fetchDexscreenerMarket(ethUsd);

  if (tab === "trending") {
    const [trending, extra] = await Promise.all([
      geckoPools(`/networks/${GECKO_NETWORK}/trending_pools`, ethUsd),
      dex,
    ]);
    return sortByVolume(mergeTokens([...trending, ...extra]));
  }
  if (tab === "new") {
    const [fresh, extra] = await Promise.all([
      geckoPools(`/networks/${GECKO_NETWORK}/new_pools`, ethUsd),
      dex,
    ]);
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const recentDex = extra.filter((t) => t.createdAt.getTime() >= cutoff);
    return mergeTokens([...fresh, ...recentDex]).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }
  const [volume, extra] = await Promise.all([
    geckoVolumePages(ethUsd, 12),
    dex,
  ]);
  const merged = mergeTokens([...volume, ...extra]);
  if (tab === "gainers") {
    return [...merged].sort(
      (a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0)
    );
  }
  return sortByVolume(merged);
}

export async function fetchAllMarketTokens(): Promise<TokenData[]> {
  const [trending, volume, fresh] = await Promise.all([
    fetchMarketTokens("trending"),
    fetchMarketTokens("volume"),
    fetchMarketTokens("new"),
  ]);
  return mergeTokens([...volume, ...trending, ...fresh]);
}

export async function searchMarketTokens(query: string): Promise<TokenData[]> {
  const q = query.trim();
  if (!q) return [];
  const ethUsd = await fetchEthUsdPrice();

  if (isAddress(q)) {
    const resolved = await resolveMarketToken(q);
    return resolved ? [resolved] : [];
  }

  const body = await fetchJson<{ pairs?: DexPair[] }>(
    `${DEX_API}/latest/dex/search?q=${encodeURIComponent(q)}`,
    { revalidate: 20 }
  );
  const mapped = (body?.pairs ?? [])
    .filter((p) => p.chainId === DEXSCREENER_CHAIN)
    .map((p) => dexPairToToken(p, ethUsd))
    .filter((t): t is TokenData => Boolean(t));
  return mergeTokens(mapped).sort(
    (a, b) => (b.metadata?.liquidityUsd ?? 0) - (a.metadata?.liquidityUsd ?? 0)
  );
}

async function dexPairsForToken(address: string): Promise<DexPair[]> {
  const lower = address.toLowerCase();
  const [pairsV1, tokensV1] = await Promise.all([
    fetchJson<DexPair[] | { pairs?: DexPair[] }>(
      `${DEX_API}/token-pairs/v1/${DEXSCREENER_CHAIN}/${lower}`,
      { revalidate: 30 }
    ),
    fetchJson<DexPair[] | { pairs?: DexPair[] }>(
      `${DEX_API}/tokens/v1/${DEXSCREENER_CHAIN}/${lower}`,
      { revalidate: 30 }
    ),
  ]);
  const a = Array.isArray(pairsV1) ? pairsV1 : pairsV1?.pairs ?? [];
  const b = Array.isArray(tokensV1) ? tokensV1 : tokensV1?.pairs ?? [];
  return [...a, ...b];
}

async function resolveFromDex(address: string, ethUsd: number): Promise<TokenData | null> {
  const pairs = await dexPairsForToken(address);
  const mapped = pairs
    .map((p) => dexPairToToken(p, ethUsd))
    .filter((t): t is TokenData => Boolean(t))
    .filter((t) => t.address.toLowerCase() === address.toLowerCase());
  if (mapped.length === 0) {
    const fallback = pairs
      .map((p) => dexPairToToken(p, ethUsd))
      .filter((t): t is TokenData => Boolean(t));
    return mergeTokens(fallback)[0] ?? null;
  }
  return mergeTokens(mapped)[0] ?? null;
}

async function resolveOnchain(address: Address, ethUsd: number): Promise<TokenData | null> {
  const client = getRobinhoodPublicClient();
  try {
    const [name, symbol, decimals, pools] = await Promise.all([
      client.readContract({ address, abi: ERC20_ABI, functionName: "name" }),
      client.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }),
      client.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }),
      Promise.all(
        POOL_FEE_TIERS.map((fee) =>
          client.readContract({
            address: UNISWAP_V3.factory as Address,
            abi: UNISWAP_V3_FACTORY_ABI,
            functionName: "getPool",
            args: [address, WETH_ADDRESS as Address, fee],
          })
        )
      ),
    ]);
    const pool = pools.find(
      (p) => typeof p === "string" && p.toLowerCase() !== ZERO
    ) as string | undefined;
    return marketToken({
      address,
      name: String(name),
      symbol: String(symbol),
      createdAt: new Date(),
      priceEth: 0,
      priceUsd: 0,
      marketCapUsd: 0,
      volumeUsd24h: 0,
      liquidityUsd: 0,
      txns24h: 0,
      traders24h: 0,
      priceChange5m: 0,
      priceChange1h: 0,
      priceChange6h: 0,
      priceChange24h: 0,
      pool,
      dexId: "uniswap",
      decimals: Number(decimals),
      ethUsd,
    });
  } catch {
    return null;
  }
}

export async function resolveMarketToken(address: string): Promise<TokenData | null> {
  if (!isAddress(address) || isHiddenAddress(address)) return null;
  const ethUsd = await fetchEthUsdPrice();
  const fromDex = await resolveFromDex(address, ethUsd);
  if (fromDex) return fromDex;
  return resolveOnchain(address as Address, ethUsd);
}

export async function resolveAnyToken(address: string): Promise<TokenData | null> {
  if (!isAddress(address) || isHiddenAddress(address)) return null;
  const state = await readPlatformState();
  const local = state.tokens.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
  if (local) return enrichToken(local as TokenRecord, state.trades);
  return resolveMarketToken(address);
}

export function serializeToken(token: TokenData) {
  return {
    ...token,
    createdAt:
      token.createdAt instanceof Date
        ? token.createdAt.toISOString()
        : token.createdAt,
  };
}
