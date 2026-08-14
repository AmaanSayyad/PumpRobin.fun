#!/usr/bin/env bash
# Verify PumpRobin contracts on Robinhood Blockscout after deploy.
# Usage: FEE_COLLECTOR=0x61F928... ./scripts/verify-blockscout.sh <FACTORY_ADDRESS>
set -euo pipefail

FACTORY="${1:?Factory address required}"
FEE_COLLECTOR="${FEE_COLLECTOR:-0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9}"
RPC="${RH_RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"
VERIFIER_URL="${BLOCKSCOUT_API:-https://robinhoodchain.blockscout.com/api}"

ENCODED_ARGS=$(cast abi-encode "constructor(address)" "$FEE_COLLECTOR")

echo "Verifying PumpRobinFactory at $FACTORY ..."
forge verify-contract \
  --chain-id 4663 \
  --rpc-url "$RPC" \
  --verifier blockscout \
  --verifier-url "$VERIFIER_URL" \
  --watch \
  "$FACTORY" \
  contracts/PumpRobinFactory.sol:PumpRobinFactory \
  --constructor-args "$ENCODED_ARGS"

echo ""
echo "Factory verified. New tokens are submitted to Blockscout automatically"
echo "after launch via /api/tokens (HTTP standard-json, no Foundry on Vercel)."
echo ""
echo "For each new token, submit logo to DEX Screener:"
echo "  https://dexscreener.com/robinhood/<TOKEN>?info=update"
