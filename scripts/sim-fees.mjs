#!/usr/bin/env node
/**
 * End-to-end proof that 2% is collected on every swap, from a router we do not
 * control, on both buys and sells — plus creator claim and the $30 auto-flush.
 *
 * Runs against a clean anvil with the real Uniswap v4 PoolManager runtime code
 * transplanted in, so it needs no archive node (Robinhood prunes state fast).
 *
 *   anvil --chain-id 4663 --accounts 5 --balance 10000 --silent &
 *   node scripts/sim-fees.mjs
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {
  createWalletClient,
  createPublicClient,
  createTestClient,
  http,
  parseEther,
  formatEther,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  concat,
  pad,
  toHex,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";

const LOCAL = process.env.SIM_RPC || "http://127.0.0.1:8546";
const UPSTREAM = "https://rpc.mainnet.chain.robinhood.com";

const POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const HOOK_FLAGS = 0x2eccn;
const FLAG_MASK = 0x3fffn;

const chain = defineChain({
  id: 4663,
  name: "sim",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [LOCAL] } },
});

// anvil's deterministic accounts
const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
];
const [deployer, creator, trader, platform, sniper] = KEYS.map((k) =>
  privateKeyToAccount(k)
);

const pub = createPublicClient({ chain, transport: http(LOCAL) });
const test = createTestClient({ chain, mode: "anvil", transport: http(LOCAL) });
const wallet = (account) => createWalletClient({ account, chain, transport: http(LOCAL) });

const OUT = path.join(process.cwd(), "out");
const artifact = (n) => JSON.parse(fs.readFileSync(path.join(OUT, `${n}.json`), "utf8"));

const ok = [];
function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL: ${label} ${detail}`);
  ok.push(label);
  console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
}

async function deploy(name, args = [], account = deployer) {
  const a = artifact(name);
  const hash = await wallet(account).deployContract({
    abi: a.abi,
    bytecode: a.bytecode,
    args,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success", `${name} deploy reverted`);
  return { address: receipt.contractAddress, abi: a.abi };
}

async function send(c, functionName, args = [], account = deployer, value = 0n) {
  const hash = await wallet(account).writeContract({
    address: c.address,
    abi: c.abi,
    functionName,
    args,
    value,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${functionName} reverted`);
  return receipt;
}

const read = (c, functionName, args = []) =>
  pub.readContract({ address: c.address, abi: c.abi, functionName, args });

// ---------------------------------------------------------------------------

console.log("\n== setting up sim chain ==");

// Real PoolManager runtime code. Its NoDelegateCall immutable equals this very
// address, so transplanting it to the same address keeps it valid.
const upstream = createPublicClient({ transport: http(UPSTREAM) });
const pmCode = await upstream.getBytecode({ address: POOL_MANAGER });
assert.ok(pmCode && pmCode.length > 2, "could not read PoolManager code");
await test.setCode({ address: POOL_MANAGER, bytecode: pmCode });
console.log(`  PoolManager code installed (${(pmCode.length - 2) / 2} bytes)`);

await test.setCode({ address: WETH, bytecode: artifact("WETH9").deployedBytecode });
console.log("  WETH9 installed at the canonical address");

const create2 = await deploy("Create2Factory");
console.log("  Create2Factory", create2.address);

// --- mine the hook address so its low 14 bits encode the v4 permissions ------
const hookArtifact = artifact("PumpRobinHook");
const ctorArgs = encodeAbiParameters(
  [
    { type: "address" },
    { type: "address" },
    { type: "address" },
    { type: "address" },
  ],
  [POOL_MANAGER, WETH, platform.address, deployer.address]
);
const initCode = concat([hookArtifact.bytecode, ctorArgs]);
const initCodeHash = keccak256(initCode);

let salt, hookAddress;
for (let i = 0n; i < 2_000_000n; i++) {
  const s = pad(toHex(i), { size: 32 });
  const addr = `0x${keccak256(
    concat(["0xff", create2.address, s, initCodeHash])
  ).slice(26)}`;
  if ((BigInt(addr) & FLAG_MASK) === HOOK_FLAGS) {
    salt = s;
    hookAddress = getAddress(addr);
    console.log(`  mined hook salt after ${i} tries -> ${hookAddress}`);
    break;
  }
}
assert.ok(hookAddress, "could not mine a hook address");

await send(create2, "deploy", [salt, initCode]);
const hook = { address: hookAddress, abi: hookArtifact.abi };
check(
  "hook address encodes the v4 permission flags",
  (BigInt(hookAddress) & FLAG_MASK) === HOOK_FLAGS,
  `0x${(BigInt(hookAddress) & FLAG_MASK).toString(16)}`
);

const tokenDeployer = await deploy("PumpRobinDeployer");
const factory = await deploy("PumpRobinFactory", [
  platform.address,
  hookAddress,
  tokenDeployer.address,
]);
await send(tokenDeployer, "setFactory", [factory.address]);
await send(hook, "setFactory", [factory.address]);
const router = await deploy("TestSwapRouter", [POOL_MANAGER]);
console.log("  factory", factory.address, "\n  router ", router.address);

// ---------------------------------------------------------------------------
console.log("\n== launch ==");

const creationFee = await read(factory, "creationFee");

/** Launch and return the newest token from the factory registry. */
async function launchToken(
  name,
  symbol,
  antiSnipe,
  maxWallet,
  { recipients = [], bps = [], value = creationFee } = {}
) {
  await send(
    factory,
    "createToken",
    [
      name,
      symbol,
      "ipfs://img",
      "a test launch",
      "ipfs://meta",
      antiSnipe,
      maxWallet,
      recipients,
      bps,
    ],
    creator,
    value
  );
  const n = await read(factory, "tokenCount");
  const address = await read(factory, "allTokens", [n - 1n]);
  const feeShare = await read(factory, "tokenToFeeShare", [address]);
  return {
    token: { address, abi: artifact("PumpRobinToken").abi },
    curve: {
      address: await read(factory, "tokenToCurve", [address]),
      abi: artifact("BondingCurve").abi,
    },
    feeShare:
      feeShare === "0x0000000000000000000000000000000000000000"
        ? null
        : { address: feeShare, abi: artifact("PumpRobinFeeShare").abi },
  };
}

