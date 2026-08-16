import { NextResponse } from "next/server";
import { DEFAULT_SUPPLY } from "@/lib/curve";
import { fetchTokenTopHolders } from "@/lib/uniswap-pool";
import { resolveAnyToken } from "@/lib/market";

export async function GET(
  _request: Request,
  context: { params: Promise<{ address: string }> }
) {
  const { address } = await context.params;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const token = await resolveAnyToken(address).catch(() => null);
  const market = token?.source === "market";
  const holders = await fetchTokenTopHolders(address, 10, {
    supply: market ? 0 : token?.metadata?.supply ?? DEFAULT_SUPPLY,
    creator: token?.creator,
    bondingCurve: token?.bondingCurve,
    uniswapPool: token?.metadata?.uniswapPool,
    tokenAddress: address,
  });

  return NextResponse.json({ holders });
}
