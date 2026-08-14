import { CHAIN_CONFIG } from "@/lib/chain";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";

let cachedUsd: number | null = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60 * 1000;

/** Server-side ETH/USD with in-memory cache. */
export async function fetchEthUsdPrice(): Promise<number> {
  const now = Date.now();
  if (cachedUsd != null && now - cachedAt < CACHE_MS) return cachedUsd;

  try {
    const res = await fetch(COINGECKO_URL, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`price feed ${res.status}`);
    const data = (await res.json()) as { ethereum?: { usd?: number } };
    const usd = data.ethereum?.usd;
    if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) {
      throw new Error("invalid price");
    }
    cachedUsd = usd;
    cachedAt = now;
    return usd;
  } catch {
    return cachedUsd ?? CHAIN_CONFIG.ethUsdFallback;
  }
}

/** Client-side fetch with module-level dedupe. */
let clientPromise: Promise<number> | null = null;

export function fetchEthUsdClient(): Promise<number> {
  if (cachedUsd != null && Date.now() - cachedAt < CACHE_MS) {
    return Promise.resolve(cachedUsd);
  }
  if (!clientPromise) {
    clientPromise = fetch("/api/eth-price")
      .then(async (res) => {
        if (!res.ok) throw new Error("price api");
        const data = (await res.json()) as { usd?: number };
        const usd = data.usd;
        if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) {
          throw new Error("invalid price");
        }
        cachedUsd = usd;
        cachedAt = Date.now();
        return usd;
      })
      .catch(() => CHAIN_CONFIG.ethUsdFallback)
      .finally(() => {
        clientPromise = null;
      });
  }
  return clientPromise;
}
