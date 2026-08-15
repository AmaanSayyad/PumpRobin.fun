import { NextResponse } from "next/server";
import { resolveAnyToken, serializeToken } from "@/lib/market";

export const revalidate = 30;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const token = await resolveAnyToken(address);
  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
  return NextResponse.json({ token: serializeToken(token) });
}
