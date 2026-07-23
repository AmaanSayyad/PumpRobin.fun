"use client";

import { use, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAccount, useConfig } from "wagmi";
import type { Address } from "viem";
import { useAppStore } from "@/lib/store";
import { CHAIN_CONFIG } from "@/lib/chain";
import { RhButton } from "@/components/ui/rh-button";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  cn,
  formatEth,
  formatPriceEth,
  shortenAddress,
  timeAgo,
} from "@/lib/utils";
import {
  executeUniswapSwap,
  getUniswapQuote,
} from "@/lib/uniswap-trade";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function TokenPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const { isConnected, address: wallet } = useAccount();
  const wagmiConfig = useConfig();
  const { tokens, trades, upsertToken, addTradeLocal, refreshTokens } =
    useAppStore();
  const token = tokens.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
  const tokenTrades = useMemo(
    () =>
      trades.filter(
        (t) => t.tokenAddress.toLowerCase() === address.toLowerCase()
      ),
    [trades, address]
  );

  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quoteOut, setQuoteOut] = useState<string | null>(null);
  const [quoteGasUsd, setQuoteGasUsd] = useState<string | null>(null);

  const chartData = useMemo(
    () =>
      [...tokenTrades]
        .reverse()
        .map((t, i) => ({
          time: i,
          price: t.price,
          volume: t.ethAmount,
        })),
    [tokenTrades]
  );

  useEffect(() => {
    if (!token?.graduated || !wallet || !amount || Number(amount) <= 0) {
      setQuoteOut(null);
      setQuoteGasUsd(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const q = await getUniswapQuote({
            swapper: wallet as Address,
            tokenAddress: token.address as Address,
            isBuy: tradeMode === "buy",
            amount,
          });
          if (cancelled) return;
          setQuoteOut(q.amountOutFormatted);
          setQuoteGasUsd(q.gasFeeUSD ?? null);
          setError("");
        } catch (err) {
          if (cancelled) return;
          setQuoteOut(null);
          setQuoteGasUsd(null);
          setError(err instanceof Error ? err.message : "Quote failed");
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [token?.graduated, token?.address, wallet, amount, tradeMode]);

  const submitTrade = async () => {
    if (!token || !wallet || !amount) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (token.graduated) {
        await executeUniswapSwap({
          config: wagmiConfig,
          swapper: wallet as Address,
          tokenAddress: token.address as Address,
          isBuy: tradeMode === "buy",
          amount,
        });
        setAmount("");
        setQuoteOut(null);
        void refreshTokens();
        return;
      }

      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: token.address,
          trader: wallet,
          isBuy: tradeMode === "buy",
          amount: amt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Trade failed");
      upsertToken({
        ...data.token,
        createdAt: new Date(data.token.createdAt),
      });
      addTradeLocal(
        {
          ...data.trade,
          timestamp: new Date(data.trade.timestamp),
        },
        {
          ...data.token,
          createdAt: new Date(data.token.createdAt),
        }
      );
      setAmount("");
      void refreshTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="rh-container py-24 text-center">
        <p className="rh-display text-3xl mb-4">Token not found</p>
        <Link href="/explore" className="text-rh-lime text-sm hover:underline">
          Back to Explore
        </Link>
      </div>
    );
  }

  const dexUrl = token.graduated
    ? `https://dexscreener.com/robinhood/${token.address}`
    : null;

  return (
    <div className="rh-container py-8 sm:py-12">
      <Link
        href="/explore"
        className="inline-flex items-center gap-2 text-sm text-rh-muted hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Explore
      </Link>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-rh-raised bg-rh-raised">
              {token.imageUri ? (
                <Image src={token.imageUri} alt={token.name} fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-rh-dim text-xs">
                  {token.symbol.slice(0, 3)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="rh-display text-3xl sm:text-4xl">{token.name}</h1>
                <span className="text-rh-muted">${token.symbol}</span>
                {dexUrl && (
                  <a
                    href={dexUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-rh-lime hover:underline"
                  >
                    DEX Screener <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="mt-1 font-mono text-xs text-rh-dim">
                {shortenAddress(token.address)}
              </p>
              <p className="mt-2 text-sm text-rh-muted">
                {formatPriceEth(token.price)} ETH
              </p>
            </div>
          </div>

          <div className="border border-rh-raised p-5 h-64">
            {chartData.length < 2 ? (
              <p className="text-sm text-rh-dim h-full flex items-center justify-center">
                Price chart appears after the first trades
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="p" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#CCFF00" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#CCFF00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: "#111",
                      border: "1px solid #333",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#CCFF00"
                    fill="url(#p)"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-rh-raised">
            {[
              { label: "Market cap", value: `${formatEth(token.marketCap)} ETH` },
              { label: "24h volume", value: `${formatEth(token.volume24h)} ETH` },
              { label: "Holders", value: String(token.holders) },
              { label: "ETH reserves", value: `${formatEth(token.ethReserves)} ETH` },
            ].map((s) => (
              <div key={s.label} className="bg-black p-4 text-center">
                <p className="text-xs text-rh-muted mb-1">{s.label}</p>
                <p className="text-sm font-medium">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="border border-rh-raised p-5">
            <ProgressBar value={token.progress} graduated={token.graduated} />
            <p className="text-xs text-rh-dim mt-2">
              {token.graduated
                ? "Graduated — Uniswap V3 1% TOKEN/WETH · LP locked. Trade via Uniswap routing."
                : `${formatEth(CHAIN_CONFIG.graduationThreshold - token.ethReserves)} ETH until graduation`}
            </p>
          </div>

          <div className="border border-rh-raised p-5">
            <h3 className="font-medium mb-4">Recent trades</h3>
            {tokenTrades.length === 0 ? (
              <p className="text-sm text-rh-dim">No trades yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {tokenTrades.map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between py-2 border-b border-rh-raised/50 text-sm last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {trade.isBuy ? (
                        <ArrowUpRight className="w-4 h-4 text-rh-lime" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-red-400" />
                      )}
                      <span className={trade.isBuy ? "text-rh-lime" : "text-red-400"}>
                        {trade.isBuy ? "Buy" : "Sell"}
                      </span>
                      <span className="text-rh-dim font-mono">
                        {shortenAddress(trade.trader)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p>{formatEth(trade.ethAmount)} ETH</p>
                      <p className="text-xs text-rh-dim">{timeAgo(trade.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-rh-raised p-5 sticky top-24">
            <div className="flex rounded-full overflow-hidden border border-rh-raised mb-4">
              <button
                type="button"
                onClick={() => setTradeMode("buy")}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium",
                  tradeMode === "buy" ? "bg-rh-lime text-rh-on-lime" : "text-rh-muted"
                )}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setTradeMode("sell")}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium",
                  tradeMode === "sell" ? "bg-white text-black" : "text-rh-muted"
                )}
              >
                Sell
              </button>
            </div>

            <label className="text-xs text-rh-muted mb-1.5 block">
              {tradeMode === "buy" ? "ETH amount" : "Token amount"}
            </label>
            <input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-rh-raised rounded-xl text-lg font-mono focus:outline-none focus:border-rh-lime mb-3"
            />

            <div className="flex gap-2 mb-4">
              {(tradeMode === "buy"
                ? ["0.01", "0.05", "0.1", "0.5"]
                : ["1", "10", "100", "1000"]
              ).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  className="flex-1 py-1.5 text-xs border border-rh-raised rounded-full hover:border-rh-lime/40 text-rh-muted"
                >
                  {v}
                </button>
              ))}
            </div>

            {token.graduated && quoteOut && (
              <p className="mb-3 text-xs text-rh-muted">
                Est. out{" "}
                <span className="tabular-nums text-rh-lime">
                  {Number(quoteOut).toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}{" "}
                  {tradeMode === "buy" ? token.symbol : "ETH"}
                </span>
                {quoteGasUsd ? (
                  <span className="text-rh-dim">
                    {" "}
                    · gas ~${Number(quoteGasUsd).toFixed(3)}
                  </span>
                ) : null}
              </p>
            )}

            <RhButton
              className="w-full"
              variant={tradeMode === "buy" ? "primary" : "ghost"}
              onClick={submitTrade}
              disabled={!isConnected || busy}
            >
              {busy
                ? token.graduated
                  ? "Swapping…"
                  : "Confirming…"
                : `${tradeMode === "buy" ? "Buy" : "Sell"} $${token.symbol}`}
            </RhButton>

            {error && <p className="text-xs text-red-400 mt-3 text-center">{error}</p>}
            {!isConnected && (
              <p className="text-xs text-rh-dim text-center mt-3">
                Connect wallet to trade
              </p>
            )}
            <p className="text-xs text-rh-dim text-center mt-3">
              {token.graduated
                ? "Uniswap V3 · 2.5% slippage · Trading API"
                : `${CHAIN_CONFIG.creatorFeeBps / 100}% creator + ${CHAIN_CONFIG.platformFeeBps / 100}% platform · Curve math`}
            </p>
          </div>

          <div className="border border-rh-raised p-5">
            <p className="text-xs text-rh-muted mb-1">Creator</p>
            <p className="font-mono text-sm">{shortenAddress(token.creator)}</p>
            <p className="text-xs text-rh-dim mt-2">Created {timeAgo(token.createdAt)}</p>
          </div>

          {token.description && (
            <div className="border border-rh-raised p-5">
              <p className="text-xs text-rh-muted mb-2">About</p>
              <p className="text-sm text-rh-muted leading-relaxed">{token.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
