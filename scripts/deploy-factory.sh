#!/usr/bin/env bash
# Deploy PumpRobinFactory to Robinhood Chain mainnet (Foundry).
# Requires PRIVATE_KEY and RH_RPC_URL in the environment or .env.local.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^(PRIVATE_KEY|RH_RPC_URL|FEE_COLLECTOR|NEXT_PUBLIC_HOOK_ADDRESS)=' .env.local | sed 's/\r$//')
  set +a
fi

: "${PRIVATE_KEY:?Set PRIVATE_KEY}"
: "${RH_RPC_URL:=https://rpc.mainnet.chain.robinhood.com}"
: "${FEE_COLLECTOR:=0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9}"
: "${HOOK:=${NEXT_PUBLIC_HOOK_ADDRESS:-0xdbaC8dEfBE0287bB79183A43e4Bf39Cb2A5C2ecc}}"

BASE=$(cast base-fee --rpc-url "$RH_RPC_URL")
GAS=$((BASE * 2))

echo "Deploying PumpRobinFactory (feeCollector=$FEE_COLLECTOR hook=$HOOK)…"
ADDR=$(forge create "contracts/PumpRobinFactory.sol:PumpRobinFactory" \
  --rpc-url "$RH_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --legacy \
  --gas-price "$GAS" \
  --constructor-args "$FEE_COLLECTOR" "$HOOK" \
  --json | python3 -c "import sys,json; print(json.load(sys.stdin).get('deployedTo',''))")

echo "Deployed to: $ADDR"
echo "Set NEXT_PUBLIC_FACTORY_ADDRESS=$ADDR in .env.local and restart next dev."
