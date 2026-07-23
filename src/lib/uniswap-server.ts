import { NextResponse } from "next/server";

export const UNISWAP_TRADE_API = "https://trade-api.gateway.uniswap.org/v1";

/** Robinhood Chain has Universal Router 2.1.1 only (no 2.0). */
export const UNISWAP_ROUTER_VERSION = "2.1.1";

export const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function uniswapApiKey(): string | null {
  const key = process.env.UNISWAP_API_KEY?.trim();
  return key || null;
}

export function uniswapHeaders(): HeadersInit {
  const key = uniswapApiKey();
  if (!key) throw new Error("UNISWAP_API_KEY is not configured");
  return {
    "Content-Type": "application/json",
    "x-api-key": key,
    "x-universal-router-version": UNISWAP_ROUTER_VERSION,
  };
}

export function isAddress(value: unknown): value is string {
  return typeof value === "string" && ADDRESS_RE.test(value);
}

export function isAmount(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]+(\.[0-9]+)?$/.test(value) && Number(value) > 0;
}

export async function forwardUniswap(
  path: "quote" | "swap" | "check_approval",
  body: unknown
): Promise<NextResponse> {
  if (!uniswapApiKey()) {
    return NextResponse.json(
      { error: "Uniswap Trading API is not configured (set UNISWAP_API_KEY)" },
      { status: 503 }
    );
  }

  const res = await fetch(`${UNISWAP_TRADE_API}/${path}`, {
    method: "POST",
    headers: uniswapHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          data.detail ||
          data.message ||
          data.errorCode ||
          `Uniswap ${path} failed`,
        detail: data,
      },
      { status: res.status }
    );
  }
  return NextResponse.json(data);
}
