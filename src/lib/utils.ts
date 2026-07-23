import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(decimals)}K`;
  if (Math.abs(n) > 0 && Math.abs(n) < 0.0001) return n.toExponential(2);
  return n.toFixed(decimals);
}

/** Format ETH amounts for UI (already in ETH units, not wei). */
export function formatEth(amount: number, decimals = 4): string {
  if (!Number.isFinite(amount) || amount === 0) return "0";
  if (Math.abs(amount) < 1e-6) return amount.toExponential(2);
  if (Math.abs(amount) < 0.0001) return amount.toFixed(8);
  return amount.toFixed(decimals);
}

export function formatPriceEth(price: number): string {
  if (!Number.isFinite(price) || price === 0) return "0 ETH";
  if (price < 1e-9) return `${price.toExponential(3)} ETH`;
  if (price < 1e-6) return `${price.toFixed(12)} ETH`;
  return `${price.toFixed(8)} ETH`;
}

export function shortenAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Short, user-facing wallet / viem errors (hide huge dumps). */
export function friendlyWalletError(err: unknown, fallback = "Something went wrong"): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : fallback;
  const lower = raw.toLowerCase();

  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request") ||
    lower.includes("request rejected") ||
    lower.includes("action_rejected")
  ) {
    return "Transaction cancelled in wallet.";
  }
  if (lower.includes("insufficient funds")) {
    return "Insufficient ETH for this transaction + gas.";
  }
  if (lower.includes("0 tokens") || lower.includes("buy on the curve first")) {
    return raw.length > 160 ? raw.slice(0, 160) : raw;
  }
  if (lower.includes("insufficient tokens")) {
    return raw.length > 160 ? raw.slice(0, 160) : raw;
  }
  if (lower.includes("network") && lower.includes("chain")) {
    return "Wrong network — switch to Robinhood Chain.";
  }
  if (lower.includes("slippage") || lower.includes("minTokens") || lower.includes("minEth")) {
    return "Price moved — try again with a slightly higher amount.";
  }

  // First meaningful line only, capped
  const line = raw.split("\n").map((l) => l.trim()).find(Boolean) || fallback;
  return line.length > 140 ? `${line.slice(0, 140)}…` : line;
}
