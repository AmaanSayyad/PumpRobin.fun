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
 * ETH to send (incl. 1.3% fee) to receive ~`pct`% of total supply on the bonding curve.
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
 * Min ETH in wallet: creation fee + LP seed + gas (+ feature).
 * All launches seed Uniswap immediately (min seed applies).
 */
export function minEthToLaunch(
  initialBuyEth = 0,
  featureBoost = false
): number {
  const creation = Number(CHAIN_CONFIG.creationFee);
  const buffer = Number(CHAIN_CONFIG.launchGasBufferEth);
  const feature = featureBoost ? Number(CHAIN_CONFIG.featureBoostEth) : 0;
  const buy = Math.max(0, Number.isFinite(initialBuyEth) ? initialBuyEth : 0);
  const seed = Math.max(minInstantSeedEth(), buy);
  return creation + seed + buffer + feature;
}

/** ETH attached above creation fee for the optional creator buy on the curve. */
export function launchBuyEth(initialBuyEth = 0): number {
  const n = Number.isFinite(initialBuyEth) ? initialBuyEth : 0;
  return Math.max(0, n);
}

/** @deprecated Use launchBuyEth — kept for older imports */
export function launchSeedEth(initialBuyEth = 0): number {
  return launchBuyEth(initialBuyEth);
}

/** How instant launch splits seed ETH (matches BondingCurve.sol). */
export function splitInstantSeed(seedEth: number): {
  lpEth: number;
  buyEth: number;
} {
  if (!Number.isFinite(seedEth) || seedEth <= 0) {
    return { lpEth: 0, buyEth: 0 };
  }
  const lpPct = CHAIN_CONFIG.instantLpEthPct / 100;
  const lpEth = seedEth * lpPct;
  const buyEth = seedEth - lpEth;
  return { lpEth, buyEth };
}

/** LP supply bps for a given LP ETH amount — matches `_lpSupplyBpsForLpEth`. */
export function lpSupplyBpsForLpEth(lpEth: number): number {
  if (!Number.isFinite(lpEth) || lpEth <= 0) {
    return CHAIN_CONFIG.instantMinLpSupplyBps;
  }
  const target = Number(CHAIN_CONFIG.instantTargetFdvEth);
  let bps = (lpEth * 10_000) / target;
  bps = Math.max(
    CHAIN_CONFIG.instantMinLpSupplyBps,
    Math.min(CHAIN_CONFIG.instantMaxLpSupplyBps, bps)
  );
  return bps;
}

/** Estimated starting FDV in ETH for an instant launch seed. */
export function estimatedInstantFdvEth(seedEth: number): number {
  const { lpEth } = splitInstantSeed(seedEth);
  const bps = lpSupplyBpsForLpEth(lpEth);
  if (bps <= 0) return 0;
  return (lpEth * 10_000) / bps;
}

/** % of total supply that enters the Uniswap pool at launch. */
export function instantLpSupplyPct(seedEth: number): number {
  const { lpEth } = splitInstantSeed(seedEth);
  return lpSupplyBpsForLpEth(lpEth) / 100;
}

/** Min seed ETH (excl. creation fee) for instant Uniswap launch. */
export function minInstantSeedEth(): number {
  return Number(CHAIN_CONFIG.minInstantSeedEth);
}

/** Seed ETH for instant launch — never below min instant liquidity. */
export function launchInstantSeedEth(initialBuyEth = 0): number {
  const minSeed = minInstantSeedEth();
  const n = Number.isFinite(initialBuyEth) ? initialBuyEth : 0;
  return Math.max(minSeed, n);
}

/** Creator's share of the pool after the instant Uniswap buy (~30% of seed). */
function instantBuyShareOfLp(): number {
  const lpFrac = CHAIN_CONFIG.instantLpEthPct / 100;
  const buyFrac = 1 - lpFrac;
  const denom = lpFrac + buyFrac;
  return denom > 0 ? buyFrac / denom : 0;
}

/** Max % of total supply a creator buy can receive (hits max LP bps). */
export function maxInstantOwnershipPct(): number {
  return (CHAIN_CONFIG.instantMaxLpSupplyBps / 100) * instantBuyShareOfLp();
}

/**
 * Instant launch: % of total supply the creator buy receives (of full 1B).
 * Uses constant-product: tokensOut ≈ lpTokens * buyEth / (lpEth + buyEth).
 */
export function supplyPercentForInstantSeed(
  seedEth: number,
  _supply = DEFAULT_SUPPLY
): number {
  const { lpEth, buyEth } = splitInstantSeed(seedEth);
  if (buyEth <= 0 || lpEth <= 0) return 0;
  const bps = lpSupplyBpsForLpEth(lpEth);
  const boughtOfLp = buyEth / (lpEth + buyEth);
  return Math.min(100, (bps / 100) * boughtOfLp);
}

export function ethInForInstantSupplyPercent(
  pct: number,
  _supply = DEFAULT_SUPPLY
): number {
  const minSeed = minInstantSeedEth();
  if (!Number.isFinite(pct) || pct <= 0) return minSeed;

  const buyShare = instantBuyShareOfLp();
  const maxPct = maxInstantOwnershipPct();
  if (buyShare <= 0 || maxPct <= 0) return minSeed;

  const target = Math.min(pct, maxPct);
  const targetBps = (target / buyShare) * 100;
  const lpFrac = CHAIN_CONFIG.instantLpEthPct / 100;
  const targetFdv = Number(CHAIN_CONFIG.instantTargetFdvEth);
  if (lpFrac <= 0 || targetFdv <= 0) return minSeed;

  // bps = (seed * lpFrac * 10_000) / targetFdv  →  seed = bps * targetFdv / (lpFrac * 10_000)
  const seed = (targetBps * targetFdv) / (lpFrac * 10_000);
  return Math.max(minSeed, seed);
}

/** Approx Uniswap V3 full-range swap (constant product + pool fee). */
export function quotePoolSwap(opts: {
  isBuy: boolean;
  amountIn: number;
  pooledWeth: number;
  pooledToken: number;
  poolFeeBps?: number;
}): number {
  const { isBuy, amountIn, pooledWeth, pooledToken } = opts;
  if (amountIn <= 0 || pooledWeth <= 0 || pooledToken <= 0) return 0;
  const fee = 1 - (opts.poolFeeBps ?? 100) / 10_000;
  const xin = amountIn * fee;
  if (isBuy) return (pooledToken * xin) / (pooledWeth + xin);
  return (pooledWeth * xin) / (pooledToken + xin);
}

/** @deprecated Instant Uniswap seed removed — bonding curve only until graduation */
export function splitLaunchSeed(seedEth: number): {
  lpEth: number;
  buyEth: number;
} {
  return { lpEth: 0, buyEth: seedEth };
}
