import { NextResponse } from "next/server";
import { enrichToken, tradeExecutionPrice } from "@/lib/data";
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

  const execPrice = tradeExecutionPrice({
    ethAmount,
    tokenAmount: Number(tokenAmount) || 0,
    price: Number(price) || 0,
  });

  const trade = {
    id: txHash
      ? `${tokenAddress}-${txHash}`
      : `${tokenAddress}-${Date.now()}`,
    tokenAddress,
    trader,
    isBuy: Boolean(isBuy),
    ethAmount,
    tokenAmount: Number(tokenAmount) || 0,
    price: execPrice,
    feeEth: Number(feeEth) || 0,
    timestamp: new Date().toISOString(),
  };

  const isGraduated = Boolean(graduated ?? token.graduated);

  await updateTokenCurve(tokenAddress, {
    ...(virtualEthReserves != null ? { virtualEthReserves } : {}),
    ...(virtualTokenReserves != null ? { virtualTokenReserves } : {}),
    ...(realEthReserves != null ? { realEthReserves } : {}),
    ...(realTokenReserves != null ? { realTokenReserves } : {}),
    graduated: isGraduated,
    metadata: (() => {
      const supply = token.metadata?.supply ?? 1_000_000_000;
      const mcap = execPrice * supply;
      const launchFdv = (1.3 / 1_073_000_000) * supply;
      const prevAth = token.metadata?.athMarketCapEth ?? 0;
      const prevAthIsVirtualFloor =
        isGraduated &&
        prevAth > 0 &&
        Math.abs(prevAth - launchFdv) / launchFdv < 0.05;
      const athMarketCapEth = Math.max(
        prevAthIsVirtualFloor ? 0 : prevAth,
        mcap
      );
      return {
        ...token.metadata,
        ...(uniswapPool ? { uniswapPool } : {}),
        ...(execPrice > 0 && isGraduated
          ? { spotPriceEth: execPrice, spotAt: new Date().toISOString() }
          : {}),
        athMarketCapEth,
        athAt:
          athMarketCapEth > (prevAthIsVirtualFloor ? 0 : prevAth)
            ? new Date().toISOString()
            : token.metadata?.athAt,
      };
    })(),
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
