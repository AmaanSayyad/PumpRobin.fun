#!/usr/bin/env bash
# Verify PumpRobin factory + hook on Robinhood Blockscout after deploy.
# Usage: ./scripts/verify-blockscout.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

FACTORY="${1:-${NEXT_PUBLIC_FACTORY_ADDRESS:?NEXT_PUBLIC_FACTORY_ADDRESS missing}}"
HOOK="${NEXT_PUBLIC_HOOK_ADDRESS:?NEXT_PUBLIC_HOOK_ADDRESS missing}"
FEE_COLLECTOR="${FEE_COLLECTOR:-0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9}"
POOL_MANAGER="0x8366a39CC670B4001A1121B8F6A443A643e40951"
WETH="0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73"
OWNER="${HOOK_OWNER:-0xf3b4f2a957E05D3A77fE491CeBc68FA82C0c444d}"
RPC="${RH_RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"
VERIFIER_URL="${BLOCKSCOUT_API:-https://robinhoodchain.blockscout.com/api}"

FACTORY_ARGS=$(cast abi-encode "constructor(address,address)" "$FEE_COLLECTOR" "$HOOK")
HOOK_ARGS=$(cast abi-encode "constructor(address,address,address,address)" \
  "$POOL_MANAGER" "$WETH" "$FEE_COLLECTOR" "$OWNER")

echo "Verifying PumpRobinHook at $HOOK ..."
forge verify-contract \
  --chain-id 4663 \
  --rpc-url "$RPC" \
  --verifier blockscout \
  --verifier-url "$VERIFIER_URL" \
  --watch \
  --via-ir \
  --optimizer-runs 200 \
  --compiler-version 0.8.20 \
  "$HOOK" \
  contracts/PumpRobinHook.sol:PumpRobinHook \
  --constructor-args "$HOOK_ARGS"

echo ""
echo "Verifying PumpRobinFactory at $FACTORY ..."
forge verify-contract \
  --chain-id 4663 \
  --rpc-url "$RPC" \
  --verifier blockscout \
  --verifier-url "$VERIFIER_URL" \
  --watch \
  --via-ir \
  --optimizer-runs 200 \
  --compiler-version 0.8.20 \
  "$FACTORY" \
  contracts/PumpRobinFactory.sol:PumpRobinFactory \
  --constructor-args "$FACTORY_ARGS"

echo ""
echo "Done."
echo "  Hook:    https://robinhoodchain.blockscout.com/address/${HOOK}"
echo "  Factory: https://robinhoodchain.blockscout.com/address/${FACTORY}"
