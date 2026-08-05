import { NextResponse } from "next/server";
import { pinFileToIpfs } from "@/lib/pinata";
import { normalizeImageUpload } from "@/lib/normalize-image";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.PINATA_JWT) {
    return NextResponse.json(
      { error: "IPFS upload is not configured (missing PINATA_JWT)" },
      { status: 503 }
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const normalized = await normalizeImageUpload(file);
    const { cid, url } = await pinFileToIpfs(
      normalized.blob,
      normalized.filename
    );
    return NextResponse.json({
      cid,
      url,
      gateway: url,
      mime: normalized.mime,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    const status =
      /unsupported|must be between|required/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
