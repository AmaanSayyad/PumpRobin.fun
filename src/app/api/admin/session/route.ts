import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAdminCookieName,
  isAdminPasswordConfigured,
  verifyAdminSessionToken,
} from "@/lib/admin-auth";

export async function GET() {
  if (!isAdminPasswordConfigured()) {
    return NextResponse.json({ authenticated: false, configured: false });
  }
  const jar = await cookies();
  const token = jar.get(getAdminCookieName())?.value;
  return NextResponse.json({
    authenticated: verifyAdminSessionToken(token),
    configured: true,
  });
}
