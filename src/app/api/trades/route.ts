import { NextResponse } from "next/server";
import {
  applyFee,
  calculateBuyReturn,
  calculateSellReturn,
} from "@/lib/curve";
import { CHAIN_CONFIG } from "@/lib/chain";
import { enrichToken } from "@/lib/data";
import {
  addTrade,
  readPlatformState,
  updateTokenCurve,
} from "@/lib/registry";

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

export async function POST(request: Request) {
  const body = await request.json();
  const { tokenAddress, trader, isBuy, amount } = body as {
    tokenAddress: string;
    trader: string;
    isBuy: boolean;
    amount: number;
  };

  if (!tokenAddress || !trader || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Invalid trade request" }, { status: 400 });
  }

  const state = await readPlatformState();
  const token = state.tokens.find(
    (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
  if (token.graduated) {
    return NextResponse.json({ error: "Token has graduated" }, { status: 400 });
  }

  let ethAmount = 0;
  let tokenAmount = 0;
  let feeEth = 0;
  let virtualEth = token.virtualEthReserves;
  let virtualTokens = token.virtualTokenReserves;
  let realEth = token.realEthReserves;
  let realTokens = token.realTokenReserves;
  let graduated: boolean = token.graduated;

  if (isBuy) {
    ethAmount = amount;
    const { fee, afterFee } = applyFee(ethAmount);
    feeEth = fee;
    const result = calculateBuyReturn(afterFee, virtualEth, virtualTokens);
    if (result.tokensOut > realTokens) {
      return NextResponse.json({ error: "Insufficient curve tokens" }, { status: 400 });
    }
    tokenAmount = result.tokensOut;
    virtualEth = result.newVirtualEth;
    virtualTokens = result.newVirtualTokens;
    realEth += afterFee;
    realTokens -= tokenAmount;
  } else {
    tokenAmount = amount;
    const result = calculateSellReturn(tokenAmount, virtualEth, virtualTokens);
    const { fee, afterFee } = applyFee(result.ethOut);
    feeEth = fee;
    ethAmount = afterFee;
    if (afterFee > realEth) {
      return NextResponse.json({ error: "Insufficient ETH reserves" }, { status: 400 });
    }
    virtualEth = result.newVirtualEth;
    virtualTokens = result.newVirtualTokens;
    realEth -= result.ethOut;
    realTokens += tokenAmount;
  }

  if (realEth >= CHAIN_CONFIG.graduationThreshold) {
    graduated = true;
  }

  const price =
    virtualTokens > 0 ? virtualEth / virtualTokens : 0;

  const trade = {
    id: `${tokenAddress}-${Date.now()}`,
    tokenAddress,
    trader,
    isBuy,
    ethAmount,
    tokenAmount,
    price,
    feeEth,
    timestamp: new Date().toISOString(),
  };

  await updateTokenCurve(tokenAddress, {
    virtualEthReserves: virtualEth,
    virtualTokenReserves: virtualTokens,
    realEthReserves: realEth,
    realTokenReserves: realTokens,
    graduated,
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
