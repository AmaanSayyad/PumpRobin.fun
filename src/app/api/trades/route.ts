import { NextResponse } from "next/server";
import { readPlatformState } from "@/lib/registry";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenAddress = searchParams.get("token");
  const state = await readPlatformState();
  const trades = tokenAddress
    ? state.trades.filter(
        (t) => t.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
      )
    : state.trades;
  return NextResponse.json({ trades });
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Off-chain trade simulation is disabled. Settle on Uniswap or the factory, then index with POST /api/trades/sync and a confirmed txHash.",
    },
    { status: 405 }
  );
}
