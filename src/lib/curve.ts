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
 * How `seedAndGraduate` splits ETH: half LP / half buy, LP floored at min seed.
 * Matches BondingCurve.sol.
 */
export function splitLaunchSeed(seedEth: number): {
  lpEth: number;
  buyEth: number;
} {
  const minSeed = Number(CHAIN_CONFIG.minSeedLiquidityEth);
  if (!Number.isFinite(seedEth) || seedEth <= 0) {
    return { lpEth: 0, buyEth: 0 };
  }
  let buyEth = seedEth / 2;
  let lpEth = seedEth - buyEth;
  if (lpEth < minSeed) {
    lpEth = minSeed;
    buyEth = Math.max(0, seedEth - lpEth);
  }
  return { lpEth, buyEth };
}

/**
 * Seed ETH (excludes creation fee) for ~`pct`% of supply via the Uniswap
 * creator buy. Pool is seeded with ~full supply + LP ETH, so
 * ownership ≈ buyEth / (lpEth + buyEth). Cap is ~50% (half/half split).
 */
export function ethInForSupplyPercent(pct: number, _supply = DEFAULT_SUPPLY): number {
  const minSeed = Number(CHAIN_CONFIG.minSeedLiquidityEth);
  if (!Number.isFinite(pct) || pct <= 0) {
    // Slightly above min seed — contract requires seed > MIN_SEED when LP is floored
    return minSeed * 1.001;
  }
  if (pct >= 50) {
    // Exact half/half at 2× min seed → ~50% of supply
    return minSeed * 2;
  }
  const p = pct / 100;
  // LP floored at minSeed: buy = minSeed * p / (1-p), seed = minSeed / (1-p)
  return minSeed / (1 - p);
}

/**
 * Estimated % of total supply from a launch seed amount (Uniswap creator buy).
 */
export function supplyPercentForEthIn(
  seedEth: number,
  _supply = DEFAULT_SUPPLY
): number {
  const { lpEth, buyEth } = splitLaunchSeed(seedEth);
  const denom = lpEth + buyEth;
  if (denom <= 0 || buyEth <= 0) return 0;
  return Math.min(50, (buyEth / denom) * 100);
}

/**
 * Min ETH in wallet: creation fee + seed (≥ min liquidity) + gas (+ feature).
 * `initialBuyEth` is the seed amount sent with createToken (LP + creator buy).
 */
export function minEthToLaunch(initialBuyEth = 0, featureBoost = false): number {
  const creation = Number(CHAIN_CONFIG.creationFee);
  const minSeed = Number(CHAIN_CONFIG.minSeedLiquidityEth) * 1.001;
  const buffer = Number(CHAIN_CONFIG.launchGasBufferEth);
  const feature = featureBoost ? Number(CHAIN_CONFIG.featureBoostEth) : 0;
  const seed = Math.max(minSeed, Number.isFinite(initialBuyEth) ? initialBuyEth : 0);
  return creation + seed + buffer + feature;
}

/** Seed wei to attach to createToken (never below min Uniswap liquidity). */
export function launchSeedEth(initialBuyEth = 0): number {
  const minSeed = Number(CHAIN_CONFIG.minSeedLiquidityEth) * 1.001;
  const n = Number.isFinite(initialBuyEth) ? initialBuyEth : 0;
  return Math.max(minSeed, n);
}
