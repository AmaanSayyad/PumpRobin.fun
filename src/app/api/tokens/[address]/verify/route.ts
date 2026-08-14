import { after, NextResponse } from "next/server";
import { verifyLaunchedToken } from "@/lib/verify/blockscout";

export const maxDuration = 300;
export const runtime = "nodejs";

/** Submit token + bonding curve to Blockscout (HTTP, no Foundry on Vercel). */
export async function POST(
  _request: Request,
  context: { params: Promise<{ address: string }> }
) {
  const { address } = await context.params;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const token = address.toLowerCase();

  after(async () => {
    try {
      const results = await verifyLaunchedToken(token);
      console.info("[verify]", token, JSON.stringify(results));
    } catch (err) {
      console.error(
        "[verify] failed",
        token,
        err instanceof Error ? err.message : err
      );
    }
  });

  return NextResponse.json({
    ok: true,
    queued: true,
    address: token,
  });
}
