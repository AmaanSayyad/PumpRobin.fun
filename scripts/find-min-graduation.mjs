#!/usr/bin/env node
/**
 * Finds how small a graduation raise can get before the v4 migration stops
 * working, so a mainnet rehearsal costs as little as possible.
 *
 *   anvil --chain-id 4663 --port 8546 --accounts 5 --balance 10000 --silent &
 *   node scripts/find-min-graduation.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  createTestClient,
  http,
  defineChain,
  parseEther,
  formatEther,
  encodeAbiParameters,
  concat,
  keccak256,
  pad,
  toHex,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const LOCAL = process.env.SIM_RPC || "http://127.0.0.1:8546";
const UPSTREAM = "https://rpc.mainnet.chain.robinhood.com";
const POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

const chain = defineChain({
  id: 4663,
  name: "sim",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [LOCAL] } },
});

const [deployer, creator, trader] = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
].map(privateKeyToAccount);

const pub = createPublicClient({ chain, transport: http(LOCAL) });
const test = createTestClient({ chain, mode: "anvil", transport: http(LOCAL) });
const w = (a) => createWalletClient({ account: a, chain, transport: http(LOCAL) });
const artifact = (n) =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "out", `${n}.json`), "utf8"));

async function deploy(name, args = [], acc = deployer) {
  const a = artifact(name);
  const hash = await w(acc).deployContract({ abi: a.abi, bytecode: a.bytecode, args });
  const r = await pub.waitForTransactionReceipt({ hash });
  return { address: r.contractAddress, abi: a.abi };
}
async function send(c, fn, args = [], acc = deployer, value = 0n) {
  const hash = await w(acc).writeContract({
    address: c.address,
    abi: c.abi,
    functionName: fn,
    args,
    value,
  });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${fn} reverted`);
  return r;
}
const read = (c, fn, args = []) =>
  pub.readContract({ address: c.address, abi: c.abi, functionName: fn, args });

// --- chain setup -------------------------------------------------------------
const upstream = createPublicClient({ transport: http(UPSTREAM) });
await test.setCode({
  address: POOL_MANAGER,
  bytecode: await upstream.getBytecode({ address: POOL_MANAGER }),
});
await test.setCode({ address: WETH, bytecode: artifact("WETH9").deployedBytecode });

const create2 = await deploy("Create2Factory");
const hookArtifact = artifact("PumpRobinHook");
const initCode = concat([
  hookArtifact.bytecode,
  encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }],
    [POOL_MANAGER, WETH, deployer.address, deployer.address]
  ),
]);
const initCodeHash = keccak256(initCode);
let salt, hookAddress;
for (let i = 0n; i < 2_000_000n; i++) {
  const s = pad(toHex(i), { size: 32 });
  const addr = `0x${keccak256(concat(["0xff", create2.address, s, initCodeHash])).slice(26)}`;
  if ((BigInt(addr) & 0x3fffn) === 0x2eccn) {
    salt = s;
    hookAddress = getAddress(addr);
    break;
  }
}
await send(create2, "deploy", [salt, initCode]);
const hook = { address: hookAddress, abi: hookArtifact.abi };
const tokenDeployer = await deploy("PumpRobinDeployer");
const factory = await deploy("PumpRobinFactory", [
  deployer.address,
  hookAddress,
  tokenDeployer.address,
]);
await send(tokenDeployer, "setFactory", [factory.address]);
await send(hook, "setFactory", [factory.address]);
await send(factory, "setCreationFee", [0n]);
const router = await deploy("TestSwapRouter", [POOL_MANAGER]);
const weth = { address: WETH, abi: artifact("WETH9").abi };

// --- try progressively smaller raises ---------------------------------------
const CANDIDATES = [
  "0.00005",
  "0.0001",
  "0.0002",
  "0.0005",
  "0.001",
  "0.003",
];

console.log("\n  threshold    graduated  liquidity            2% on an external swap");
console.log(`  ${"-".repeat(74)}`);

let i = 0;
for (const t of CANDIDATES) {
  const threshold = parseEther(t);
  let line = `  ${t.padEnd(12)}`;
  try {
    await send(factory, "setGraduationThreshold", [threshold]);
    await send(
      factory,
      "createToken",
      [`T${i}`, `T${i}`, "img", "d", "meta", false, false, [], []],
      creator
    );
    i++;
    const n = await read(factory, "tokenCount");
    const tokenAddress = await read(factory, "allTokens", [n - 1n]);
    const curve = {
      address: await read(factory, "tokenToCurve", [tokenAddress]),
      abi: artifact("BondingCurve").abi,
    };

    // one buy big enough to cross the threshold; the curve refunds the rest
    await send(curve, "buy", [0n], trader, threshold * 2n);
    const graduated = await read(curve, "graduated");
    const liquidity = await read(curve, "poolLiquidity");
    line += `  ${String(graduated).padEnd(9)}  ${String(liquidity).padEnd(20)}`;

    if (!graduated) {
      console.log(line + " —");
      continue;
    }

    // now swap through a router we do not control and see if 2% lands
    const key = await read(curve, "poolKey");
    const poolKey = {
      currency0: key[0],
      currency1: key[1],
      fee: key[2],
      tickSpacing: key[3],
      hooks: key[4],
    };
    const wethIs0 = getAddress(poolKey.currency0) === getAddress(WETH);
    const swapIn = threshold / 10n;

    await send(weth, "deposit", [], trader, swapIn);
    await send(weth, "approve", [router.address, swapIn], trader);
    const before = await read(hook, "pendingCreatorFees", [tokenAddress]);
    const beforeP = await read(hook, "pendingPlatformFees", [tokenAddress]);
    await send(router, "swap", [poolKey, wethIs0, swapIn], trader);
    const fee =
      (await read(hook, "pendingCreatorFees", [tokenAddress])) -
      before +
      ((await read(hook, "pendingPlatformFees", [tokenAddress])) - beforeP);

    const pct = swapIn > 0n ? (Number(fee) / Number(swapIn)) * 100 : 0;
    line += `  ${formatEther(fee)} ETH (${pct.toFixed(2)}%)`;
    console.log(line);
  } catch (err) {
    console.log(line + `  FAILED — ${(err.shortMessage || err.message).slice(0, 45)}`);
  }
}

console.log("");
