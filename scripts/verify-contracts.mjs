#!/usr/bin/env node
/**
 * Verifies the deployed contracts on Robinhood Blockscout using the exact
 * standard-JSON input they were compiled from.
 *
 *   node scripts/compile.mjs && node scripts/verify-contracts.mjs
 *
 * Unverified bytecode is why audit tools decompile and mis-report these
 * contracts, and why GMGN shows "Not open-sourced".
 */
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  http,
  encodeAbiParameters,
  getAddress,
} from "viem";

const BLOCKSCOUT = "https://robinhoodchain.blockscout.com";
const RPC = "https://rpc.mainnet.chain.robinhood.com";
const COMPILER = "v0.8.26+commit.8a97fa7a";

const pub = createPublicClient({ transport: http(RPC) });
const solcInput = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "out", "solc-input.json"), "utf8")
);
const artifact = (n) =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "out", `${n}.json`), "utf8"));

const strip = (h) => (h.startsWith("0x") ? h.slice(2) : h);

async function status(address) {
  const res = await fetch(
    `${BLOCKSCOUT}/api/v2/smart-contracts/${address.toLowerCase()}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return null;
  return res.json();
}

async function submit({ address, sourceName, contractName, constructorArgs }) {
  const form = new FormData();
  form.set("compiler_version", COMPILER);
  // Blockscout wants path:Name when the input has many sources
  form.set("contract_name", `${sourceName}:${contractName}`);
  form.set("license_type", "mit");
  if (constructorArgs) {
    form.set("autodetect_constructor_args", "false");
    form.set("constructor_args", strip(constructorArgs));
  } else {
    form.set("autodetect_constructor_args", "true");
  }
  form.set(
    "files[standard-input.json]",
    new Blob([JSON.stringify(solcInput)], { type: "application/json" }),
    "standard-input.json"
  );

  const res = await fetch(
    `${BLOCKSCOUT}/api/v2/smart-contracts/${address.toLowerCase()}/verification/via/standard-input`,
    { method: "POST", headers: { Accept: "application/json" }, body: form }
  );
  return { ok: res.ok, status: res.status, body: (await res.text()).slice(0, 300) };
}

async function waitVerified(address, tries = 20) {
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await status(address);
    if (s?.is_verified) return true;
  }
  return false;
}

async function verify(target) {
  const existing = await status(target.address);
  if (existing?.is_verified) {
    console.log(`  ${target.contractName.padEnd(20)} already verified`);
    return true;
  }
  const r = await submit(target);
  if (!r.ok) {
    console.log(`  ${target.contractName.padEnd(20)} submit failed (${r.status}) ${r.body}`);
    return false;
  }
  const done = await waitVerified(target.address);
  console.log(
    `  ${target.contractName.padEnd(20)} ${done ? "VERIFIED" : "submitted, still pending"}  ${target.address}`
  );
  return done;
}

// ---------------------------------------------------------------------------
const FACTORY = getAddress(process.env.FACTORY);
const HOOK = getAddress(process.env.HOOK);
const DEPLOYER = getAddress(process.env.DEPLOYER);
const FEE_COLLECTOR = getAddress(
  process.env.FEE_COLLECTOR || "0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9"
);
const POOL_MANAGER = getAddress("0x8366a39CC670B4001A1121B8F6A443A643e40951");
const WETH = getAddress("0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73");

// The hook's owner is whoever deployed it; read it back rather than assume.
const hookOwner = await pub.readContract({
  address: HOOK,
  abi: artifact("PumpRobinHook").abi,
  functionName: "owner",
});

const addr = (types, values) => encodeAbiParameters(types.map((t) => ({ type: t })), values);

const TARGETS = [
  {
    address: DEPLOYER,
    sourceName: "contracts/PumpRobinDeployer.sol",
    contractName: "PumpRobinDeployer",
    constructorArgs: null,
  },
  {
    address: HOOK,
    sourceName: "contracts/PumpRobinHook.sol",
    contractName: "PumpRobinHook",
    constructorArgs: addr(
      ["address", "address", "address", "address"],
      [POOL_MANAGER, WETH, FEE_COLLECTOR, hookOwner]
    ),
  },
  {
    address: FACTORY,
    sourceName: "contracts/PumpRobinFactory.sol",
    contractName: "PumpRobinFactory",
    constructorArgs: addr(
      ["address", "address", "address"],
      [FEE_COLLECTOR, HOOK, DEPLOYER]
    ),
  },
];

// A launched coin and its curve carry immutables, so each one has its own
// runtime bytecode and needs verifying in its own right.
if (process.env.TOKEN) {
  const token = getAddress(process.env.TOKEN);
  const tokenAbi = artifact("PumpRobinToken").abi;
  const readToken = (fn) =>
    pub.readContract({ address: token, abi: tokenAbi, functionName: fn });
  const [name, symbol, imageUri, description, metadataURI, creator, platform, snipeEnd, cap] =
    await Promise.all([
      readToken("name"),
      readToken("symbol"),
      readToken("imageUri"),
      readToken("description"),
      readToken("metadataURI"),
      readToken("creator"),
      readToken("platformFeeRecipient"),
      readToken("antiSnipeEndsAt"),
      readToken("maxWalletAmount"),
    ]);
  TARGETS.push({
    address: token,
    sourceName: "contracts/PumpRobinToken.sol",
    contractName: "PumpRobinToken",
    constructorArgs: encodeAbiParameters(
      [
        { type: "string" },
        { type: "string" },
        { type: "string" },
        { type: "string" },
        { type: "string" },
        { type: "address" },
        { type: "address" },
        { type: "bool" },
        { type: "bool" },
      ],
      [name, symbol, imageUri, description, metadataURI, creator, platform, snipeEnd > 0n, cap > 0n]
    ),
  });

  if (process.env.CURVE) {
    const curve = getAddress(process.env.CURVE);
    const curveAbi = artifact("BondingCurve").abi;
    const threshold = await pub.readContract({
      address: curve,
      abi: curveAbi,
      functionName: "graduationThreshold",
    });
    TARGETS.push({
      address: curve,
      sourceName: "contracts/BondingCurve.sol",
      contractName: "BondingCurve",
      constructorArgs: encodeAbiParameters(
        [
          { type: "address" },
          { type: "address" },
          { type: "address" },
          { type: "address" },
          { type: "address" },
          { type: "uint256" },
        ],
        [token, creator, FACTORY, platform, HOOK, threshold]
      ),
    });
  }
}

console.log("\nverifying on Blockscout:");
let allOk = true;
for (const t of TARGETS) allOk = (await verify(t)) && allOk;

console.log(
  allOk
    ? "\nall verified\n"
    : "\nsome are still pending — Blockscout finishes asynchronously, re-run to check\n"
);
