import { NextResponse } from "next/server";
import type { Address } from "viem";
import { enrichToken, tradeExecutionPrice } from "@/lib/data";
import { readBondingCurveOnChain } from "@/lib/onchain-curve";
import {
  fetchTokenHoldersCount,
  fetchUniswapPoolSwaps,
  readUniswapPoolSpot,
  swapsToTradeRecords,
} from "@/lib/uniswap-pool";
import { readDeadTokenBalance } from "@/lib/onchain-token";
import {
  addTradesIfNew,
  readPlatformState,
  updateTokenCurve,
} from "@/lib/registry";
import { DEFAULT_SUPPLY } from "@/lib/curve";

/**
 * Pull live bonding-curve / Uniswap pool state from chain into the registry.
 * Graduated tokens: pool spot + Swap events → recent trades.
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
    const poolAddr =
      live.uniswapPool ||
      token.metadata?.uniswapPool ||
      null;

    let spotPrice = live.price;
    let liquidityEth: number | undefined;
    let pooledWeth: number | undefined;
    let pooledToken: number | undefined;
    let swapsIndexed = 0;

    if (live.graduated && poolAddr) {
      try {
        const spot = await readUniswapPoolSpot(
          poolAddr as Address,
          token.address as Address
        );
        if (spot.priceEth > 0) spotPrice = spot.priceEth;
        liquidityEth = spot.liquidityEth;
        pooledWeth = spot.pooledWeth;
        pooledToken = spot.pooledToken;
      } catch {
        /* keep curve getPrice fallback */
      }

      try {
        const swaps = await fetchUniswapPoolSwaps({
          pool: poolAddr as Address,
          token: token.address as Address,
        });
        const records = swapsToTradeRecords(token.address, swaps);
        const { added } = await addTradesIfNew(records);
        swapsIndexed = added;
      } catch (err) {
        console.error("[refresh] Uniswap swap index failed:", err);
      }
    }

    const afterSwaps = await readPlatformState();
    const tokenTrades = afterSwaps.trades.filter(
      (t) => t.tokenAddress.toLowerCase() === token.address.toLowerCase()
    );

    const launchFdv = (1.3 / 1_073_000_000) * supply;
    const prevAth = token.metadata?.athMarketCapEth ?? 0;
    const prevAthIsVirtualFloor =
      live.graduated &&
      prevAth > 0 &&
      Math.abs(prevAth - launchFdv) / launchFdv < 0.05;

    let deadSupply: number | undefined;
    if (live.graduated) {
      try {
        deadSupply = await readDeadTokenBalance(token.address as Address);
      } catch {
        /* best-effort */
      }
    }

    const circulating =
      deadSupply != null ? Math.max(0, supply - deadSupply) : supply;
    const mostlyBurned = deadSupply != null && deadSupply >= supply * 0.5;
    const mcapFdv = spotPrice * supply;
    const mcapCirculating = spotPrice * circulating;
    const mcap = mostlyBurned ? mcapCirculating : mcapFdv;
    const athSupply = mostlyBurned ? circulating : supply;
    const prevAthIsFdvBased =
      mostlyBurned &&
      mcapFdv > 0 &&
      prevAth > 0 &&
      Math.abs(prevAth - mcapFdv) / mcapFdv < 0.15;

    let athFromTrades = 0;
    for (const t of tokenTrades) {
      const px = tradeExecutionPrice(t);
      if (px > 0) athFromTrades = Math.max(athFromTrades, px * athSupply);
    }

    const ignorePrevAth =
      prevAthIsVirtualFloor || prevAthIsFdvBased;
    const athMarketCapEth = live.graduated
      ? Math.max(mcap, athFromTrades, ignorePrevAth ? 0 : prevAth)
      : Math.max(prevAth, mcap, launchFdv, athFromTrades);

    const holdersCount = live.graduated
      ? await fetchTokenHoldersCount(token.address)
      : null;

    const updated = await updateTokenCurve(token.address, {
      virtualEthReserves: live.virtualEthReserves,
      virtualTokenReserves: live.virtualTokenReserves,
      realEthReserves: live.realEthReserves,
      realTokenReserves: live.realTokenReserves,
      graduated: live.graduated,
      metadata: {
        ...token.metadata,
        ...(poolAddr ? { uniswapPool: poolAddr } : {}),
        ...(live.graduated && spotPrice > 0
          ? {
              spotPriceEth: spotPrice,
              spotAt: new Date().toISOString(),
              ...(liquidityEth != null ? { liquidityEth } : {}),
              ...(pooledWeth != null ? { pooledWeth } : {}),
              ...(pooledToken != null ? { pooledToken } : {}),
            }
          : {}),
        ...(holdersCount != null ? { holdersCount } : {}),
        ...(deadSupply != null ? { deadSupply } : {}),
        athMarketCapEth,
        athAt:
          athMarketCapEth > (ignorePrevAth ? 0 : prevAth)
            ? new Date().toISOString()
            : token.metadata?.athAt,
      },
    });

    const next = await readPlatformState();
    const record =
      updated ??
      next.tokens.find(
        (t) => t.address.toLowerCase() === address.toLowerCase()
      )!;

    return NextResponse.json({
      token: enrichToken(record, next.trades),
      trades: next.trades
        .filter(
          (t) => t.tokenAddress.toLowerCase() === address.toLowerCase()
        )
        .slice(0, 50),
      live: {
        ...live,
        price: spotPrice,
        liquidityEth,
        pooledWeth,
        pooledToken,
        holdersCount,
        swapsIndexed,
      },
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
