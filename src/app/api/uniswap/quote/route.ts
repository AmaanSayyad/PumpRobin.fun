import { NextRequest } from "next/server";
import { robinhoodChain } from "@/lib/chain";
import {
  forwardUniswap,
  isAddress,
  isAmount,
  NATIVE_ETH,
} from "@/lib/uniswap-server";

/**
 * Proxy Uniswap Trading API /quote (server-side key; Robinhood = UR 2.1.1).
 * @see https://developers.uniswap.org/docs/trading/swapping-api/getting-started
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    swapper,
    tokenIn,
    tokenOut,
    amount,
    type = "EXACT_INPUT",
    slippageTolerance = 2.5,
  } = body as Record<string, unknown>;

  if (!isAddress(swapper) || !isAddress(tokenIn) || !isAddress(tokenOut) || !isAmount(String(amount))) {
    return Response.json(
      { error: "swapper, tokenIn, tokenOut must be addresses; amount must be a positive number string (wei)" },
      { status: 400 }
    );
  }

  if (tokenIn !== NATIVE_ETH && tokenOut !== NATIVE_ETH && tokenIn === tokenOut) {
    return Response.json({ error: "tokenIn and tokenOut must differ" }, { status: 400 });
  }

  return forwardUniswap("quote", {
    type,
    amount: String(amount),
    tokenIn,
    tokenOut,
    tokenInChainId: String(robinhoodChain.id),
    tokenOutChainId: String(robinhoodChain.id),
    swapper,
    routingPreference: "BEST_PRICE",
    slippageTolerance,
    protocols: ["V3", "V2", "V4"],
  });
}
