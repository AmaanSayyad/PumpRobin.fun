import { CHAIN_CONFIG } from "./chain";

/** Matches PumpRobinFactory / BondingCurve virtual reserve init (1B default supply).
 *  Calibrated to bags.fm Robinhood (~1.3 ETH virtual → ~$2.3k start FDV). */
export const INITIAL_VIRTUAL_ETH = 1.3;
export const INITIAL_VIRTUAL_TOKENS = 1_073_000_000;
export const DEFAULT_SUPPLY = 1_000_000_000;

function supplyRatio(supply: number): number {
  return Math.max(1, supply) / DEFAULT_SUPPLY;
}

/**
 * Scale virtual ETH with custom supply so unit price stays calibrated
 * and starting market cap moves with supply (100M ≈ 1/10 of 1B FDV).
 */
export function virtualEthForSupply(supply: number): number {
  return INITIAL_VIRTUAL_ETH * supplyRatio(supply);
}

/** Scale curve token reserves with custom supply. */
export function virtualTokensForSupply(supply: number): number {
  return INITIAL_VIRTUAL_TOKENS * supplyRatio(supply);
}

/** Initial ETH price per token — constant across supplies (both reserves scale). */
export function initialTokenPriceEth(_supply = DEFAULT_SUPPLY): number {
  return INITIAL_VIRTUAL_ETH / INITIAL_VIRTUAL_TOKENS;
}

/** Market cap in ETH at a given per-token ETH price */
export function marketCapEth(priceEth: number, supply = DEFAULT_SUPPLY): number {
  return priceEth * supply;
}

/** Graduation mcap after raising `graduationEth` on the scaled curve */
export function graduationMarketCapEth(
  supply = DEFAULT_SUPPLY,
  graduationEth = CHAIN_CONFIG.graduationThreshold
): number {
  const ve0 = virtualEthForSupply(supply);
  const vt0 = virtualTokensForSupply(supply);
  const k = ve0 * vt0;
  const newVirtualEth = ve0 + graduationEth;
  const newVirtualTokens = k / newVirtualEth;
  const price = newVirtualEth / newVirtualTokens;
  return price * supply;
}

export function formatSupplyShort(supply: number): string {
  if (supply >= 1e15) return `${(supply / 1e15).toFixed(supply % 1e15 === 0 ? 0 : 1)}Q`;
  if (supply >= 1e12) return `${(supply / 1e12).toFixed(supply % 1e12 === 0 ? 0 : 1)}T`;
  if (supply >= 1e9) return `${(supply / 1e9).toFixed(supply % 1e9 === 0 ? 0 : 1)}B`;
  if (supply >= 1e6) return `${(supply / 1e6).toFixed(supply % 1e6 === 0 ? 0 : 1)}M`;
  if (supply >= 1e3) return `${(supply / 1e3).toFixed(supply % 1e3 === 0 ? 0 : 1)}K`;
  return String(supply);
}

export function progressFromReserves(realEthReserves: number): number {
  const pct = (realEthReserves / CHAIN_CONFIG.graduationThreshold) * 100;
  return Math.min(100, Math.max(0, pct));
}

/** Buy return with constant-product: tokens out for ethIn (post-fee eth) */
export function calculateBuyReturn(
  ethAfterFee: number,
  virtualEth: number,
  virtualTokens: number
): { tokensOut: number; newVirtualEth: number; newVirtualTokens: number } {
  const k = virtualEth * virtualTokens;
  const newVirtualEth = virtualEth + ethAfterFee;
  const newVirtualTokens = k / newVirtualEth;
  const tokensOut = virtualTokens - newVirtualTokens;
  return { tokensOut, newVirtualEth, newVirtualTokens };
}

/** Sell return: eth out for tokenAmount in */
export function calculateSellReturn(
  tokenAmount: number,
  virtualEth: number,
  virtualTokens: number
): { ethOut: number; newVirtualEth: number; newVirtualTokens: number } {
  const k = virtualEth * virtualTokens;
  const newVirtualTokens = virtualTokens + tokenAmount;
  const newVirtualEth = k / newVirtualTokens;
  const ethOut = virtualEth - newVirtualEth;
  return { ethOut, newVirtualEth, newVirtualTokens };
}

export function applyFee(ethAmount: number, feeBps = CHAIN_CONFIG.tradeFeeBps) {
  const fee = (ethAmount * feeBps) / 10_000;
  return { fee, afterFee: ethAmount - fee };
}

/**
 * ETH the buyer must send (pre-fee) to receive `tokenAmount` from the curve.
 * Inverse of constant-product buy with trade fee applied to input.
 */
export function ethInForTokenAmount(
  tokenAmount: number,
  virtualEth: number,
  virtualTokens: number,
  feeBps = CHAIN_CONFIG.tradeFeeBps
): number {
  if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) return 0;
  if (tokenAmount >= virtualTokens) return Number.POSITIVE_INFINITY;
  const ethAfterFee = (tokenAmount * virtualEth) / (virtualTokens - tokenAmount);
  const denom = 1 - feeBps / 10_000;
  if (denom <= 0) return Number.POSITIVE_INFINITY;
  return ethAfterFee / denom;
}

/** ETH to buy `pct`% of total supply at launch (includes trade fee). */
export function ethInForSupplyPercent(pct: number, supply = DEFAULT_SUPPLY): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  const tokens = (Math.max(1, supply) * pct) / 100;
  return ethInForTokenAmount(
    tokens,
    virtualEthForSupply(supply),
    virtualTokensForSupply(supply)
  );
}

/**
 * Exact % of total supply received for a given ETH buy at launch
 * (mirrors BondingCurve.buy: fee taken from input, then x·y=k).
 */
export function supplyPercentForEthIn(ethIn: number, supply = DEFAULT_SUPPLY): number {
  if (!Number.isFinite(ethIn) || ethIn <= 0) return 0;
  const { afterFee } = applyFee(ethIn);
  const { tokensOut } = calculateBuyReturn(
    afterFee,
    virtualEthForSupply(supply),
    virtualTokensForSupply(supply)
  );
  return (tokensOut / Math.max(1, supply)) * 100;
}

/** Min ETH needed in wallet to cover creation fee + optional first buy + gas buffer. */
export function minEthToLaunch(initialBuyEth = 0): number {
  const creation = Number(CHAIN_CONFIG.creationFee);
  const buffer = Number(CHAIN_CONFIG.launchGasBufferEth);
  return creation + Math.max(0, initialBuyEth) + buffer;
}
