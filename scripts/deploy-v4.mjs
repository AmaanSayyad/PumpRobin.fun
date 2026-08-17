#!/usr/bin/env node
/**
 * Deploys the v4 fee architecture to Robinhood Chain and prints the env vars.
 *
 *   node scripts/compile.mjs
 *   PRIVATE_KEY=0x... node scripts/deploy-v4.mjs            # mainnet
 *   PRIVATE_KEY=0x... RPC_URL=http://127.0.0.1:8546 node scripts/deploy-v4.mjs
 *
 * The hook's address is not incidental: Uniswap v4 reads a hook's permissions
 * out of its low 14 address bits, so the address has to be mined with CREATE2
 * until it ends in 0x2ECC. Everything else is a plain deploy.
 */
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  concat,
  encodeAbiParameters,
  getAddress,
  keccak256,
  pad,
  toHex,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";

const RPC_URL = process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const CHAIN_ID = Number(process.env.CHAIN_ID || 4663);
const POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const HOOK_FLAGS = 0x2eccn;
const FLAG_MASK = 0x3fffn;

const key = process.env.PRIVATE_KEY;
if (!key) {
  console.error("PRIVATE_KEY is required");
  process.exit(1);
}
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);

const FEE_COLLECTOR =
  process.env.FEE_COLLECTOR || "0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9";

const chain = defineChain({
  id: CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});
const pub = createPublicClient({ chain, transport: http(RPC_URL) });
const wallet = createWalletClient({ account, chain, transport: http(RPC_URL) });

const OUT = path.join(process.cwd(), "out");
const artifact = (n) => {
  const f = path.join(OUT, `${n}.json`);
  if (!fs.existsSync(f)) {
    console.error(`missing ${f} — run: node scripts/compile.mjs`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(f, "utf8"));
};

async function deploy(name, args = []) {
  const a = artifact(name);
  const hash = await wallet.deployContract({ abi: a.abi, bytecode: a.bytecode, args });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${name} deploy reverted`);
  console.log(`  ${name.padEnd(20)} ${receipt.contractAddress}`);
  return { address: receipt.contractAddress, abi: a.abi };
}

async function send(c, functionName, args = []) {
  const hash = await wallet.writeContract({
    address: c.address,
    abi: c.abi,
    functionName,
    args,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${functionName} reverted`);
  return receipt;
}

console.log(`\ndeployer   ${account.address}`);
console.log(`rpc        ${RPC_URL}`);
const balance = await pub.getBalance({ address: account.address });
console.log(`balance    ${formatEther(balance)} ETH`);
console.log(`collector  ${FEE_COLLECTOR}\n`);

if (balance === 0n) {
  console.error("deployer has no ETH");
  process.exit(1);
}

console.log("deploying:");
const create2 = await deploy("Create2Factory");

// --- mine the hook address ---------------------------------------------------
const hookArtifact = artifact("PumpRobinHook");
const initCode = concat([
  hookArtifact.bytecode,
  encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }],
    [POOL_MANAGER, WETH, FEE_COLLECTOR, account.address]
  ),
]);
const initCodeHash = keccak256(initCode);

let salt;
let hookAddress;
for (let i = 0n; i < 5_000_000n; i++) {
  const s = pad(toHex(i), { size: 32 });
  const addr = `0x${keccak256(concat(["0xff", create2.address, s, initCodeHash])).slice(26)}`;
  if ((BigInt(addr) & FLAG_MASK) === HOOK_FLAGS) {
    salt = s;
    hookAddress = getAddress(addr);
    console.log(`  mined hook salt after ${i} tries`);
    break;
  }
}
if (!hookAddress) throw new Error("could not mine a hook address");

await send(create2, "deploy", [salt, initCode]);
console.log(`  ${"PumpRobinHook".padEnd(20)} ${hookAddress}`);
const hook = { address: hookAddress, abi: hookArtifact.abi };

const deployer = await deploy("PumpRobinDeployer");
const factory = await deploy("PumpRobinFactory", [
  FEE_COLLECTOR,
  hookAddress,
  deployer.address,
]);

console.log("\nwiring:");
await send(deployer, "setFactory", [factory.address]);
console.log("  deployer.setFactory  ok");
await send(hook, "setFactory", [factory.address]);
console.log("  hook.setFactory      ok");

// --- verify the deployment is actually usable --------------------------------
console.log("\nchecks:");
const flags = BigInt(hookAddress) & FLAG_MASK;
console.log(`  hook flags           0x${flags.toString(16)} ${flags === HOOK_FLAGS ? "ok" : "WRONG"}`);
const wiredFactory = await pub.readContract({
  address: hookAddress,
  abi: hookArtifact.abi,
  functionName: "factory",
});
console.log(
  `  hook -> factory      ${getAddress(wiredFactory) === getAddress(factory.address) ? "ok" : "WRONG"}`
);
const fee = await pub.readContract({
  address: factory.address,
  abi: factory.abi,
  functionName: "creationFee",
});
console.log(`  creation fee         ${formatEther(fee)} ETH`);

console.log(`
Set these and redeploy the site:

  NEXT_PUBLIC_FACTORY_ADDRESS=${factory.address}
  NEXT_PUBLIC_HOOK_ADDRESS=${hookAddress}
  NEXT_PUBLIC_DEPLOYER_ADDRESS=${deployer.address}
`);
