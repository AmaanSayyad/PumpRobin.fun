#!/usr/bin/env node
// ponytail: one runnable check that fails if the curve stops matching the
// reference launchpad. Mirrors BondingCurve._calculateBuyReturn exactly.
import assert from "node:assert/strict";

const VE = 1_287_878_787_878_787_878n;
const VT = 1_043_787_878_787_878_787_878_787_879n;
const THRESHOLD = 5_000_000_000_000_000_000n;
const SUPPLY = 1_000_000_000n * 10n ** 18n;
const FEE_BPS = 200n;
const E18 = 10n ** 18n;

/** virtual x*y=k, integer maths identical to the contract */
function buyReturn(vE, vT, ethIn) {
  return vT - (vE * vT) / (vE + ethIn);
}

// --- single 5 ETH buy lands exactly on the 830M / 170M split ----------------
const soldOneShot = buyReturn(VE, VT, THRESHOLD);
assert.equal(
  soldOneShot / E18,
  830_000_000n,
  `one-shot sold ${soldOneShot / E18}, expected 830000000`
);

// --- many small buys must not drift the split -------------------------------
let vE = VE;
let vT = VT;
let raised = 0n;
let sold = 0n;
const step = THRESHOLD / 500n;
while (raised < THRESHOLD) {
  const out = buyReturn(vE, vT, step);
  vE += step;
  vT -= out;
  raised += step;
  sold += out;
}
assert.equal(sold / E18, 830_000_000n, `incremental sold ${sold / E18}`);

// `sold` lands a fraction over 830M, so the LP remainder floors to 169,999,999
// whole tokens. Anything beyond a 1-token rounding artifact is a real drift.
const lpTokens = SUPPLY - sold;
const lpDrift = 170_000_000n - lpTokens / E18;
assert.ok(lpDrift >= 0n && lpDrift <= 1n, `LP tokens ${lpTokens / E18}`);

// --- launch price / FDV ------------------------------------------------------
const startPrice = Number(VE) / Number(VT); // ETH per token
const startFdvEth = startPrice * 1e9;
assert.ok(
  Math.abs(startFdvEth - 1.2339) < 0.001,
  `start FDV ${startFdvEth} ETH, expected ~1.2339`
);

// --- gross ETH a buyer must send to graduate (2% goes to fees) --------------
const grossToGraduate = (THRESHOLD * 10_000n) / (10_000n - FEE_BPS);

console.log("curve matches reference launchpad");
console.log("  start price      ", startPrice.toExponential(6), "ETH/token");
console.log("  start FDV        ", startFdvEth.toFixed(4), "ETH");
console.log("  sold on curve    ", (sold / E18).toLocaleString(), "tokens");
console.log("  migrated to LP   ", (lpTokens / E18).toLocaleString(), "tokens");
console.log("  graduation raise ", Number(THRESHOLD) / 1e18, "ETH net");
console.log("  gross volume     ", (Number(grossToGraduate) / 1e18).toFixed(4), "ETH");
console.log(
  "  graduation FDV   ",
  ((Number(vE) / Number(vT)) * 1e9).toFixed(4),
  "ETH"
);
