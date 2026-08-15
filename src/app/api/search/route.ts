import { NextResponse } from "next/server";
import { enrichToken } from "@/lib/data";
import { isHiddenToken } from "@/lib/data-client";
import { searchMarketTokens, serializeToken } from "@/lib/market";
import { readPlatformState } from "@/lib/registry";

export const revalidate = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ tokens: [], count: 0 });
  }

  try {
    const [market, state] = await Promise.all([
      searchMarketTokens(q),
      readPlatformState(),
    ]);
    const needle = q.toLowerCase();
    const local = state.tokens
      .filter(
        (t) =>
          t.name.toLowerCase().includes(needle) ||
          t.symbol.toLowerCase().includes(needle) ||
          t.address.toLowerCase().includes(needle)
      )
      .map((t) => enrichToken(t, state.trades));

    const seen = new Set<string>();
    const tokens = [...local, ...market].filter((t) => {
      const key = t.address.toLowerCase();
      if (isHiddenToken(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({
      tokens: tokens.map(serializeToken),
      count: tokens.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 502 }
    );
  }
}
