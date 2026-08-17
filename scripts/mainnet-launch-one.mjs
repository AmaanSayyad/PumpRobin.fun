#!/usr/bin/env node
/**
 * Renounces the hook owner, then launches one throwaway coin so its token and
 * curve can be verified and audited before anything is graduated.
 *
 *   FACTORY=0x… HOOK=0x… node scripts/mainnet-launch-one.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  formatEther,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://rpc.mainnet.chain.robinhood.com";
const FACTORY = getAddress(process.env.FACTORY);
const HOOK = getAddress(process.env.HOOK);

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

const read = (c, fn, args = []) =>
  pub.readContract({ address: c.address, abi: c.abi, functionName: fn, args });

async function send(c, fn, args = [], value = 0n) {
  const gas = await pub.estimateContractGas({
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
    gas: (gas * 15n) / 10n,
  });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${fn} reverted (${hash})`);
  return r;
}

const before = await pub.getBalance({ address: account.address });
console.log(`\nbalance ${formatEther(before)} ETH`);

// --- the hook's only owner power is already spent; give it up for good -------
const owner = await read(hook, "owner");
if (owner !== "0x0000000000000000000000000000000000000000") {
  console.log(`hook owner ${owner} — renouncing`);
  await send(hook, "renounceOwnership");
}
console.log("hook owner now", await read(hook, "owner"));
console.log("hook factory  ", await read(hook, "factory"));

// --- free launches while testing --------------------------------------------
const originalFee = await read(factory, "creationFee");
if (originalFee > 0n) await send(factory, "setCreationFee", [0n]);

await send(factory, "createToken", [
  "Test Four",
  "TEST4",
  "https://ipfs.io/ipfs/QmTestImagePlaceholderCid00000000000001",
  "test",
  "https://ipfs.io/ipfs/QmTestMetadataPlaceholderCid0000000001",
  false,
  false,
  [],
  [],
]);

const n = await read(factory, "tokenCount");
const token = await read(factory, "allTokens", [n - 1n]);
const curve = await read(factory, "tokenToCurve", [token]);

const after = await pub.getBalance({ address: account.address });
console.log(`\n  token  ${token}`);
console.log(`  curve  ${curve}`);
console.log(`  spent  ${formatEther(before - after)} ETH`);
console.log(`  left   ${formatEther(after)} ETH\n`);
console.log(`TOKEN=${token} CURVE=${curve}`);