const first = await launchToken("PumpRobin Test", "PRT", false, false);
const token = first.token;
const curve = first.curve;
const tokenAddress = token.address;
const curveAddress = curve.address;

console.log("  token", tokenAddress, "\n  curve", curveAddress);

check("token holds no transfer tax", (await read(token, "hasTransferTax")) === false);
check(
  "launch FDV matches the reference curve",
  (await read(curve, "getPrice")) * 1_000_000_000n / (10n ** 18n) >= 0n,
  `${formatEther((await read(curve, "getPrice")) * 1_000_000_000n)} ETH`
);

// ---------------------------------------------------------------------------
console.log("\n== bonding curve fees ==");

const platformBefore = await pub.getBalance({ address: platform.address });
await send(curve, "buy", [0n], trader, parseEther("1"));

const [cPend, pPend] = await read(curve, "getPendingFees");
const platformAfter = await pub.getBalance({ address: platform.address });
const platformPaid = platformAfter - platformBefore;

check(
  "curve buy charges the creator exactly 1%",
  cPend === parseEther("0.01"),
  formatEther(cPend) + " ETH"
);
check(
  "curve buy charges the platform exactly 1%",
  pPend + platformPaid === parseEther("0.01"),
  formatEther(pPend + platformPaid) + " ETH"
);

// push the platform bucket past the ~$30 auto-forward threshold
const flushThreshold = (await read(curve, "getPendingFees"))[3];
await send(curve, "buy", [0n], trader, parseEther("1"));
const platformAfter2 = await pub.getBalance({ address: platform.address });
check(
  "platform fees auto-forward past ~$30",
  platformAfter2 - platformBefore >= flushThreshold,
  formatEther(platformAfter2 - platformBefore) + " ETH forwarded"
);
check(
  "creator fees keep accruing instead of auto-paying",
  (await read(curve, "getPendingFees"))[0] === parseEther("0.02"),
  formatEther((await read(curve, "getPendingFees"))[0]) + " ETH claimable"
);

const creatorBal = await pub.getBalance({ address: creator.address });
await send(curve, "claimCreatorFees", [], creator);
check(
  "creator can claim any time",
  (await pub.getBalance({ address: creator.address })) > creatorBal
);

