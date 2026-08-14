import { NextResponse } from "next/server";
import { DEFAULT_SUPPLY } from "@/lib/curve";
import { readPlatformState } from "@/lib/registry";
import { fetchTokenTopHolders } from "@/lib/uniswap-pool";

export async function GET(
  _request: Request,
  context: { params: Promise<{ address: string }> }
) {
  const { address } = await context.params;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const state = await readPlatformState();
  const token = state.tokens.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  const holders = await fetchTokenTopHolders(token.address, 10, {
    supply: token.metadata?.supply ?? DEFAULT_SUPPLY,
    creator: token.creator,
    bondingCurve: token.bondingCurve,
    uniswapPool: token.metadata?.uniswapPool,
  });

  return NextResponse.json({ holders });
}
