import { NextRequest } from "next/server";
import { forwardUniswap, uniswapApiKey } from "@/lib/uniswap-server";

/**
 * Proxy Uniswap Trading API /swap — body must be the quote response spread
 * (not wrapped in { quote }). Permit2 null fields are stripped server-side.
 * @see https://developers.uniswap.org/docs/trading/swapping-api/getting-started
 */
export async function POST(req: NextRequest) {
  if (!uniswapApiKey()) {
    return Response.json(
      { error: "Uniswap Trading API is not configured (set UNISWAP_API_KEY)" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const quoteResponse = body as Record<string, unknown>;
  const { permitData, permitTransaction, signature, ...cleanQuote } = quoteResponse;

  const routing = String(quoteResponse.routing || "");
  const isUniswapX =
    routing === "DUTCH_V2" || routing === "DUTCH_V3" || routing === "PRIORITY";

  const swapRequest: Record<string, unknown> = { ...cleanQuote };

  if (isUniswapX) {
    if (typeof signature === "string" && signature) {
      swapRequest.signature = signature;
    }
  } else if (
    typeof signature === "string" &&
    signature &&
    permitData &&
    typeof permitData === "object"
  ) {
    swapRequest.signature = signature;
    swapRequest.permitData = permitData;
  }
  // Never forward permitData: null or unused permitTransaction

  void permitTransaction;
  return forwardUniswap("swap", swapRequest);
}
