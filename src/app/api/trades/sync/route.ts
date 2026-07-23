import { NextResponse } from "next/server";
import { enrichToken } from "@/lib/data";
import {
  addTrade,
  readPlatformState,
  updateTokenCurve,
} from "@/lib/registry";

/**
 * Index an on-chain bonding-curve trade into the registry + sync reserves.
 * Called after a successful BondingCurve.buy / .sell wallet tx.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const {
    tokenAddress,
    trader,
    isBuy,
    ethAmount,
    tokenAmount,
    price,
    feeEth,
    txHash,
    virtualEthReserves,
    virtualTokenReserves,
    realEthReserves,
    realTokenReserves,
    graduated,
    uniswapPool,
  } = body as {
    tokenAddress: string;
    trader: string;
    isBuy: boolean;
    ethAmount: number;
    tokenAmount: number;
    price: number;
    feeEth?: number;
    txHash?: string;
    virtualEthReserves?: number;
    virtualTokenReserves?: number;
    realEthReserves?: number;
    realTokenReserves?: number;
    graduated?: boolean;
    uniswapPool?: string | null;
  };

  if (!tokenAddress || !trader || typeof ethAmount !== "number") {
    return NextResponse.json({ error: "Invalid sync payload" }, { status: 400 });
  }

  const state = await readPlatformState();
  const token = state.tokens.find(
    (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  const trade = {
    id: txHash
      ? `${tokenAddress}-${txHash}`
      : `${tokenAddress}-${Date.now()}`,
    tokenAddress,
    trader,
    isBuy: Boolean(isBuy),
    ethAmount,
    tokenAmount: Number(tokenAmount) || 0,
    price: Number(price) || 0,
    feeEth: Number(feeEth) || 0,
    timestamp: new Date().toISOString(),
  };

  await updateTokenCurve(tokenAddress, {
    virtualEthReserves: virtualEthReserves ?? token.virtualEthReserves,
    virtualTokenReserves: virtualTokenReserves ?? token.virtualTokenReserves,
    realEthReserves: realEthReserves ?? token.realEthReserves,
    realTokenReserves: realTokenReserves ?? token.realTokenReserves,
    graduated: graduated ?? token.graduated,
    metadata: uniswapPool
      ? { ...token.metadata, uniswapPool }
      : token.metadata,
  });

  await addTrade(trade);

  const next = await readPlatformState();
  const updated = next.tokens.find(
    (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
  )!;

  return NextResponse.json({
    trade,
    token: enrichToken(updated, next.trades),
  });
}
