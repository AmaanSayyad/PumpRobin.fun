#!/usr/bin/env bash
# Regenerate src/lib/verify/solc-standard-input.json after contract changes.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="src/lib/verify/solc-standard-input.json"
FEE_COLLECTOR="${FEE_COLLECTOR:-0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9}"
FACTORY="${NEXT_PUBLIC_FACTORY_ADDRESS:-0xEcF4a7b8f79a133aCDF92dbA5Fbcd3CA29394bD2}"
HOOK="${NEXT_PUBLIC_HOOK_ADDRESS:-0xdbaC8dEfBE0287bB79183A43e4Bf39Cb2A5C2ecc}"
FEE_COLLECTOR="${FEE_COLLECTOR:-0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9}"
ARGS=$(cast abi-encode "constructor(address,address)" "$FEE_COLLECTOR" "$HOOK")

forge verify-contract \
  --show-standard-json-input \
  "$FACTORY" \
  contracts/PumpRobinFactory.sol:PumpRobinFactory \
  --constructor-args "$ARGS" \
  --via-ir \
  --optimizer-runs 200 \
  --compiler-version 0.8.20 \
  > "$OUT"

echo "Wrote $OUT ($(wc -c < "$OUT") bytes)"
