import { NextRequest } from "next/server";
import { robinhoodChain } from "@/lib/chain";
import { forwardUniswap, isAddress, isAmount } from "@/lib/uniswap-server";

/**
 * Proxy Uniswap Trading API /check_approval
 * @see https://developers.uniswap.org/docs/api-reference/check_approval
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { walletAddress, token, amount } = body as Record<string, unknown>;
  if (!isAddress(walletAddress) || !isAddress(token) || !isAmount(String(amount))) {
    return Response.json(
      { error: "walletAddress, token must be addresses; amount must be a positive wei string" },
      { status: 400 }
    );
  }

  return forwardUniswap("check_approval", {
    walletAddress,
    token,
    amount: String(amount),
    chainId: robinhoodChain.id,
  });
}
