import { NextResponse } from "next/server";
import { enrichToken, pickSocialMetadata, type LaunchMetadata } from "@/lib/data";
import { addToken, readPlatformState } from "@/lib/registry";

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
  const body = await request.json();
  const {
    name,
    symbol,
    imageUri,
    description,
    creator,
    address,
    bondingCurve,
    txHash,
    source,
    metadata,
  } = body;

  if (!name || !symbol || !creator) {
    return NextResponse.json(
      { error: "name, symbol, and creator are required" },
      { status: 400 }
    );
  }

  const meta = (metadata ?? {}) as LaunchMetadata;

  const token = await addToken({
    name: String(name),
    symbol: String(symbol),
    imageUri: String(imageUri || ""),
    description: String(description || ""),
    creator: String(creator),
    address,
    bondingCurve,
    txHash,
    source: source === "onchain" ? "onchain" : "registry",
    metadata: {
      ...pickSocialMetadata(meta),
      bannerUri: meta.bannerUri ? String(meta.bannerUri) : undefined,
      communityCoin: Boolean(meta.communityCoin),
      communityBoard: Boolean(meta.communityBoard),
      antiSnipe: Boolean(meta.antiSnipe),
      maxWallet2pct: Boolean(meta.maxWallet2pct),
      customSupply: Boolean(meta.customSupply),
      supply: meta.supply ? Number(meta.supply) : undefined,
      decimals: meta.decimals ? Number(meta.decimals) : 18,
      initialBuyEth: meta.initialBuyEth ? Number(meta.initialBuyEth) : undefined,
      ownershipPct: meta.ownershipPct ? Number(meta.ownershipPct) : undefined,
      feeSharing: Boolean(meta.feeSharing),
      feeShares: Array.isArray(meta.feeShares)
        ? meta.feeShares
            .map((s) => ({
              address: String(s?.address || "").trim(),
              pct: Number(s?.pct) || 0,
            }))
            .filter((s) => s.address && s.pct > 0)
            .slice(0, 100)
        : undefined,
    },
  });

  const state = await readPlatformState();
  return NextResponse.json({ token: enrichToken(token, state.trades) }, { status: 201 });
}
