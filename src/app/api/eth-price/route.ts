import { NextResponse } from "next/server";
import { CHAIN_CONFIG } from "@/lib/chain";
import { fetchEthUsdPrice } from "@/lib/eth-usd";

export async function GET() {
  try {
    const usd = await fetchEthUsdPrice();
    return NextResponse.json({ usd, source: "live" });
  } catch {
    return NextResponse.json({
      usd: CHAIN_CONFIG.ethUsdFallback,
      source: "fallback",
    });
  }
}
