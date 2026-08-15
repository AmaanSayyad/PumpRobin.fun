import { NextResponse } from "next/server";
import {
  fetchAllMarketTokens,
  fetchMarketTokens,
  serializeToken,
  type MarketTab,
} from "@/lib/market";

export const revalidate = 45;

const TABS = new Set<MarketTab>(["trending", "volume", "new", "gainers"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = (searchParams.get("tab") || "volume") as MarketTab | "all";

  try {
    const tokens =
      tab === "all"
        ? await fetchAllMarketTokens()
        : await fetchMarketTokens(TABS.has(tab) ? tab : "volume");

    return NextResponse.json({
      tokens: tokens.map(serializeToken),
      count: tokens.length,
      tab: tab === "all" || TABS.has(tab) ? tab : "volume",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Market fetch failed" },
      { status: 502 }
    );
  }
}
