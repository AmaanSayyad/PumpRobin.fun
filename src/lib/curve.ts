import { CHAIN_CONFIG } from "./chain";

/**
 * Mirrors BondingCurve.sol. Read off the reference Robinhood launchpad rather
 * than approximated: with these reserves the curve sells exactly 830M of the 1B
 * supply by the 5 ETH graduation threshold, opening at 1.2339 ETH FDV.
 * See scripts/check-curve.mjs.
 */
export const INITIAL_VIRTUAL_ETH = 1.287878787878787878;
export const INITIAL_VIRTUAL_TOKENS = 1_043_787_878.787_878_787_9;
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
 * ETH to send (incl. the 2% trade fee) for ~`pct`% of supply on the curve.
 */
export function ethInForSupplyPercent(pct: number, supply = DEFAULT_SUPPLY): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  const ve0 = virtualEthForSupply(supply);
  const vt0 = virtualTokensForSupply(supply);
  const k = ve0 * vt0;
  const targetTokens = (supply * pct) / 100;
  if (targetTokens >= vt0) return Infinity;

  const newVt = vt0 - targetTokens;
  const ethAfterFee = k / newVt - ve0;
  const feeBps = CHAIN_CONFIG.tradeFeeBps;
  return ethAfterFee / (1 - feeBps / 10_000);
}

/**
 * Estimated % of total supply from a bonding-curve buy amount (incl. fees).
 */
export function supplyPercentForEthIn(
  ethIn: number,
  supply = DEFAULT_SUPPLY
): number {
  if (!Number.isFinite(ethIn) || ethIn <= 0) return 0;
  const { afterFee } = applyFee(ethIn);
  const ve0 = virtualEthForSupply(supply);
  const vt0 = virtualTokensForSupply(supply);
  const { tokensOut } = calculateBuyReturn(afterFee, ve0, vt0);
  return Math.min(100, (tokensOut / supply) * 100);
}

/**
 * Min ETH in wallet: creation fee + gas (+ feature) + any optional first buy.
 * There is no LP seed — the curve carries the whole supply until graduation.
 */
export function minEthToLaunch(
  initialBuyEth = 0,
  featureBoost = false
): number {
  const creation = Number(CHAIN_CONFIG.creationFee);
  const buffer = Number(CHAIN_CONFIG.launchGasBufferEth);
  const feature = featureBoost ? Number(CHAIN_CONFIG.featureBoostEth) : 0;
  return creation + launchBuyEth(initialBuyEth) + buffer + feature;
}

/** ETH attached above creation fee for the optional creator buy on the curve. */
export function launchBuyEth(initialBuyEth = 0): number {
  const n = Number.isFinite(initialBuyEth) ? initialBuyEth : 0;
  return Math.max(0, n);
}

/** % price impact of an ETH buy against pooled WETH, after the 2% hook fee. */
export function uniswapBuyImpactPct(buyEth: number, pooledWeth: number): number {
  if (!(buyEth > 0) || !(pooledWeth > 0)) return 0;
  const xin = buyEth * (1 - CHAIN_CONFIG.tradeFeeBps / 10_000);
  return (xin / (pooledWeth + xin)) * 100;
}

/** Approx full-range v4 swap (constant product + the hook's 2%). */
export function quotePoolSwap(opts: {
  isBuy: boolean;
  amountIn: number;
  pooledWeth: number;
  pooledToken: number;
  poolFeeBps?: number;
}): number {
  const { isBuy, amountIn, pooledWeth, pooledToken } = opts;
  if (amountIn <= 0 || pooledWeth <= 0 || pooledToken <= 0) return 0;
  const fee = 1 - (opts.poolFeeBps ?? 200) / 10_000;
  const xin = amountIn * fee;
  if (isBuy) return (pooledToken * xin) / (pooledWeth + xin);
  return (pooledWeth * xin) / (pooledToken + xin);
}

