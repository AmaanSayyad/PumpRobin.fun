import { NextResponse } from "next/server";
import { DEFAULT_SUPPLY } from "@/lib/curve";
import { fetchTokenActivity } from "@/lib/token-activity";
import { resolveAnyToken } from "@/lib/market";
import { readBondingCurveOnChain } from "@/lib/onchain-curve";
import type { Address } from "viem";

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
  let pool = token?.metadata?.uniswapPool || null;
  if (!pool && token?.bondingCurve) {
    try {
      const live = await readBondingCurveOnChain(token.bondingCurve as Address);
      pool = live.uniswapPool;
    } catch {
      pool = null;
    }
  }
  const activity = await fetchTokenActivity({
    address,
    pool,
    supply: market ? 0 : token?.metadata?.supply ?? DEFAULT_SUPPLY,
    creator: token?.creator,
    bondingCurve: token?.bondingCurve,
    priceEth: token?.price,
  });

  return NextResponse.json({
    holders: activity.holders,
    holderCount: activity.holderCount,
    trades: activity.trades,
    volume24hEth: activity.volume24hEth,
  });
}
