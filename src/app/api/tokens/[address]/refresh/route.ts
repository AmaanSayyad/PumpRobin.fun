import { NextResponse } from "next/server";
import type { Address } from "viem";
import { enrichToken } from "@/lib/data";
import { readBondingCurveOnChain } from "@/lib/onchain-curve";
import { readPlatformState, updateTokenCurve } from "@/lib/registry";
import { DEFAULT_SUPPLY } from "@/lib/curve";

/**
 * Pull live bonding-curve reserves from chain into the registry.
 * Fixes stale holders/mcap/raised when createAndBuy indexed incompletely.
 */
export async function POST(
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
  if (!token.bondingCurve) {
    return NextResponse.json({ error: "No bonding curve" }, { status: 400 });
  }

  try {
    const live = await readBondingCurveOnChain(
      token.bondingCurve as Address
    );
    const supply = token.metadata?.supply ?? DEFAULT_SUPPLY;
    const mcap = live.price * supply;
    const prevAth = token.metadata?.athMarketCapEth ?? 0;
    const athMarketCapEth = Math.max(prevAth, mcap);

    const updated = await updateTokenCurve(token.address, {
      virtualEthReserves: live.virtualEthReserves,
      virtualTokenReserves: live.virtualTokenReserves,
      realEthReserves: live.realEthReserves,
      realTokenReserves: live.realTokenReserves,
      graduated: live.graduated,
      metadata: {
        ...token.metadata,
        ...(live.uniswapPool ? { uniswapPool: live.uniswapPool } : {}),
        athMarketCapEth,
        athAt:
          athMarketCapEth > prevAth
            ? new Date().toISOString()
            : token.metadata?.athAt,
      },
    });

    const next = await readPlatformState();
    const record = updated ?? next.tokens.find(
      (t) => t.address.toLowerCase() === address.toLowerCase()
    )!;

    return NextResponse.json({
      token: enrichToken(record, next.trades),
      live,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "On-chain refresh failed",
      },
      { status: 502 }
    );
  }
}
