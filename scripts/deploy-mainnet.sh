#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

: "${PRIVATE_KEY:?PRIVATE_KEY missing — set in .env.local}"
FEE_COLLECTOR="${FEE_COLLECTOR:-0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9}"
RPC="${RH_RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"

echo "Deploying PumpRobinFactory to Robinhood mainnet..."
echo "Fee collector: $FEE_COLLECTOR"

forge create contracts/PumpRobinFactory.sol:PumpRobinFactory \
  --rpc-url "$RPC" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --legacy \
  --gas-price 60000000 \
  --constructor-args "$FEE_COLLECTOR"
