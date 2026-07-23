import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setAutoLaunch } from "@/lib/registry";
import {
  getAdminCookieName,
  verifyAdminSessionToken,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  const jar = await cookies();
  if (!verifyAdminSessionToken(jar.get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { enabled } = await request.json();
  const state = await setAutoLaunch(Boolean(enabled));

  return NextResponse.json({
    autoLaunchEnabled: state.autoLaunchEnabled,
    autoLaunchInterval: 5,
    lastAutoLaunch: state.lastAutoLaunch,
    nextAutoLaunch: state.autoLaunchEnabled
      ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
      : null,
    message: state.autoLaunchEnabled
      ? "Auto-launch enabled. Requires factory + cron to mint."
      : "Auto-launch disabled.",
  });
}
