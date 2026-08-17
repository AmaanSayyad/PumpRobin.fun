#!/usr/bin/env node
/**
 * Verifies the deployed contracts on Robinhood mainnet without graduating a
 * coin. Everything here is read back off-chain after the fact — nothing is
 * asserted from what the script intended to do.
 *
 *   FACTORY=0x... node scripts/mainnet-smoke.mjs
 *
 * Deliberately does NOT cover: the hook charging external routers, and
 * DEX Screener / GMGN indexing. Both need a graduated pool.
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
const FACTORY = getAddress(
  process.env.FACTORY || "0x87c31359ebf163ec59f2ff0be8daaa7af400dc34"
);
const HOOK = getAddress(
  process.env.HOOK || "0x9989f1B13F30721ADA7aB769d4231F8D4809aECC"
);
const FEE_COLLECTOR = getAddress("0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9");

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
const CURVE_ABI = artifact("BondingCurve").abi;
const TOKEN_ABI = artifact("PumpRobinToken").abi;
const SHARE_ABI = artifact("PumpRobinFeeShare").abi;

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

const ok = [];
function check(label, condition, detail = "") {
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
  if (!condition) throw new Error(`failed: ${label}`);
  ok.push(label);
}

const startBalance = await pub.getBalance({ address: account.address });
const collectorStart = await pub.getBalance({ address: FEE_COLLECTOR });

console.log(`\nfactory  ${FACTORY}`);
console.log(`hook     ${HOOK}`);
console.log(`balance  ${formatEther(startBalance)} ETH\n`);

// --- launches are free while we test ----------------------------------------
console.log("== setup ==");
const originalFee = await read(factory, "creationFee");
if (originalFee > 0n) await send(factory, "setCreationFee", [0n]);
check("creation fee zeroed for testing", (await read(factory, "creationFee")) === 0n);

async function launch(name, symbol, antiSnipe, maxWallet, recipients = [], bps = []) {
  // Neutral placeholder metadata — these coins are throwaway and should not
  // carry the brand around on-chain.
  await send(factory, "createToken", [
    name,
    symbol,
    "https://ipfs.io/ipfs/QmTestImagePlaceholderCid00000000000001",
    "test",
    "https://ipfs.io/ipfs/QmTestMetadataPlaceholderCid0000000001",
    antiSnipe,
    maxWallet,
    recipients,
    bps,
  ]);
  const n = await read(factory, "tokenCount");
  const address = await read(factory, "allTokens", [n - 1n]);
  return {
    token: { address, abi: TOKEN_ABI },
    curve: { address: await read(factory, "tokenToCurve", [address]), abi: CURVE_ABI },
    feeShare: await read(factory, "tokenToFeeShare", [address]),
  };
}

// --- coin A: the ordinary path ----------------------------------------------
console.log("\n== launch ==");
const a = await launch("Test", "TEST", false, false);
console.log(`  token ${a.token.address}`);
console.log(`  curve ${a.curve.address}`);

check(
  "image URI stored on-chain",
  (await read(a.token, "imageUri")).startsWith("https://ipfs.io/ipfs/"),
  await read(a.token, "imageUri")
);
check(
  "metadata URI stored on-chain",
  (await read(a.token, "metadataURI")).startsWith("https://ipfs.io/ipfs/")
);
check("token reports no transfer tax", (await read(a.token, "hasTransferTax")) === false);
check("token has no owner", (await read(a.token, "owner")) === "0x0000000000000000000000000000000000000000");
check(
  "whole supply sits on the curve",
  (await read(a.token, "balanceOf", [a.curve.address])) === parseEther("1000000000")
);
check(
  "curve carries the reference reserves",
  (await read(a.curve, "virtualEthReserves")) === 1287878787878787878n &&
    (await read(a.curve, "virtualTokenReserves")) === 1043787878787878787878787879n
);
check(
  "graduation threshold is 5 ETH",
  (await read(a.curve, "graduationThreshold")) === parseEther("5")
);

// --- buy: 1% creator + 1% platform ------------------------------------------
console.log("\n== curve buy ==");
const BUY = parseEther("0.0002");
await send(a.curve, "buy", [0n], BUY);

const [cPend, pPend] = await read(a.curve, "getPendingFees");
check("buy charges the creator exactly 1%", cPend === BUY / 100n, formatEther(cPend) + " ETH");
check("buy charges the platform exactly 1%", pPend === BUY / 100n, formatEther(pPend) + " ETH");

const heldA = await read(a.token, "balanceOf", [account.address]);
check("buyer received tokens", heldA > 0n, (Number(heldA) / 1e18).toLocaleString());

// --- transfers are untaxed --------------------------------------------------
console.log("\n== plain ERC-20 ==");
const probe = "0x000000000000000000000000000000000000dEaD";
const sendAmount = heldA / 1000n;
const deadBefore = await read(a.token, "balanceOf", [probe]);
await send(a.token, "transfer", [probe, sendAmount]);
check(
  "a transfer moves the exact amount, no tax",
  (await read(a.token, "balanceOf", [probe])) - deadBefore === sendAmount
);

// --- sell: this used to be completely untaxed -------------------------------
console.log("\n== curve sell ==");
const toSell = await read(a.token, "balanceOf", [account.address]);
await send(a.token, "approve", [a.curve.address, toSell]);
const beforeSell = await read(a.curve, "getPendingFees");
await send(a.curve, "sell", [toSell, 0n]);
const afterSell = await read(a.curve, "getPendingFees");

const sellCreator = afterSell[0] - beforeSell[0];
const sellPlatform = afterSell[1] - beforeSell[1];
check("sell is taxed at all", sellCreator + sellPlatform > 0n, formatEther(sellCreator + sellPlatform) + " ETH");
check("sell splits 1% creator / 1% platform", sellCreator === sellPlatform);
check("seller has no tokens left", (await read(a.token, "balanceOf", [account.address])) === 0n);

// --- creator claim -----------------------------------------------------------
console.log("\n== creator claim ==");
const claimable = (await read(a.curve, "getPendingFees"))[0];
const beforeClaim = await pub.getBalance({ address: account.address });
const claimReceipt = await send(a.curve, "claimCreatorFees");
const afterClaim = await pub.getBalance({ address: account.address });
const claimCost = claimReceipt.gasUsed * claimReceipt.effectiveGasPrice;
check(
  "creator receives the accrued ETH",
  afterClaim - beforeClaim + claimCost === claimable,
  formatEther(claimable) + " ETH"
);
check("nothing left to claim", (await read(a.curve, "getPendingFees"))[0] === 0n);

// --- coin B: anti-snipe + max wallet + fee sharing ---------------------------
console.log("\n== anti-snipe, max wallet, fee sharing ==");
const b = await launch("Test Two", "TEST2", true, true, [account.address, FEE_COLLECTOR], [7000, 3000]);
console.log(`  token ${b.token.address}`);

check("anti-snipe window is live", (await read(b.token, "isAntiSnipeActive")) === true);
check("curve quotes the 99% rate", (await read(b.curve, "currentFeeBps")) === 9900n);
check(
  "max wallet is 2% of supply",
  (await read(b.token, "maxWalletAmount")) === parseEther("20000000")
);
check("fee-share splitter deployed", b.feeShare !== "0x0000000000000000000000000000000000000000", b.feeShare);
check(
  "curve routes the creator share to the splitter",
  getAddress(await read(b.curve, "creatorFeeRecipient")) === getAddress(b.feeShare)
);

const SNIPE = parseEther("0.00005");
await send(b.curve, "buy", [0n], SNIPE);
const bFees = await read(b.curve, "getPendingFees");
check("sniper pays 99% to the platform", bFees[1] === (SNIPE * 99n) / 100n, formatEther(bFees[1]) + " ETH");
check("sniper fee does not reach the creator", bFees[0] === 0n);

const share = { address: b.feeShare, abi: SHARE_ABI };
check("splitter holds a 70/30 split", (await read(share, "shareBps", [account.address])) === 7000);

// --- restore -----------------------------------------------------------------
console.log("\n== restore ==");
await send(factory, "setCreationFee", [originalFee]);
check("creation fee restored", (await read(factory, "creationFee")) === originalFee);

// --- cost --------------------------------------------------------------------
const endBalance = await pub.getBalance({ address: account.address });
const collectorEnd = await pub.getBalance({ address: FEE_COLLECTOR });
let px = 1906;
try {
  const j = await (await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot")).json();
  px = Number(j.data.amount);
} catch {
  /* fall back */
}
const usd = (eth) => `$${(Number(eth) * px).toFixed(3)}`;
const spent = startBalance - endBalance;

console.log(`\n== ${ok.length} checks passed on mainnet ==\n`);
console.log(`  gas                ${formatEther(gasSpent)} ETH  ${usd(formatEther(gasSpent))}`);
console.log(`  net wallet change  ${formatEther(spent)} ETH  ${usd(formatEther(spent))}`);
console.log(`  to fee collector   ${formatEther(collectorEnd - collectorStart)} ETH  ${usd(formatEther(collectorEnd - collectorStart))}`);
console.log(`  balance left       ${formatEther(endBalance)} ETH  ${usd(formatEther(endBalance))}\n`);
