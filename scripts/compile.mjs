#!/usr/bin/env node
// ponytail: solc standard-JSON straight from node_modules — no foundry/hardhat
// toolchain to install. Emits out/<Contract>.json with abi + bytecode.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const solc = require("solc");

const ROOT = process.cwd();
const OUT = path.join(ROOT, "out");

const TARGETS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "contracts/PumpRobinToken.sol",
      "contracts/BondingCurve.sol",
      "contracts/PumpRobinFactory.sol",
      "contracts/PumpRobinHook.sol",
    ];

const NM = path.join(ROOT, "node_modules");

/** Disk path -> the source key solc will see (must match how it is imported). */
function absToKey(abs) {
  const rel = path.relative(abs.startsWith(NM) ? NM : ROOT, abs);
  return rel.split(path.sep).join("/");
}

/** Bare key (e.g. "@openzeppelin/...") -> disk path. */
function keyToAbs(key) {
  return path.join(key.startsWith("@") ? NM : ROOT, key);
}

const seen = new Map();

function load(spec, fromAbsDir) {
  const abs = spec.startsWith(".")
    ? path.resolve(fromAbsDir, spec)
    : keyToAbs(spec);
  const key = absToKey(abs);
  if (seen.has(key)) return key;
  if (!fs.existsSync(abs)) throw new Error(`Cannot find import: ${spec} (${abs})`);
  const source = fs.readFileSync(abs, "utf8");
  seen.set(key, source);
  const dir = path.dirname(abs);
  for (const m of source.matchAll(/import\s+(?:\{[^}]*\}\s+from\s+)?["']([^"']+)["']/g)) {
    load(m[1], dir);
  }
  return key;
}

for (const t of TARGETS) load("./" + t, ROOT);

const input = {
  language: "Solidity",
  sources: Object.fromEntries(
    [...seen].map(([name, content]) => [name, { content }])
  ),
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    evmVersion: "cancun",
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

const errors = (output.errors || []).filter((e) => e.severity === "error");
const warnings = (output.errors || []).filter((e) => e.severity === "warning");
for (const w of warnings) console.warn("WARN:", w.formattedMessage.trim());
if (errors.length) {
  for (const e of errors) console.error(e.formattedMessage);
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
let count = 0;
for (const [file, contracts] of Object.entries(output.contracts || {})) {
  if (!file.startsWith("contracts/")) continue;
  for (const [name, c] of Object.entries(contracts)) {
    fs.writeFileSync(
      path.join(OUT, `${name}.json`),
      JSON.stringify(
        {
          contractName: name,
          sourceName: file,
          abi: c.abi,
          bytecode: "0x" + c.evm.bytecode.object,
          deployedBytecode: "0x" + c.evm.deployedBytecode.object,
        },
        null,
        2
      )
    );
    const size = c.evm.deployedBytecode.object.length / 2;
    console.log(`${name.padEnd(22)} ${String(size).padStart(6)} bytes`);
    count++;
  }
}
fs.writeFileSync(path.join(OUT, "solc-input.json"), JSON.stringify(input, null, 2));
console.log(`\nCompiled ${count} contracts -> out/`);