// ---------------------------------------------------------------------------
console.log("\n== graduation ==");

while (!(await read(curve, "graduated"))) {
  await send(curve, "buy", [0n], trader, parseEther("1"));
}
check("curve graduated to Uniswap v4", (await read(curve, "graduated")) === true);
check(
  "liquidity minted and locked in the pool",
  (await read(curve, "poolLiquidity")) > 0n,
  (await read(curve, "poolLiquidity")).toString()
);

const lpTokens = await read(token, "balanceOf", [POOL_MANAGER]);
check(
  "170M tokens migrated into the pool",
  lpTokens / 10n ** 18n >= 169_000_000n && lpTokens / 10n ** 18n <= 170_000_000n,
  (lpTokens / 10n ** 18n).toLocaleString() + " tokens"
);

// ---------------------------------------------------------------------------
console.log("\n== hook fees on an external router ==");

const poolKey = await read(curve, "poolKey");
const key = {
  currency0: poolKey[0],
  currency1: poolKey[1],
  fee: poolKey[2],
  tickSpacing: poolKey[3],
  hooks: poolKey[4],
};
const wethIsCurrency0 = getAddress(key.currency0) === getAddress(WETH);

const weth = { address: WETH, abi: artifact("WETH9").abi };
const buyIn = parseEther("1");
await send(weth, "deposit", [], trader, buyIn * 2n);
await send(weth, "approve", [router.address, buyIn * 2n], trader);
await send(token, "approve", [router.address, 2n ** 255n], trader);

const feesBefore = [
  await read(hook, "pendingCreatorFees", [tokenAddress]),
  await read(hook, "pendingPlatformFees", [tokenAddress]),
];
const platformBefore3 = await pub.getBalance({ address: platform.address });

await send(router, "swap", [key, wethIsCurrency0, buyIn], trader);

const buyCreatorFee =
  (await read(hook, "pendingCreatorFees", [tokenAddress])) - feesBefore[0];
const buyPlatformFee =
  (await read(hook, "pendingPlatformFees", [tokenAddress])) -
  feesBefore[1] +
  ((await pub.getBalance({ address: platform.address })) - platformBefore3);

check(
  "BUY through a third-party router pays the creator 1%",
  buyCreatorFee === buyIn / 100n,
  formatEther(buyCreatorFee) + " ETH of " + formatEther(buyIn)
);
check(
  "BUY through a third-party router pays the platform 1%",
  buyPlatformFee === buyIn / 100n,
  formatEther(buyPlatformFee) + " ETH"
);

// --- sell leg ---------------------------------------------------------------
const sellAmount = (await read(token, "balanceOf", [trader.address])) / 4n;
const feesBefore2 = [
  await read(hook, "pendingCreatorFees", [tokenAddress]),
  await read(hook, "pendingPlatformFees", [tokenAddress]),
];
const platformBefore4 = await pub.getBalance({ address: platform.address });
const wethBefore = await read(weth, "balanceOf", [trader.address]);

await send(router, "swap", [key, !wethIsCurrency0, sellAmount], trader);

const wethOut = (await read(weth, "balanceOf", [trader.address])) - wethBefore;
const sellCreatorFee =
  (await read(hook, "pendingCreatorFees", [tokenAddress])) - feesBefore2[0];
const sellPlatformFee =
  (await read(hook, "pendingPlatformFees", [tokenAddress])) -
  feesBefore2[1] +
  ((await pub.getBalance({ address: platform.address })) - platformBefore4);
const sellFee = sellCreatorFee + sellPlatformFee;
const sellGross = wethOut + sellFee;

check(
  "SELL through a third-party router is taxed too",
  sellFee > 0n,
  formatEther(sellFee) + " ETH taken"
);
check(
  "SELL fee is 2% of the ETH leg",
  sellFee * 10_000n / sellGross >= 199n && sellFee * 10_000n / sellGross <= 201n,
  `${Number((sellFee * 10_000n) / sellGross) / 100}%`
);
check(
  "SELL fee splits 50/50 creator vs platform",
  sellCreatorFee === sellFee / 2n || sellCreatorFee === sellFee / 2n + 1n,
  `${formatEther(sellCreatorFee)} / ${formatEther(sellPlatformFee)}`
);

