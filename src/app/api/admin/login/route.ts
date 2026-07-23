import { NextResponse } from "next/server";
import {
  adminCookieOptions,
  createAdminSessionToken,
  getAdminCookieName,
  isAdminPasswordConfigured,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!isAdminPasswordConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not set in environment" },
      { status: 503 }
    );
  }

  const { password } = await request.json();
  if (!password || !verifyAdminPassword(String(password))) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = createAdminSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getAdminCookieName(), token, adminCookieOptions());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getAdminCookieName(), "", adminCookieOptions(0));
  return res;
}
