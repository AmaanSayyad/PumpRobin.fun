import { NextResponse } from "next/server";
import { buildWalletProfile } from "@/lib/wallet-analytics";
import { readPlatformState } from "@/lib/registry";

export async function GET(
  _request: Request,
  context: { params: Promise<{ address: string }> }
) {
  const { address } = await context.params;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const state = await readPlatformState();
  const profile = buildWalletProfile(address, state.tokens, state.trades);

  return NextResponse.json({ profile });
}
