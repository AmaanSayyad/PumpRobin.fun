import { NextResponse } from "next/server";
import { addAlertSubscription, listAlertSubscriptions } from "@/lib/alerts";
import { CHAIN_CONFIG } from "@/lib/chain";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet") || undefined;
  try {
    const subs = await listAlertSubscriptions(wallet ?? undefined);
    return NextResponse.json({
      subscriptions: subs,
      pricing: {
        eth: CHAIN_CONFIG.alertsSubEth,
        usdHint: CHAIN_CONFIG.alertsSubUsdHint,
        days: CHAIN_CONFIG.alertsSubDays,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const wallet = String(body.wallet || "").toLowerCase();
    const txHash = String(body.txHash || "");
    const telegram = body.telegram ? String(body.telegram) : undefined;
    const discord = body.discord ? String(body.discord) : undefined;
    const email = body.email ? String(body.email) : undefined;

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json({ error: "Invalid tx hash" }, { status: 400 });
    }
    if (!telegram?.trim() && !discord?.trim()) {
      return NextResponse.json(
        { error: "Add a Telegram or Discord handle so we can reach you" },
        { status: 400 }
      );
    }

    const sub = await addAlertSubscription({
      wallet,
      telegram,
      discord,
      email,
      txHash,
      paidEth: Number(CHAIN_CONFIG.alertsSubEth),
      status: "pending",
    });

    return NextResponse.json({ subscription: sub });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Subscribe failed" },
      { status: 500 }
    );
  }
}
