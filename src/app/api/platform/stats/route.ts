import { NextResponse } from "next/server";
import { getPlatformStats } from "@/lib/data";
import { readPlatformState } from "@/lib/registry";

/** Public platform stats — derived only from real registry data */
export async function GET() {
  const state = await readPlatformState();
  const stats = getPlatformStats(state.tokens, state.trades);
  return NextResponse.json({ stats });
}
