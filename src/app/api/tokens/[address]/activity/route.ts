import { NextResponse } from "next/server";
import { DEFAULT_SUPPLY } from "@/lib/curve";
import { fetchTokenActivity } from "@/lib/token-activity";
import { resolveAnyToken } from "@/lib/market";

export const revalidate = 20;

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
  const activity = await fetchTokenActivity({
    address,
    pool: token?.metadata?.uniswapPool,
    supply: market ? 0 : token?.metadata?.supply ?? DEFAULT_SUPPLY,
    creator: token?.creator,
    bondingCurve: token?.bondingCurve,
    priceEth: token?.price,
  });

  return NextResponse.json({
    holders: activity.holders,
    holderCount: activity.holderCount,
    trades: activity.trades,
  });
}
