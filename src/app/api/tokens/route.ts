import { after, NextResponse } from "next/server";
import { enrichToken, pickSocialMetadata, type LaunchMetadata } from "@/lib/data";
import { addToken, readPlatformState } from "@/lib/registry";
import { verifyLaunchedToken } from "@/lib/verify/blockscout";
import {
  LaunchVerifyError,
  verifyFactoryCreateTx,
} from "@/lib/verify-launch";

export const maxDuration = 300;

export async function GET() {
  const state = await readPlatformState();
  const tokens = state.tokens.map((t) => enrichToken(t, state.trades));
  return NextResponse.json({
    tokens,
    trades: state.trades,
    count: tokens.length,
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const txHash = typeof body.txHash === "string" ? body.txHash.trim() : "";
  if (!txHash) {
    return NextResponse.json(
      {
        error:
          "Indexing requires txHash from a confirmed PumpRobinFactory.createToken transaction. The creation fee is paid on-chain — unsigned metadata is rejected.",
      },
      { status: 401 }
    );
  }

  let launch;
  try {
    launch = await verifyFactoryCreateTx(txHash);
  } catch (err) {
    if (err instanceof LaunchVerifyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not verify launch tx" },
      { status: 502 }
    );
  }

  const claimedAddress =
    typeof body.address === "string" ? body.address.trim().toLowerCase() : "";
  if (claimedAddress && claimedAddress !== launch.token.toLowerCase()) {
    return NextResponse.json(
      { error: "address does not match the TokenCreated event" },
      { status: 400 }
    );
  }

  const state = await readPlatformState();
  const existing = state.tokens.find(
    (t) => t.address.toLowerCase() === launch.token.toLowerCase()
  );
  if (existing) {
    return NextResponse.json({ token: enrichToken(existing, state.trades) });
  }

  const meta = (body.metadata ?? {}) as LaunchMetadata;
  const description =
    typeof body.description === "string" ? body.description : "";
  const imageUri =
    launch.imageUri ||
    (typeof body.imageUri === "string" ? body.imageUri : "");

  const token = await addToken({
    name: launch.name,
    symbol: launch.symbol,
    imageUri,
    description,
    creator: launch.creator,
    address: launch.token,
    bondingCurve: launch.bondingCurve,
    txHash: launch.txHash,
    source: "onchain",
    graduated: true,
    uniswapPool:
      typeof body.uniswapPool === "string" ? body.uniswapPool : undefined,
    realEthReserves:
      typeof body.realEthReserves === "number" ? body.realEthReserves : undefined,
    metadata: {
      ...pickSocialMetadata(meta),
      bannerUri: meta.bannerUri ? String(meta.bannerUri) : undefined,
      communityCoin: Boolean(meta.communityCoin),
      communityBoard: Boolean(meta.communityBoard),
      antiSnipe: Boolean(meta.instantLaunch ?? meta.antiSnipe),
      instantLaunch: true,
      maxWallet2pct: Boolean(meta.maxWallet2pct),
      customSupply: Boolean(meta.customSupply),
      supply: meta.supply ? Number(meta.supply) : undefined,
      decimals: meta.decimals ? Number(meta.decimals) : 18,
      initialBuyEth: meta.initialBuyEth ? Number(meta.initialBuyEth) : undefined,
      ownershipPct: meta.ownershipPct ? Number(meta.ownershipPct) : undefined,
      feeSharing: Boolean(meta.feeSharing),
      feeShares: Array.isArray(meta.feeShares)
        ? meta.feeShares
            .map((s: { address?: string; pct?: number }) => ({
              address: String(s?.address || "").trim(),
              pct: Number(s?.pct) || 0,
            }))
            .filter((s: { address: string; pct: number }) => s.address && s.pct > 0)
            .slice(0, 100)
        : undefined,
    },
  });

  const next = await readPlatformState();
  after(async () => {
    try {
      const results = await verifyLaunchedToken(launch.token.toLowerCase());
      console.info("[verify]", launch.token, JSON.stringify(results));
    } catch (err) {
      console.error(
        "[verify] failed",
        launch.token,
        err instanceof Error ? err.message : err
      );
    }
  });

  return NextResponse.json(
    { token: enrichToken(token, next.trades) },
    { status: 201 }
  );
}