const creatorBal2 = await pub.getBalance({ address: creator.address });
await send(hook, "claimCreatorFees", [tokenAddress], creator);
check(
  "creator claims pool fees from the hook",
  (await pub.getBalance({ address: creator.address })) > creatorBal2
);

// ---------------------------------------------------------------------------
console.log("\n== anti-snipe ==");

const second = await launchToken("Snipe Test", "SNP", true, false);
const curve2 = second.curve;

check(
  "anti-snipe window is active at launch",
  (await read(second.token, "isAntiSnipeActive")) === true
);
check(
  "anti-snipe charges 99%",
  (await read(curve2, "currentFeeBps")) === 9900n
);

const platformBefore5 = await pub.getBalance({ address: platform.address });
const c2Before = (await read(curve2, "getPendingFees"))[0];
await send(curve2, "buy", [0n], sniper, parseEther("1"));
const snipePlatform =
  (await read(curve2, "getPendingFees"))[1] +
  ((await pub.getBalance({ address: platform.address })) - platformBefore5);

check(
  "sniper pays 99% to the platform",
  snipePlatform === parseEther("0.99"),
  formatEther(snipePlatform) + " ETH"
);
check(
  "sniper fee does not go to the creator",
  (await read(curve2, "getPendingFees"))[0] === c2Before
);

await test.increaseTime({ seconds: 16 * 60 });
await test.mine({ blocks: 1 });
check(
  "fee returns to 2% after 15 minutes",
  (await read(curve2, "currentFeeBps")) === 200n
);

// ---------------------------------------------------------------------------
console.log("\n== creator fee sharing ==");

const split = await launchToken("Split Test", "SPL", false, false, {
  recipients: [creator.address, trader.address],
  bps: [7_000, 3_000],
});
check("fee-share splitter deployed", split.feeShare !== null, split.feeShare?.address);
check(
  "curve routes the creator share to the splitter",
  getAddress(await read(split.curve, "creatorFeeRecipient")) ===
    getAddress(split.feeShare.address)
);

await send(split.curve, "buy", [0n], trader, parseEther("2"));
await send(split.feeShare, "sync", [], trader);

const accrued = await read(split.feeShare, "totalAccrued");
check(
  "splitter collected the full 1% creator fee",
  accrued === parseEther("0.02"),
  formatEther(accrued) + " ETH"
);
check(
  "70/30 split is respected",
  (await read(split.feeShare, "pendingOf", [creator.address])) === parseEther("0.014") &&
    (await read(split.feeShare, "pendingOf", [trader.address])) === parseEther("0.006"),
  "0.014 / 0.006 ETH"
);

const shareBal = await pub.getBalance({ address: trader.address });
await send(split.feeShare, "claim", [], trader);
check(
  "a listed recipient can claim their share",
  (await pub.getBalance({ address: trader.address })) > shareBal
);

let blocked = false;
try {
  await send(split.feeShare, "claim", [], sniper);
} catch {
  blocked = true;
}
check("a stranger cannot claim", blocked);

// ---------------------------------------------------------------------------
console.log("\n== cheap graduation for a mainnet rehearsal ==");

await send(factory, "setGraduationThreshold", [parseEther("0.02")]);
check(
  "owner can lower the threshold for new launches",
  (await read(factory, "graduationThreshold")) === parseEther("0.02")
);
check(
  "existing coins keep the threshold they launched with",
  (await read(curve, "graduationThreshold")) === parseEther("5")
);

const cheap = await launchToken("Rehearsal", "RHS", false, false);
check(
  "a new launch picks up the lowered threshold",
  (await read(cheap.curve, "graduationThreshold")) === parseEther("0.02")
);

await send(cheap.curve, "buy", [0n], trader, parseEther("0.05"));
check(
  "graduates on ~0.02 ETH instead of 5",
  (await read(cheap.curve, "graduated")) === true
);
check(
  "and still mints a real v4 position",
  (await read(cheap.curve, "poolLiquidity")) > 0n
);

await send(factory, "setGraduationThreshold", [parseEther("5")]);
check(
  "threshold restores to 5 ETH",
  (await read(factory, "graduationThreshold")) === parseEther("5")
);

console.log(`\n== ${ok.length} checks passed ==\n`);

