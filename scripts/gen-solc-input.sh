#!/usr/bin/env bash
# Regenerate src/lib/verify/solc-standard-input.json after contract changes.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="src/lib/verify/solc-standard-input.json"
FEE_COLLECTOR="${FEE_COLLECTOR:-0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9}"
FACTORY="${NEXT_PUBLIC_FACTORY_ADDRESS:-0x9be41279a726F1568Ad5AAcC8a406Ebf26Df6002}"
ARGS=$(cast abi-encode "constructor(address)" "$FEE_COLLECTOR")

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
