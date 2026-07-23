import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  enrichToken,
  getPlatformStats,
  hourlyBuckets,
} from "@/lib/data";
import { readPlatformState } from "@/lib/registry";
import {
  getAdminCookieName,
  verifyAdminSessionToken,
} from "@/lib/admin-auth";

async function requireAdmin() {
  const jar = await cookies();
  const token = jar.get(getAdminCookieName())?.value;
  return verifyAdminSessionToken(token);
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await readPlatformState();
  const stats = getPlatformStats(state.tokens, state.trades);
  const tokens = state.tokens.map((t) => enrichToken(t, state.trades));

  return NextResponse.json({
    autoLaunchEnabled: state.autoLaunchEnabled,
    autoLaunchInterval: 5,
    lastAutoLaunch: state.lastAutoLaunch,
    nextAutoLaunch: state.autoLaunchEnabled
      ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
      : null,
    systemHealth: "healthy" as const,
    stats,
    tokens,
    recentLaunches: state.tokens.slice(0, 20).map((t) => ({
      name: t.name,
      symbol: t.symbol,
      type: "manual" as const,
      timestamp: t.createdAt,
      address: t.address,
      marketCap: enrichToken(t, state.trades).marketCap,
      progress: enrichToken(t, state.trades).progress,
    })),
    hourlyStats: hourlyBuckets(state.tokens, state.trades, 24),
    timestamp: new Date().toISOString(),
  });
}
