import { NextResponse } from "next/server";
import {
  dailyVolumeSeries,
  enrichToken,
  weeklyGraduations,
} from "@/lib/data";
import { getEcosystemStats } from "@/lib/ecosystem";
import { readPlatformState } from "@/lib/registry";

export async function GET() {
  const state = await readPlatformState();
  const stats = await getEcosystemStats();
  const tokens = state.tokens.map((t) => enrichToken(t, state.trades));

  const statusCounts = {
    active: tokens.filter((t) => !t.graduated).length,
    graduated: tokens.filter((t) => t.graduated).length,
  };

  return NextResponse.json({
    stats,
    volumeSeries: dailyVolumeSeries(state.trades, 14),
    graduationSeries: weeklyGraduations(state.tokens),
    statusPie: [
      { name: "Active Curves", value: statusCounts.active, color: "#CCFF00" },
      { name: "Graduated", value: statusCounts.graduated, color: "#00E5FF" },
    ].filter((d) => d.value > 0),
    timestamp: new Date().toISOString(),
  });
}
