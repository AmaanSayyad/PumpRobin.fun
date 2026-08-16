import type { TradeRecord } from "@/lib/data-types";
import { FEE_COLLECTOR } from "@/lib/chain";
import {
  fetchTokenHoldersCount,
  fetchTokenTopHolders,
  fetchUniswapPoolSwaps,
  swapsToTradeRecords,
  type OnChainHolderRow,
} from "@/lib/uniswap-pool";
import type { Address } from "viem";

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
  const skip = new Set(
    [
      addr,
      poolLc,
      FEE_COLLECTOR.toLowerCase(),
      "0x000000000000000000000000000000000000dead",
      "0x73991a25c818bf1f1128deaab1492d45638de0d3",
      "0xcaf681a66d020601342297493863e78c959e5cb2",
      "0x8876789976decbfcbbbe364623c63652db8c0904",
    ].filter(Boolean) as string[]
  );
  const out: TradeRecord[] = [];

  for (const item of body?.items ?? []) {
    const from = item.from?.hash?.toLowerCase();
    const to = item.to?.hash?.toLowerCase();
    const hash = item.transaction_hash?.toLowerCase();
    if (!from || !to || !hash) continue;
    if (skip.has(from) && skip.has(to)) continue;

    let isBuy: boolean | null = null;
    if (poolLc) {
      if (from === poolLc && !skip.has(to)) isBuy = true;
      else if (to === poolLc && !skip.has(from)) isBuy = false;
    }
    if (isBuy == null) continue;

    const trader = (isBuy ? to : from) || "";
    if (!trader || skip.has(trader)) continue;

    const decimals = Number(item.total?.decimals ?? 18) || 18;
    const tokenAmount = num(item.total?.value) / 10 ** decimals;
    if (!(tokenAmount > 0)) continue;

    const ethAmount = priceEth > 0 ? tokenAmount * priceEth : 0;
    out.push({
      id: `${addr}-${hash}-${from}-${to}`,
      tokenAddress: addr,
      trader,
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
  volume24hEth: number;
}> {
  const address = input.address.toLowerCase();
  const pool = input.pool?.toLowerCase() as Address | undefined;
  const since24h = Date.now() - 24 * 60 * 60 * 1000;

  const [holders, rawHolderCount, gecko, swaps] = await Promise.all([
    fetchTokenTopHolders(address, 10, {
      supply: input.supply ?? 0,
      creator: input.creator ?? undefined,
      bondingCurve: input.bondingCurve,
      uniswapPool: input.pool,
      tokenAddress: address,
    }),
    fetchTokenHoldersCount(address),
    fetchGeckoTrades(address, input.pool, input.priceEth ?? 0),
    pool
      ? fetchUniswapPoolSwaps({
          pool,
          token: address as Address,
        }).then((rows) => swapsToTradeRecords(address, rows))
      : Promise.resolve([] as TradeRecord[]),
  ]);

  const protocol = new Set(
    [
      address,
      pool,
      input.bondingCurve?.toLowerCase(),
      FEE_COLLECTOR.toLowerCase(),
      "0x000000000000000000000000000000000000dead",
    ].filter(Boolean) as string[]
  );
  const protocolInTop = holders.filter(
    (h) =>
      h.isLp ||
      h.isBurned ||
      h.isCurve ||
      h.label === "Platform fees" ||
      h.label === "Creator fees"
  ).length;
  const holderCount =
    rawHolderCount != null
      ? Math.max(0, rawHolderCount - protocolInTop)
      : holders.filter((h) => !h.isLp && !h.isBurned && !h.isCurve && !protocol.has(h.address))
          .length;

  const seen = new Set<string>();
  const trades: TradeRecord[] = [];
  let primary = swaps.length > 0 ? swaps : gecko;
  if (primary.length === 0) {
    primary = await fetchBlockscoutTransfers(
      address,
      input.pool,
      input.priceEth ?? 0
    );
  }
  for (const t of primary) {
    const key = t.id.replace(/-\d+$/, "");
    if (seen.has(t.id) || seen.has(key)) continue;
    seen.add(t.id);
    seen.add(key);
    trades.push(t);
  }
  trades.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const volume24hEth = trades
    .filter((t) => new Date(t.timestamp).getTime() >= since24h)
    .reduce((s, t) => s + (Number(t.ethAmount) || 0), 0);

  return {
    holders,
    holderCount,
    trades: trades.slice(0, 20),
    volume24hEth,
  };
}
