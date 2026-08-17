#!/usr/bin/env node
/**
 * Measures real gas for each step against a local chain, then prices it at the
 * live mainnet gas price. Answers "what does a launch actually cost".
 *
 *   anvil --chain-id 4663 --port 8546 --accounts 5 --balance 10000 --silent &
 *   node scripts/gas-report.mjs
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
  formatGwei,
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
const HOOK_FLAGS = 0x2eccn;
const FLAG_MASK = 0x3fffn;

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
const wallet = (a) => createWalletClient({ account: a, chain, transport: http(LOCAL) });

const OUT = path.join(process.cwd(), "out");
const artifact = (n) => JSON.parse(fs.readFileSync(path.join(OUT, `${n}.json`), "utf8"));

const steps = [];
let deployGas = 0n;

async function deploy(name, args = [], account = deployer) {
  const a = artifact(name);
  const hash = await wallet(account).deployContract({ abi: a.abi, bytecode: a.bytecode, args });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${name} deploy reverted`);
  deployGas += r.gasUsed;
  return { address: r.contractAddress, abi: a.abi };
}

async function send(label, c, functionName, args = [], account = deployer, value = 0n) {
  const hash = await wallet(account).writeContract({
    address: c.address,
    abi: c.abi,
    functionName,
    args,
    value,
  });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${functionName} reverted`);
  if (label) steps.push([label, r.gasUsed]);
  else deployGas += r.gasUsed;
  return r;
}

const read = (c, fn, args = []) =>
  pub.readContract({ address: c.address, abi: c.abi, functionName: fn, args });

// --- stand up the chain ------------------------------------------------------
const upstream = createPublicClient({ transport: http(UPSTREAM) });
const pmCode = await upstream.getBytecode({ address: POOL_MANAGER });
await test.setCode({ address: POOL_MANAGER, bytecode: pmCode });
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
  if ((BigInt(addr) & FLAG_MASK) === HOOK_FLAGS) {
    salt = s;
    hookAddress = getAddress(addr);
    break;
  }
}
await send(null, create2, "deploy", [salt, initCode]);
const hook = { address: hookAddress, abi: hookArtifact.abi };
const tokenDeployer = await deploy("PumpRobinDeployer");
const factory = await deploy("PumpRobinFactory", [
  deployer.address,
  hookAddress,
  tokenDeployer.address,
]);
await send(null, tokenDeployer, "setFactory", [factory.address]);
await send(null, hook, "setFactory", [factory.address]);

// --- the steps a launch-and-test actually costs ------------------------------
const creationFee = await read(factory, "creationFee");

await send(
  "createToken (launch, no first buy)",
  factory,
  "createToken",
  ["Gas Test", "GAS", "ipfs://img", "d", "ipfs://meta", false, false, [], []],
  creator,
  creationFee
);
const n = await read(factory, "tokenCount");
const tokenAddress = await read(factory, "allTokens", [n - 1n]);
const curve = {
  address: await read(factory, "tokenToCurve", [tokenAddress]),
  abi: artifact("BondingCurve").abi,
};
const token = { address: tokenAddress, abi: artifact("PumpRobinToken").abi };

await send("curve buy", curve, "buy", [0n], trader, parseEther("0.01"));
await send("curve buy (2nd)", curve, "buy", [0n], trader, parseEther("0.01"));

const bal = await read(token, "balanceOf", [trader.address]);
await send("approve for sell", token, "approve", [curve.address, bal], trader);
await send("curve sell", curve, "sell", [bal / 2n, 0n], trader);

await send("claimCreatorFees", curve, "claimCreatorFees", [], creator);

// launch that also buys in the same transaction
await send(
  "createToken + first buy",
  factory,
  "createToken",
  ["Gas Test 2", "GAS2", "ipfs://img", "d", "ipfs://meta", true, true, [], []],
  creator,
  creationFee + parseEther("0.01")
);

// --- price it ----------------------------------------------------------------
const gasPrice = await upstream.getGasPrice();
let ethUsd = 2500;
try {
  const r = await fetch(
    "https://api.coinbase.com/v2/prices/ETH-USD/spot"
  ).then((x) => x.json());
  if (r?.data?.amount) ethUsd = Number(r.data.amount);
} catch {
  /* fall back to the config hint */
}

const usd = (wei) => `$${(Number(formatEther(wei)) * ethUsd).toFixed(4)}`;
const row = (label, gas) =>
  `  ${label.padEnd(34)} ${String(gas).padStart(9)}  ${formatEther(gas * gasPrice).padEnd(14)} ${usd(gas * gasPrice)}`;

console.log(`\nmainnet gas price  ${formatGwei(gasPrice)} gwei`);
console.log(`ETH/USD            $${ethUsd.toLocaleString()}\n`);
console.log(`  ${"step".padEnd(34)} ${"gas".padStart(9)}  ${"ETH".padEnd(14)} USD`);
console.log(`  ${"-".repeat(70)}`);
console.log(row("one-time contract deploy", deployGas));
for (const [label, gas] of steps) console.log(row(label, gas));

const testGas = steps.reduce((s, [, g]) => s + g, 0n);
console.log(`  ${"-".repeat(70)}`);
console.log(row("all test steps (gas only)", testGas));
console.log(row("deploy + all test steps", deployGas + testGas));

console.log(`\n  creation fee per launch      ${formatEther(creationFee)} ETH  ${usd(creationFee)}`);
console.log("  (paid to your own feeCollector, so it comes straight back)\n");
