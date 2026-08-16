import { NextResponse } from "next/server";
import { pinJsonToIpfs } from "@/lib/pinata";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.PINATA_JWT) {
    return NextResponse.json(
      { error: "IPFS upload is not configured (missing PINATA_JWT)" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "JSON body required" }, { status: 400 });
    }
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : "pumprobin-token";
    const { cid, url } = await pinJsonToIpfs(body, `${name}-metadata.json`);
    return NextResponse.json({ cid, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
