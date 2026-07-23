import { NextResponse } from "next/server";
import { pinFileToIpfs } from "@/lib/pinata";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

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

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPEG, WebP, or GIF images are allowed" },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image must be between 1 byte and 5 MB" },
        { status: 400 }
      );
    }

    const safeName = (file.name || "token-image.png")
      .replace(/[^\w.\-]+/g, "_")
      .slice(0, 80);

    const { cid, url } = await pinFileToIpfs(file, safeName);
    return NextResponse.json({ cid, url, gateway: url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
