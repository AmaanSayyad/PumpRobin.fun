import type { TokenData, TradeData, TokenRecord, TradeRecord } from "@/lib/data";
import { enrichToken } from "@/lib/data";
import { DEFAULT_SUPPLY } from "@/lib/curve";

export type WalletHolding = {
  token: TokenData;
  balance: number;
  valueEth: number;
  costEth: number;
  pnlPct: number;
  buyVolumeEth: number;
  sellVolumeEth: number;
  trades: number;
};

export type WalletProfile = {
  address: string;
  created: TokenData[];
  holdings: WalletHolding[];
  recentTrades: Array<TradeData & { tokenName?: string; tokenSymbol?: string }>;
  stats: {
    coinsCreated: number;
    graduatedCreated: number;
    totalCreatedVolumeEth: number;
    totalCreatedMcapEth: number;
    holdingsCount: number;
    portfolioValueEth: number;
    portfolioCostEth: number;
    portfolioPnlPct: number;
    tradeCount: number;
    buyCount: number;
    sellCount: number;
    volumeTradedEth: number;
    uniqueTokensTraded: number;
    feesPaidEth: number;
    estimatedCreatorFeesEth: number;
    firstSeenAt: string | null;
    lastActiveAt: string | null;
  };
};

function netBalancesForWallet(
  trades: TradeRecord[],
  wallet: string
): Map<string, { balance: number; cost: number; buys: number; sells: number; count: number }> {
  const addr = wallet.toLowerCase();
  const map = new Map<
    string,
    { balance: number; cost: number; buys: number; sells: number; count: number }
  >();

  for (const t of trades) {
    if (t.trader.toLowerCase() !== addr) continue;
    const prev = map.get(t.tokenAddress.toLowerCase()) ?? {
      balance: 0,
      cost: 0,
      buys: 0,
      sells: 0,
      count: 0,
    };
    if (t.isBuy) {
      prev.balance += t.tokenAmount;
      prev.cost += t.ethAmount;
      prev.buys += t.ethAmount;
    } else {
      prev.balance -= t.tokenAmount;
      prev.cost = Math.max(0, prev.cost - t.ethAmount);
      prev.sells += t.ethAmount;
    }
    prev.count += 1;
    map.set(t.tokenAddress.toLowerCase(), prev);
  }
  return map;
}

/** Deep wallet / creator analytics from registry tokens + trades. */
export function buildWalletProfile(
  address: string,
  tokens: TokenRecord[],
  trades: TradeRecord[]
): WalletProfile {
  const wallet = address.toLowerCase();
  const enriched = tokens.map((t) => enrichToken(t, trades));
  const byAddr = new Map(enriched.map((t) => [t.address.toLowerCase(), t]));

  const created = enriched
    .filter((t) => t.creator.toLowerCase() === wallet)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const balances = netBalancesForWallet(trades, wallet);
  const holdings: WalletHolding[] = [];

  for (const [tokenAddr, pos] of balances) {
    if (pos.balance <= 1e-9) continue;
    const token = byAddr.get(tokenAddr);
    if (!token) continue;
    const valueEth = pos.balance * token.price;
    const pnlPct =
      pos.cost > 0 ? ((valueEth - pos.cost) / pos.cost) * 100 : 0;
    holdings.push({
      token,
      balance: pos.balance,
      valueEth,
      costEth: pos.cost,
      pnlPct,
      buyVolumeEth: pos.buys,
      sellVolumeEth: pos.sells,
      trades: pos.count,
    });
  }
  holdings.sort((a, b) => b.valueEth - a.valueEth);

  const walletTrades = trades
    .filter((t) => t.trader.toLowerCase() === wallet)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

  const recentTrades = walletTrades.slice(0, 50).map((t) => {
    const tok = byAddr.get(t.tokenAddress.toLowerCase());
    return {
      id: t.id,
      tokenAddress: t.tokenAddress,
      trader: t.trader,
      isBuy: t.isBuy,
      ethAmount: t.ethAmount,
      tokenAmount: t.tokenAmount,
      price: t.price,
      feeEth: t.feeEth,
      timestamp: new Date(t.timestamp),
      tokenName: tok?.name,
      tokenSymbol: tok?.symbol,
    };
  });

  const createdAddrs = new Set(created.map((t) => t.address.toLowerCase()));
  const volumeOnCreated = trades
    .filter((t) => createdAddrs.has(t.tokenAddress.toLowerCase()))
    .reduce((s, t) => s + t.ethAmount, 0);

  // Rough creator fee share: 1% of volume on their coins (matches CREATOR_FEE_BPS)
  const estimatedCreatorFeesEth = volumeOnCreated * 0.01;

  const portfolioValueEth = holdings.reduce((s, h) => s + h.valueEth, 0);
  const portfolioCostEth = holdings.reduce((s, h) => s + h.costEth, 0);
  const buyCount = walletTrades.filter((t) => t.isBuy).length;
  const sellCount = walletTrades.filter((t) => !t.isBuy).length;
  const volumeTradedEth = walletTrades.reduce((s, t) => s + t.ethAmount, 0);
  const feesPaidEth = walletTrades.reduce((s, t) => s + (t.feeEth || 0), 0);
  const uniqueTokensTraded = new Set(
    walletTrades.map((t) => t.tokenAddress.toLowerCase())
  ).size;

  const timestamps = [
    ...created.map((t) => t.createdAt.getTime()),
    ...walletTrades.map((t) => new Date(t.timestamp).getTime()),
  ].filter((n) => Number.isFinite(n) && n > 0);

  return {
    address: wallet,
    created,
    holdings,
    recentTrades,
    stats: {
      coinsCreated: created.length,
      graduatedCreated: created.filter((t) => t.graduated).length,
      totalCreatedVolumeEth: volumeOnCreated,
      totalCreatedMcapEth: created.reduce((s, t) => s + t.marketCap, 0),
      holdingsCount: holdings.length,
      portfolioValueEth,
      portfolioCostEth,
      portfolioPnlPct:
        portfolioCostEth > 0
          ? ((portfolioValueEth - portfolioCostEth) / portfolioCostEth) * 100
          : 0,
      tradeCount: walletTrades.length,
      buyCount,
      sellCount,
      volumeTradedEth,
      uniqueTokensTraded,
      feesPaidEth,
      estimatedCreatorFeesEth,
      firstSeenAt:
        timestamps.length > 0
          ? new Date(Math.min(...timestamps)).toISOString()
          : null,
      lastActiveAt:
        timestamps.length > 0
          ? new Date(Math.max(...timestamps)).toISOString()
          : null,
    },
  };
}

/** Count EOA holders (excludes bonding curve). */
export function countTokenHolders(
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
    net.set(key, (net.get(key) ?? 0) + (t.isBuy ? t.tokenAmount : -t.tokenAmount));
  }
  let n = 0;
  for (const bal of net.values()) {
    if (bal > 1e-9) n++;
  }
  return n;
}

export function athMarketCapFromTrades(
  trades: TradeRecord[],
  tokenAddress: string,
  supply: number,
  currentMcap: number,
  storedAth?: number
): number {
  let ath = Math.max(currentMcap, storedAth ?? 0);
  for (const t of trades) {
    if (t.tokenAddress.toLowerCase() !== tokenAddress.toLowerCase()) continue;
    if (t.price > 0) ath = Math.max(ath, t.price * supply);
  }
  // Launch FDV floor
  const start =
    (1.3 / 1_073_000_000) * (supply || DEFAULT_SUPPLY);
  return Math.max(ath, start, currentMcap);
}
