#!/usr/bin/env node
/**
 * Graduates one throwaway coin on Robinhood mainnet and proves the v4 hook
 * charges 2% to a router the platform does not control — the claim the whole
 * fee architecture rests on, and the one thing the curve-only smoke test
 * cannot show.
 *
 *   node scripts/mainnet-graduate.mjs
 *
 * Costs the graduation raise (locked in the pool forever) plus gas.
 */
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  parseEther,
  formatEther,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://rpc.mainnet.chain.robinhood.com";
const WETH = getAddress("0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73");
const POOL_MANAGER = getAddress("0x8366a39CC670B4001A1121B8F6A443A643e40951");
const FACTORY = getAddress(
  process.env.FACTORY || "0x87c31359ebf163ec59f2ff0be8daaa7af400dc34"
);
const HOOK = getAddress(
  process.env.HOOK || "0x9989f1B13F30721ADA7aB769d4231F8D4809aECC"
);
const THRESHOLD = parseEther(process.env.THRESHOLD || "0.0005");

const chain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const key = fs
  .readFileSync(".env", "utf8")
  .match(/^DEPLOYER_PRIVATE_KEY=(.+)$/m)[1]
  .trim();
const account = privateKeyToAccount(key);
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ account, chain, transport: http(RPC) });

const artifact = (n) =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "out", `${n}.json`), "utf8"));

const factory = { address: FACTORY, abi: artifact("PumpRobinFactory").abi };
const hook = { address: HOOK, abi: artifact("PumpRobinHook").abi };
const weth = { address: WETH, abi: artifact("WETH9").abi };

const read = (c, fn, args = []) =>
  pub.readContract({ address: c.address, abi: c.abi, functionName: fn, args });

let gasSpent = 0n;
async function send(c, fn, args = [], value = 0n) {
  const estimate = await pub.estimateContractGas({
    address: c.address,
    abi: c.abi,
    functionName: fn,
    args,
    account,
    value,
  });
  const hash = await wallet.writeContract({
    address: c.address,
    abi: c.abi,
    functionName: fn,
    args,
    value,
    gas: (estimate * 15n) / 10n,
  });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${fn} reverted (${hash})`);
  gasSpent += r.gasUsed * r.effectiveGasPrice;
  return r;
}
async function deploy(name, args = []) {
  const a = artifact(name);
  const hash = await wallet.deployContract({ abi: a.abi, bytecode: a.bytecode, args });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${name} deploy reverted`);
  gasSpent += r.gasUsed * r.effectiveGasPrice;
  return { address: r.contractAddress, abi: a.abi };
}

const ok = [];
function check(label, condition, detail = "") {
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
  if (!condition) throw new Error(`failed: ${label}`);
  ok.push(label);
}

const startBalance = await pub.getBalance({ address: account.address });
console.log(`\nbalance    ${formatEther(startBalance)} ETH`);
console.log(`threshold  ${formatEther(THRESHOLD)} ETH\n`);

// --- launch ------------------------------------------------------------------
console.log("== launch ==");
const originalFee = await read(factory, "creationFee");
const originalThreshold = await read(factory, "graduationThreshold");
if (originalFee > 0n) await send(factory, "setCreationFee", [0n]);
await send(factory, "setGraduationThreshold", [THRESHOLD]);

await send(factory, "createToken", [
  "Test Six",
  "TEST6",
  "https://ipfs.io/ipfs/QmTestImagePlaceholderCid00000000000001",
  "test",
  "https://ipfs.io/ipfs/QmTestMetadataPlaceholderCid0000000001",
  false,
  false,
  [],
  [],
]);
const n = await read(factory, "tokenCount");
const tokenAddress = await read(factory, "allTokens", [n - 1n]);
const curve = {
  address: await read(factory, "tokenToCurve", [tokenAddress]),
  abi: artifact("BondingCurve").abi,
};
const token = { address: tokenAddress, abi: artifact("PumpRobinToken").abi };
console.log(`  token ${tokenAddress}`);
console.log(`  curve ${curve.address}`);

// --- graduate ----------------------------------------------------------------
console.log("\n== graduate ==");
// Send double; the curve fills to the threshold and refunds the rest.
await send(curve, "buy", [0n], THRESHOLD * 2n);

check("curve graduated", (await read(curve, "graduated")) === true);
const liquidity = await read(curve, "poolLiquidity");
check("v4 position minted", liquidity > 0n, liquidity.toString());

const poolId = await read(curve, "poolId");
console.log(`  poolId ${poolId}`);

const pooled = await read(token, "balanceOf", [POOL_MANAGER]);
check("tokens moved into the pool", pooled > 0n, (Number(pooled) / 1e18).toLocaleString());
// The PoolManager is shared, so its WETH balance covers every pool on the
// chain — the raise leaving our curve is the honest measure.
check(
  "the raise left the curve for the pool",
  (await pub.getBalance({ address: curve.address })) < THRESHOLD / 10n,
  formatEther(await pub.getBalance({ address: curve.address })) + " ETH left behind"
);

// --- an independent router ---------------------------------------------------
console.log("\n== swap through a router the platform does not control ==");
const router = await deploy("TestSwapRouter", [POOL_MANAGER]);
console.log(`  router ${router.address}`);

const key0 = await read(curve, "poolKey");
const poolKey = {
  currency0: key0[0],
  currency1: key0[1],
  fee: key0[2],
  tickSpacing: key0[3],
  hooks: key0[4],
};
const wethIs0 = getAddress(poolKey.currency0) === WETH;

