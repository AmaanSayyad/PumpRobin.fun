#!/usr/bin/env bash
# Verify a launched token + bonding curve on Blockscout.
# Usage: ./scripts/verify-token.sh <TOKEN_ADDRESS>
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

TOKEN="${1:?Token address required}"
FACTORY="${NEXT_PUBLIC_FACTORY_ADDRESS:?NEXT_PUBLIC_FACTORY_ADDRESS missing}"
HOOK="${NEXT_PUBLIC_HOOK_ADDRESS:?NEXT_PUBLIC_HOOK_ADDRESS missing}"
FEE_COLLECTOR="${FEE_COLLECTOR:-0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9}"
RPC="${RH_RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"
VERIFIER_URL="${BLOCKSCOUT_API:-https://robinhoodchain.blockscout.com/api}"
CHAIN_ID=4663

CURVE=$(cast call "$FACTORY" "tokenToCurve(address)(address)" "$TOKEN" -r "$RPC")
if [[ "$CURVE" == "0x0000000000000000000000000000000000000000" ]]; then
  echo "No bonding curve for token $TOKEN on factory $FACTORY"
  exit 1
fi

echo "Token:  $TOKEN"
echo "Curve:  $CURVE"
echo "Factory: $FACTORY"

NAME=$(cast call "$TOKEN" "name()(string)" -r "$RPC")
SYMBOL=$(cast call "$TOKEN" "symbol()(string)" -r "$RPC")
IMAGE=$(cast call "$TOKEN" "imageUri()(string)" -r "$RPC")
DESC=$(cast call "$TOKEN" "description()(string)" -r "$RPC")
META=$(cast call "$TOKEN" "metadataURI()(string)" -r "$RPC")
CREATOR=$(cast call "$TOKEN" "creator()(address)" -r "$RPC")
ANTI=$(cast call "$TOKEN" "antiSnipeEndsAt()(uint256)" -r "$RPC")
MAXW=$(cast call "$TOKEN" "maxWalletAmount()(uint256)" -r "$RPC")
ANTI_BOOL=$([[ "$ANTI" != "0" ]] && echo true || echo false)
MAX_BOOL=$([[ "$MAXW" != "0" ]] && echo true || echo false)

TOKEN_ARGS=$(cast abi-encode \
  "constructor(string,string,string,string,string,address,address,bool,bool)" \
  "$NAME" "$SYMBOL" "$IMAGE" "$DESC" "$META" "$CREATOR" "$FEE_COLLECTOR" \
  "$ANTI_BOOL" "$MAX_BOOL")

echo ""
echo "Verifying PumpRobinToken..."
forge verify-contract \
  --chain-id "$CHAIN_ID" \
  --rpc-url "$RPC" \
  --verifier blockscout \
  --verifier-url "$VERIFIER_URL" \
  --watch \
  --via-ir \
  --optimizer-runs 200 \
  --compiler-version 0.8.20 \
  "$TOKEN" \
  contracts/PumpRobinToken.sol:PumpRobinToken \
  --constructor-args "$TOKEN_ARGS" || echo "Token verify skipped/failed"

CURVE_HOOK=$(cast call "$CURVE" "hook()(address)" -r "$RPC" 2>/dev/null || echo "$HOOK")
CURVE_ARGS=$(cast abi-encode \
  "constructor(address,address,address,address,address,uint256,uint256)" \
  "$TOKEN" "$CREATOR" "$FACTORY" "$FEE_COLLECTOR" "$CURVE_HOOK" \
  "1300000000000000000" \
  "1073000000000000000000000000")

echo ""
echo "Verifying BondingCurve..."
forge verify-contract \
  --chain-id "$CHAIN_ID" \
  --rpc-url "$RPC" \
  --verifier blockscout \
  --verifier-url "$VERIFIER_URL" \
  --watch \
  --via-ir \
  --optimizer-runs 200 \
  --compiler-version 0.8.20 \
  "$CURVE" \
  contracts/BondingCurve.sol:BondingCurve \
  --constructor-args "$CURVE_ARGS" || echo "Curve verify skipped/failed"

echo ""
echo "Done. Check Blockscout:"
echo "  https://robinhoodchain.blockscout.com/address/$(echo "$TOKEN" | tr '[:upper:]' '[:lower:]')"
