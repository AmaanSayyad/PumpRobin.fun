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

/** Compact USD for UI labels */
export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return "$0";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `$${(amount / 1000).toFixed(1)}K`;
  if (abs >= 1000) return `$${amount.toFixed(0)}`;
  if (abs >= 1) return `$${amount.toFixed(2)}`;
  if (abs >= 0.01) return `$${amount.toFixed(2)}`;
  return `$${amount.toFixed(3)}`;
}

export function ethToUsd(eth: number, ethUsd: number): number {
  if (!Number.isFinite(eth) || !Number.isFinite(ethUsd)) return 0;
  return eth * ethUsd;
}

/** Human ETH amount string (no unit). */
export function formatEthAmount(amount: number, decimals = 4): string {
  if (!Number.isFinite(amount) || amount === 0) return "0";
  if (Math.abs(amount) < 1e-6) return amount.toExponential(2);
  if (Math.abs(amount) < 0.0001) return amount.toFixed(8);
  if (Math.abs(amount) < 1) return amount.toFixed(decimals).replace(/\.?0+$/, "");
  return amount.toFixed(Math.min(decimals, 2));
}

/** "0.0124 ETH (~$31.02)" */
export function formatEthWithUsd(
  eth: number | string,
  ethUsd: number | null | undefined,
  decimals = 4
): string {
  const n = typeof eth === "string" ? Number(eth) : eth;
  if (!Number.isFinite(n)) return "—";
  const ethPart = `${formatEthAmount(n, decimals)} ETH`;
  if (ethUsd == null || !Number.isFinite(ethUsd)) return ethPart;
  return `${ethPart} (~${formatUsd(ethToUsd(n, ethUsd))})`;
}

/** Format ETH amounts for UI (already in ETH units, not wei). */
export function formatEth(amount: number, decimals = 4): string {
  if (!Number.isFinite(amount) || amount === 0) return "0";
  if (Math.abs(amount) < 1e-6) return amount.toExponential(2);
  if (Math.abs(amount) < 0.0001) return amount.toFixed(8);
  return amount.toFixed(decimals);
}

/** Compact token amount for quotes (handles huge meme supplies). */
export function formatTokenAmount(amount: string | number): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n) || n === 0) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (Math.abs(n) < 0.0001) return n.toExponential(2);
  if (Math.abs(n) < 1) return n.toFixed(6).replace(/\.?0+$/, "");
  return n.toFixed(2);
}

/** Uniswap quote gasFeeUSD → readable "$0.005" */
export function formatGasUsd(usd: string | number): string {
  const n = typeof usd === "number" ? usd : Number(usd);
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(3)}`;
  if (n < 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(2)}`;
}

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

function toSubscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUBSCRIPT_DIGITS[Number(d)] ?? d)
    .join("");
}

/** Memecoin-style tiny prices: 0.0₁₀1946 ETH instead of 1.946e-11 ETH */
export function formatPriceEth(price: number): string {
  if (!Number.isFinite(price) || price === 0) return "0 ETH";
  if (price >= 0.0001) {
    return `${price.toFixed(8).replace(/\.?0+$/, "")} ETH`;
  }
  const str = price.toFixed(24);
  const match = str.match(/^0\.(0+)([1-9]\d*)/);
  if (match) {
    const zeroCount = match[1].length;
    const sig = match[2].slice(0, 4);
    return `0.0${toSubscript(zeroCount)}${sig} ETH`;
  }
  if (price >= 1e-6) return `${price.toFixed(12).replace(/\.?0+$/, "")} ETH`;
  return `${price.toPrecision(4)} ETH`;
}

export function shortenAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

export function timeAgo(date: Date | string | number): string {
  const ms =
    date instanceof Date
      ? date.getTime()
      : typeof date === "number"
        ? date
        : new Date(date).getTime();
  if (!Number.isFinite(ms)) return "—";
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return `${Math.max(0, seconds)}s ago`;
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
