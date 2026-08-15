import type { TradeRecord } from "@/lib/data-types";
import {
  fetchTokenHoldersCount,
  fetchTokenTopHolders,
  type OnChainHolderRow,
} from "@/lib/uniswap-pool";

const GECKO = "https://api.geckoterminal.com/api/v2";
const BLOCKSCOUT = "https://robinhoodchain.blockscout.com/api/v2";
const NETWORK = "robinhood";

type GeckoTrade = {
  attributes?: {
    tx_hash?: string;
    tx_from_address?: string;
    from_token_amount?: string;
    to_token_amount?: string;
    volume_in_usd?: string;
    kind?: string;
    timestamp?: string;
    price_to_in_usd?: string;
    price_from_in_usd?: string;
  };
};

type BsTransfer = {
  transaction_hash?: string;
  timestamp?: string;
  method?: string;
  from?: { hash?: string; is_contract?: boolean };
  to?: { hash?: string; is_contract?: boolean };
  total?: { value?: string; decimals?: string };
};

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

async function fetchJson<T>(url: string, revalidate = 30): Promise<T | null> {
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

function geckoToTrades(
  token: string,
  rows: GeckoTrade[],
  priceEth: number
): TradeRecord[] {
  const addr = token.toLowerCase();
  const out: TradeRecord[] = [];
  for (const row of rows) {
    const a = row.attributes ?? {};
    const hash = a.tx_hash?.toLowerCase();
    if (!hash) continue;
    const isBuy = (a.kind || "").toLowerCase() === "buy";
    const fromAmt = num(a.from_token_amount);
    const toAmt = num(a.to_token_amount);
    const usd = num(a.volume_in_usd);
    const tokenAmount = isBuy ? toAmt || fromAmt : fromAmt || toAmt;
    const ethAmount =
      priceEth > 0 && tokenAmount > 0
        ? tokenAmount * priceEth
        : usd > 0
          ? usd / 2500
          : 0;
    out.push({
      id: `${addr}-${hash}`,
      tokenAddress: addr,
      trader: (a.tx_from_address || "").toLowerCase() || hash,
      isBuy,
      ethAmount,
      tokenAmount,
      price: tokenAmount > 0 && ethAmount > 0 ? ethAmount / tokenAmount : priceEth,
      feeEth: 0,
      timestamp: a.timestamp || new Date().toISOString(),
    });
  }
  return out;
}

async function fetchGeckoTrades(
  token: string,
  pool?: string | null,
  priceEth = 0
): Promise<TradeRecord[]> {
  const urls = [
    pool
      ? `${GECKO}/networks/${NETWORK}/pools/${pool}/trades`
      : null,
    `${GECKO}/networks/${NETWORK}/tokens/${token}/trades`,
  ].filter(Boolean) as string[];

  for (const url of urls) {
    const body = await fetchJson<{ data?: GeckoTrade[] }>(url, 20);
    const rows = geckoToTrades(token, body?.data ?? [], priceEth);
    if (rows.length > 0) return rows;
  }
  return [];
}

async function fetchBlockscoutTransfers(
  token: string,
  pool?: string | null,
  priceEth = 0
): Promise<TradeRecord[]> {
  const body = await fetchJson<{ items?: BsTransfer[] }>(
    `${BLOCKSCOUT}/tokens/${token}/transfers`,
    20
  );
  const poolLc = pool?.toLowerCase();
  const addr = token.toLowerCase();
  const out: TradeRecord[] = [];

  for (const item of body?.items ?? []) {
    const from = item.from?.hash?.toLowerCase();
    const to = item.to?.hash?.toLowerCase();
    const hash = item.transaction_hash?.toLowerCase();
    if (!from || !to || !hash) continue;

    let isBuy: boolean | null = null;
    if (poolLc) {
      if (from === poolLc) isBuy = true;
      else if (to === poolLc) isBuy = false;
    } else if (item.from?.is_contract && !item.to?.is_contract) {
      isBuy = true;
    } else if (item.to?.is_contract && !item.from?.is_contract) {
      isBuy = false;
    }
    if (isBuy == null) continue;

    const decimals = Number(item.total?.decimals ?? 18) || 18;
    const tokenAmount = num(item.total?.value) / 10 ** decimals;
    if (!(tokenAmount > 0)) continue;

    const ethAmount = priceEth > 0 ? tokenAmount * priceEth : 0;
    out.push({
      id: `${addr}-${hash}-${from}-${to}`,
      tokenAddress: addr,
      trader: (isBuy ? to : from) || hash,
      isBuy,
      ethAmount,
      tokenAmount,
      price: priceEth,
      feeEth: 0,
      timestamp: item.timestamp || new Date().toISOString(),
    });
  }
  return out;
}

export async function fetchTokenActivity(input: {
  address: string;
  pool?: string | null;
  supply?: number;
  creator?: string | null;
  bondingCurve?: string | null;
  priceEth?: number;
}): Promise<{
  holders: OnChainHolderRow[];
  holderCount: number | null;
  trades: TradeRecord[];
}> {
  const address = input.address.toLowerCase();
  const [holders, holderCount, gecko, transfers] = await Promise.all([
    fetchTokenTopHolders(address, 10, {
      supply: input.supply ?? 0,
      creator: input.creator ?? undefined,
      bondingCurve: input.bondingCurve,
      uniswapPool: input.pool,
    }),
    fetchTokenHoldersCount(address),
    fetchGeckoTrades(address, input.pool, input.priceEth ?? 0),
    fetchBlockscoutTransfers(address, input.pool, input.priceEth ?? 0),
  ]);

  const seen = new Set<string>();
  const trades: TradeRecord[] = [];
  for (const t of [...gecko, ...transfers]) {
    const key = t.id;
    if (seen.has(key)) continue;
    seen.add(key);
    trades.push(t);
  }
  trades.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return {
    holders,
    holderCount,
    trades: trades.slice(0, 20),
  };
}
