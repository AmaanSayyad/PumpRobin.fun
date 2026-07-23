"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useConfig } from "wagmi";
import type { Address } from "viem";
import { useAppStore } from "@/lib/store";
import {
  CHAIN_CONFIG,
  explorerAddressUrl,
  explorerTxUrl,
} from "@/lib/chain";
import { RhButton } from "@/components/ui/rh-button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TokenLogo } from "@/components/token-logo";
import { TokenChart } from "@/components/token-chart";
import {
  cn,
  formatEth,
  formatPriceEth,
  friendlyWalletError,
  shortenAddress,
  timeAgo,
} from "@/lib/utils";
import {
  executeUniswapSwap,
  getUniswapQuote,
} from "@/lib/uniswap-trade";
import { executeCurveTrade } from "@/lib/curve-trade";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Copy,
  ExternalLink,
} from "lucide-react";

export default function TokenPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const { address: wallet, isConnected, status } = useAccount();
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
  const [copied, setCopied] = useState<"ca" | "curve" | null>(null);

  // Prefer address presence — matches header WalletButton / RainbowKit better than isConnected alone
  const activeWallet = (wallet ?? undefined) as Address | undefined;
  const walletReady =
    Boolean(activeWallet) &&
    (isConnected || status === "connected" || status === "reconnecting");

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
    if (!token?.graduated || !activeWallet || !amount || Number(amount) <= 0) {
      setQuoteOut(null);
      setQuoteGasUsd(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const q = await getUniswapQuote({
            swapper: activeWallet,
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
          setError(friendlyWalletError(err, "Quote failed"));
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [token?.graduated, token?.address, activeWallet, amount, tradeMode]);

  const copyText = async (value: string, field: "ca" | "curve") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const submitTrade = async (traderOverride?: Address) => {
    const trader = traderOverride || activeWallet;
    if (!token || !trader || !amount) return;
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
          swapper: trader,
          tokenAddress: token.address as Address,
          isBuy: tradeMode === "buy",
          amount,
        });
        setAmount("");
        setQuoteOut(null);
        void refreshTokens();
        return;
      }

      if (!token.bondingCurve) {
        throw new Error("Bonding curve address missing — relaunch or refresh");
      }

      const result = await executeCurveTrade({
        config: wagmiConfig,
        curve: token.bondingCurve as Address,
        token: token.address as Address,
        trader,
        isBuy: tradeMode === "buy",
        amount,
      });

      const feeEth =
        tradeMode === "buy"
          ? (result.ethAmount * CHAIN_CONFIG.tradeFeeBps) / 10_000
          : (result.ethAmount * CHAIN_CONFIG.tradeFeeBps) /
            Math.max(1, 10_000 - CHAIN_CONFIG.tradeFeeBps);

      const res = await fetch("/api/trades/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: token.address,
          trader,
          isBuy: tradeMode === "buy",
          ethAmount: result.ethAmount,
          tokenAmount: result.tokenAmount,
          price: result.price,
          feeEth,
          txHash: result.txHash,
          virtualEthReserves: result.virtualEthReserves,
          virtualTokenReserves: result.virtualTokenReserves,
          realEthReserves: result.realEthReserves,
          realTokenReserves: result.realTokenReserves,
          graduated: result.graduated,
          uniswapPool: result.uniswapPool,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to index trade");

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
      setError(friendlyWalletError(err, "Trade failed"));
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

  const poolFromMeta = token.metadata?.uniswapPool || null;
  const dexUrl = `https://dexscreener.com/robinhood/${(
    poolFromMeta || token.address
  ).toLowerCase()}`;
  const gmgnUrl = `https://gmgn.ai/robinhood/token/${token.address}`;

  return (
    <div className="rh-container py-8 sm:py-12">
      <Link
        href="/explore"
        className="inline-flex items-center gap-2 text-sm text-rh-muted hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Explore
      </Link>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
        <div className="relative z-0 space-y-4">
          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-rh-raised bg-rh-raised">
              <TokenLogo
                src={token.imageUri}
                alt={token.name}
                symbol={token.symbol}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="rh-display text-3xl sm:text-4xl">{token.name}</h1>
                <span className="text-rh-muted">${token.symbol}</span>
                <a
                  href={dexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-rh-lime hover:underline"
                >
                  DEX Screener <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href={gmgnUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-rh-muted hover:text-rh-lime hover:underline"
                >
                  GMGN <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-[10px] uppercase tracking-wider text-rh-dim">
                  Token CA
                </p>
                <code className="break-all font-mono text-[12px] text-white sm:text-[13px]">
                  {token.address}
                </code>
                <button
                  type="button"
                  aria-label="Copy token address"
                  className="rounded-lg p-1.5 text-rh-muted transition-colors hover:bg-white/10 hover:text-white"
                  onClick={() => void copyText(token.address, "ca")}
                >
                  {copied === "ca" ? (
                    <Check className="h-3.5 w-3.5 text-rh-lime" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <a
                  href={explorerAddressUrl(token.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-rh-lime hover:underline"
                >
                  Explorer <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {token.bondingCurve && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-rh-dim">
                    Curve
                  </p>
                  <code className="break-all font-mono text-[11px] text-white/70">
                    {shortenAddress(token.bondingCurve, 6)}
                  </code>
                  <button
                    type="button"
                    aria-label="Copy bonding curve address"
                    className="rounded-lg p-1 text-rh-muted transition-colors hover:bg-white/10 hover:text-white"
                    onClick={() => void copyText(token.bondingCurve, "curve")}
                  >
                    {copied === "curve" ? (
                      <Check className="h-3 w-3 text-rh-lime" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              )}

              {token.txHash && (
                <a
                  href={explorerTxUrl(token.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-rh-dim hover:text-rh-lime"
                >
                  Launch tx {shortenAddress(token.txHash, 6)}{" "}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              <p className="mt-2 text-sm text-rh-muted">
                {formatPriceEth(token.price)}
              </p>
            </div>
          </div>

          <TokenChart
            tokenAddress={token.address}
            poolAddress={poolFromMeta}
            graduated={token.graduated}
            chartData={chartData}
          />

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

        <aside className="space-y-4 lg:sticky lg:top-24 lg:z-20 lg:self-start">
          <div className="relative isolate overflow-hidden border border-rh-raised bg-black p-5 shadow-[0_0_0_1px_rgba(0,0,0,1)]">
            <div className="flex rounded-full overflow-hidden border border-rh-raised mb-4">
              <button
                type="button"
                onClick={() => {
                  setTradeMode("buy");
                  setBusy(false);
                  setError("");
                }}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium",
                  tradeMode === "buy" ? "bg-rh-lime text-rh-on-lime" : "text-rh-muted"
                )}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => {
                  setTradeMode("sell");
                  setBusy(false);
                  setError("");
                }}
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
              onChange={(e) => {
                setAmount(e.target.value);
                setBusy(false);
              }}
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
                  onClick={() => {
                    setAmount(v);
                    setBusy(false);
                  }}
                  className="flex-1 py-1.5 text-xs border border-rh-raised rounded-full hover:border-rh-lime/40 text-rh-muted"
                >
                  {v}
                </button>
              ))}
            </div>

            {token.graduated && quoteOut && (
              <p className="mb-3 text-xs text-rh-muted">
                Est. out:{" "}
                <span className="font-mono text-white">{quoteOut}</span>
                {quoteGasUsd ? ` · gas ~$${quoteGasUsd}` : ""}
              </p>
            )}

            {error && (
              <p className="mb-3 break-words text-xs leading-snug text-red-400">
                {error}
              </p>
            )}

            <ConnectButton.Custom>
              {({ account, chain, openConnectModal, openChainModal, mounted }) => {
                const rkConnected = Boolean(mounted && account && chain);
                const trader = (activeWallet ||
                  (account?.address as Address | undefined)) as
                  | Address
                  | undefined;
                const showTrade = rkConnected || walletReady || Boolean(trader);

                if (!mounted) {
                  return (
                    <RhButton className="w-full" disabled>
                      Loading wallet…
                    </RhButton>
                  );
                }

                if (chain?.unsupported) {
                  return (
                    <RhButton className="w-full" onClick={openChainModal}>
                      Switch to Robinhood Chain
                    </RhButton>
                  );
                }

                if (!showTrade || !trader) {
                  return (
                    <RhButton className="w-full" onClick={openConnectModal}>
                      Connect wallet to trade
                    </RhButton>
                  );
                }

                return (
                  <RhButton
                    className="w-full"
                    variant={tradeMode === "buy" ? "primary" : "ghost"}
                    onClick={() => void submitTrade(trader)}
                    disabled={busy || !amount}
                  >
                    {busy
                      ? "Confirm in wallet…"
                      : `${tradeMode === "buy" ? "Buy" : "Sell"} $${token.symbol}`}
                  </RhButton>
                );
              }}
            </ConnectButton.Custom>

            <p className="mt-3 text-center text-[11px] text-rh-dim">
              {token.graduated
                ? "Uniswap V3 · 2.5% slippage · Trading API"
                : `On-chain curve · ${CHAIN_CONFIG.creatorFeeBps / 100}% creator + ${CHAIN_CONFIG.platformFeeBps / 100}% platform · DEX chart after ~${CHAIN_CONFIG.graduationThreshold} ETH`}
            </p>
          </div>

          <div className="relative isolate border border-rh-raised bg-black p-5 space-y-3">
            <div>
              <p className="text-xs text-rh-muted mb-1">Creator</p>
              <p className="font-mono text-sm">{shortenAddress(token.creator)}</p>
            </div>
            <div>
              <p className="text-xs text-rh-muted mb-1">Created</p>
              <p className="text-sm">{timeAgo(token.createdAt)}</p>
            </div>
            {token.description && (
              <div>
                <p className="text-xs text-rh-muted mb-1">About</p>
                <p className="text-sm text-rh-muted leading-relaxed whitespace-pre-wrap">
                  {token.description}
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