const SWAP_IN = THRESHOLD / 10n;
await send(weth, "deposit", [], SWAP_IN * 2n);
await send(weth, "approve", [router.address, SWAP_IN * 4n]);
await send(token, "approve", [router.address, 2n ** 200n]);

// --- buy leg -----------------------------------------------------------------
const cBefore = await read(hook, "pendingCreatorFees", [tokenAddress]);
const pBefore = await read(hook, "pendingPlatformFees", [tokenAddress]);
await send(router, "swap", [poolKey, wethIs0, SWAP_IN]);
const buyCreator = (await read(hook, "pendingCreatorFees", [tokenAddress])) - cBefore;
const buyPlatform = (await read(hook, "pendingPlatformFees", [tokenAddress])) - pBefore;

check(
  "BUY pays the creator exactly 1%",
  buyCreator === SWAP_IN / 100n,
  formatEther(buyCreator) + " ETH of " + formatEther(SWAP_IN)
);
check(
  "BUY pays the platform exactly 1%",
  buyPlatform === SWAP_IN / 100n,
  formatEther(buyPlatform) + " ETH"
);

// --- sell leg ----------------------------------------------------------------
const held = await read(token, "balanceOf", [account.address]);
const toSell = held / 4n;
const cBefore2 = await read(hook, "pendingCreatorFees", [tokenAddress]);
const pBefore2 = await read(hook, "pendingPlatformFees", [tokenAddress]);
const wethBefore = await read(weth, "balanceOf", [account.address]);
await send(router, "swap", [poolKey, !wethIs0, toSell]);
const wethOut = (await read(weth, "balanceOf", [account.address])) - wethBefore;
const sellCreator = (await read(hook, "pendingCreatorFees", [tokenAddress])) - cBefore2;
const sellPlatform = (await read(hook, "pendingPlatformFees", [tokenAddress])) - pBefore2;
const sellFee = sellCreator + sellPlatform;
const sellGross = wethOut + sellFee;
const sellPct = Number((sellFee * 10_000n) / sellGross) / 100;

check("SELL is taxed too", sellFee > 0n, formatEther(sellFee) + " ETH");
check("SELL fee is 2% of the ETH leg", sellPct >= 1.98 && sellPct <= 2.02, sellPct + "%");
check("SELL splits evenly", sellCreator === sellFee / 2n || sellCreator === sellFee / 2n + 1n);

// --- liquidity really is locked ---------------------------------------------
console.log("\n== liquidity lock ==");
let removeBlocked = false;
try {
  await pub.simulateContract({
    address: HOOK,
    abi: hook.abi,
    functionName: "beforeRemoveLiquidity",
    args: [
      account.address,
      poolKey,
      { tickLower: -887220, tickUpper: 887220, liquidityDelta: -1n, salt: `0x${"0".repeat(64)}` },
      "0x",
    ],
    account,
  });
} catch {
  removeBlocked = true;
}
check("the hook refuses every liquidity removal", removeBlocked);

// --- creator can take the pool fees ------------------------------------------
console.log("\n== creator claim from the pool ==");
const owed = await read(hook, "pendingCreatorFees", [tokenAddress]);
const before = await pub.getBalance({ address: account.address });
const r = await send(hook, "claimCreatorFees", [tokenAddress]);
const after = await pub.getBalance({ address: account.address });
check(
  "creator receives the hook's ETH",
  after - before + r.gasUsed * r.effectiveGasPrice === owed,
  formatEther(owed) + " ETH"
);

// --- restore -----------------------------------------------------------------
console.log("\n== restore ==");
await send(factory, "setGraduationThreshold", [originalThreshold]);
await send(factory, "setCreationFee", [originalFee]);
check("threshold restored", (await read(factory, "graduationThreshold")) === originalThreshold);
check("creation fee restored", (await read(factory, "creationFee")) === originalFee);

// --- indexers ----------------------------------------------------------------
console.log("\n== indexers ==");
console.log("  (they poll on their own schedule — may take a few minutes)");
try {
  const res = await fetch(
    `https://api.dexscreener.com/token-pairs/v1/robinhood/${tokenAddress}`
  );
  const pairs = await res.json();
  if (Array.isArray(pairs) && pairs.length) {
    for (const p of pairs) {
      console.log(
        `  DexScreener: ${p.labels?.join("/") || "-"} liq=$${p.liquidity?.usd ?? "?"} url=${p.url}`
      );
    }
  } else {
    console.log("  DexScreener: not indexed yet");
  }
} catch (e) {
  console.log("  DexScreener check failed:", e.message.slice(0, 60));
}

const endBalance = await pub.getBalance({ address: account.address });
let px = 1906;
try {
  const j = await (await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot")).json();
  px = Number(j.data.amount);
} catch {
  /* fall back */
}
const usd = (eth) => `$${(Number(eth) * px).toFixed(3)}`;

console.log(`\n== ${ok.length} checks passed on mainnet ==\n`);
console.log(`  token          ${tokenAddress}`);
console.log(`  poolId         ${poolId}`);
console.log(`  gas            ${formatEther(gasSpent)} ETH  ${usd(formatEther(gasSpent))}`);
console.log(
  `  total spent    ${formatEther(startBalance - endBalance)} ETH  ${usd(formatEther(startBalance - endBalance))}`
);
console.log(`  balance left   ${formatEther(endBalance)} ETH  ${usd(formatEther(endBalance))}\n`);
