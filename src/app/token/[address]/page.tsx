"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useConfig, useReadContract } from "wagmi";
import { formatEther, formatUnits, type Address } from "viem";
import { useAppStore } from "@/lib/store";
import {
  CHAIN_CONFIG,
  explorerAddressUrl,
  explorerTxUrl,
  robinhoodChain,
} from "@/lib/chain";
import { RhButton } from "@/components/ui/rh-button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TokenLogo } from "@/components/token-logo";
import { TokenChart } from "@/components/token-chart";
import {
  SameTickerPanel,
  TopHoldersPanel,
  buildTopHolders,
  type HolderRow,
} from "@/components/token-holders";
import { DEFAULT_SUPPLY, quotePoolSwap } from "@/lib/curve";
import { isPumpRobinLaunch } from "@/lib/data-client";
import { blockscoutVerifyUrl } from "@/lib/indexer-links";
import {
  cn,
  formatEth,
  formatGasUsd,
  formatPriceEth,
  formatTokenAmount,
  formatUsd,
  ethToUsd,
  friendlyWalletError,
  shortenAddress,
  timeAgo,
} from "@/lib/utils";
import {
  executeUniswapSwap,
  getUniswapQuote,
} from "@/lib/uniswap-trade";
import {
  claimCreatorFees,
  curveSupportsFeeRouter,
  executeCurveTrade,
  executeGraduatedCurveTrade,
  readPendingFees,
  tokenHasTransferTax,
  type PendingFees,
} from "@/lib/curve-trade";
import { useEthUsd } from "@/lib/use-eth-usd";
import { readContract } from "@wagmi/core";
import { CONTRACTS, ERC20_ABI, PUMP_ROBIN_FACTORY_ABI } from "@/lib/contracts";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Copy,
  ExternalLink,
  Globe,
} from "lucide-react";
import type { TradeData } from "@/lib/data-types";
import { CreatorIcon } from "@/components/creator-icon";

const BUY_WALLET_PCTS = [25, 50, 75, 100] as const;
/** Leave a little ETH for gas when using 100% */
const BUY_GAS_BUFFER_ETH = 0.0003;

function normalizeHref(url?: string): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.743l7.227-8.451L1.61 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.788.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

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
  const [lookupFailed, setLookupFailed] = useState(false);

  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quoteOut, setQuoteOut] = useState<string | null>(null);
  const [quoteGasUsd, setQuoteGasUsd] = useState<string | null>(null);
  const [copied, setCopied] = useState<"ca" | "curve" | null>(null);
  const [chainHolders, setChainHolders] = useState<HolderRow[] | null>(null);
  const [liveTrades, setLiveTrades] = useState<TradeData[]>([]);
  const [holderCount, setHolderCount] = useState<number | null>(null);
  const [liveVolume24h, setLiveVolume24h] = useState<number | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [usesFeeRouter, setUsesFeeRouter] = useState(false);
  const [hasTransferTax, setHasTransferTax] = useState(false);
  const [pendingFees, setPendingFees] = useState<PendingFees | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  /** Curve address straight from the factory — the only source that cannot be stale. */
  const [factoryCurve, setFactoryCurve] = useState<string | null>(null);
  const ethUsd = useEthUsd();

  // Prefer address presence — matches header WalletButton / RainbowKit better than isConnected alone
  const activeWallet = (wallet ?? undefined) as Address | undefined;
  const walletReady =
    Boolean(activeWallet) && (isConnected || status === "reconnecting");

  const { data: ethBalance } = useBalance({
    address: activeWallet,
    chainId: robinhoodChain.id,
  });
  const { data: tokenBalRaw } = useReadContract({
    address: token?.address as Address | undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: activeWallet ? [activeWallet] : undefined,
    chainId: robinhoodChain.id,
    query: { enabled: Boolean(activeWallet && token?.address) },
  });

  const applyBuyPct = (pct: number) => {
    const bal = ethBalance ? Number(formatEther(ethBalance.value)) : 0;
    if (!(bal > 0)) {
      setError("Connect a wallet with ETH to use % presets");
      return;
    }
    const spendable = Math.max(0, bal - BUY_GAS_BUFFER_ETH);
    const eth = (spendable * pct) / 100;
    setAmount(eth > 0 ? eth.toFixed(6).replace(/\.?0+$/, "") : "0");
    setBusy(false);
    setError("");
  };

  const applySellPct = (pct: number) => {
    if (tokenBalRaw == null) {
      setError("Connect a wallet that holds this token to use % presets");
      return;
    }
    const decimals = token?.metadata?.decimals ?? 18;
    const bal = Number(formatUnits(tokenBalRaw as bigint, decimals));
    if (!(bal > 0)) {
      setError("No token balance");
      return;
    }
    const qty = (bal * pct) / 100;
    setAmount(qty > 0 ? qty.toFixed(6).replace(/\.?0+$/, "") : "0");
    setBusy(false);
    setError("");
  };

  useEffect(() => {
    if (!address || token) return;
    let cancelled = false;
    setLookupFailed(false);
    void (async () => {
      try {
        const res = await fetch(`/api/tokens/${address}`);
        if (!res.ok) {
          if (!cancelled) setLookupFailed(true);
          return;
        }
        const data = await res.json();
        if (cancelled || !data.token) {
          if (!cancelled) setLookupFailed(true);
          return;
        }
        upsertToken({
          ...data.token,
          createdAt: new Date(data.token.createdAt),
        });
      } catch {
        if (!cancelled) setLookupFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, token, upsertToken]);

  // Refresh live pool/curve stats + index Uniswap swaps into recent trades
  useEffect(() => {
    if (!address || token?.source === "market") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/tokens/${address}/refresh`, {
          method: "POST",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.token) {
          upsertToken({
            ...data.token,
            createdAt: new Date(data.token.createdAt),
          });
        }
        // Reload trades so Uniswap swaps indexed on the server show up
        await refreshTokens();
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, upsertToken, refreshTokens]);

  const tokenTrades = useMemo(() => {
    const normalize = (t: TradeData) => ({
      ...t,
      timestamp:
        t.timestamp instanceof Date ? t.timestamp : new Date(t.timestamp),
    });
    const extra = liveTrades.map(normalize);
    if (extra.length > 0) {
      return extra.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    return trades
      .filter((t) => t.tokenAddress.toLowerCase() === address.toLowerCase())
      .map(normalize)
      .filter((t) => (Number(t.ethAmount) || 0) >= 1e-6)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [trades, liveTrades, address]);

  const topHolders = useMemo(() => {
    if (chainHolders && chainHolders.length > 0) return chainHolders;
    if (!token) return [];
    if (token.source === "market" || token.graduated) return [];
    return buildTopHolders({
      trades: tokenTrades,
      tokenAddress: token.address,
      bondingCurve: token.bondingCurve,
      realTokenReserves: token.realTokenReserves,
      creator: token.creator,
      supply: token.metadata?.supply ?? DEFAULT_SUPPLY,
      limit: 10,
    });
  }, [token, tokenTrades, chainHolders]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setActivityLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/tokens/${address}/activity`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          holders?: HolderRow[];
          holderCount?: number | null;
          trades?: TradeData[];
          volume24hEth?: number;
        };
        if (cancelled) return;
        if (data.holders?.length) setChainHolders(data.holders);
        if (typeof data.holderCount === "number") setHolderCount(data.holderCount);
        if (typeof data.volume24hEth === "number") setLiveVolume24h(data.volume24hEth);
        if (data.trades) {
          setLiveTrades(
            data.trades.map((t) => ({
              ...t,
              timestamp: new Date(t.timestamp),
            }))
          );
        }
      } catch {
        /* best-effort */
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  // A coin missing from the local registry is still ours if the factory knows
  // it. Without this the page treats it as an outside token and charges the
  // external-swap cut on our own launch.
  useEffect(() => {
    const factoryAddress = CONTRACTS.factory;
    if (!factoryAddress || !address) {
      setFactoryCurve(null);
      return;
    }
    let cancelled = false;
    void readContract(wagmiConfig, {
      address: factoryAddress,
      abi: PUMP_ROBIN_FACTORY_ABI,
      functionName: "tokenToCurve",
      args: [address as Address],
    })
      .then((curve) => {
        const found = curve as Address;
        if (!cancelled) {
          setFactoryCurve(
            found && found !== "0x0000000000000000000000000000000000000000"
              ? found
              : null
          );
        }
      })
      .catch(() => {
        if (!cancelled) setFactoryCurve(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address, wagmiConfig]);

  useEffect(() => {
    if (!token?.bondingCurve) {
      setUsesFeeRouter(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const ok = await curveSupportsFeeRouter();
      if (!cancelled) setUsesFeeRouter(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, [token?.bondingCurve, wagmiConfig]);

  useEffect(() => {
    if (!token?.address) {
      setHasTransferTax(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const ok = await tokenHasTransferTax(
        wagmiConfig,
        token.address as Address
      );
      if (!cancelled) setHasTransferTax(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, [token?.address, wagmiConfig]);

  useEffect(() => {
    if (!token?.bondingCurve || !usesFeeRouter) {
      setPendingFees(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const fees = await readPendingFees(
          wagmiConfig,
          token.bondingCurve as Address,
          token.price,
          token.address as Address,
          activeWallet
        );
        if (!cancelled) setPendingFees(fees);
      } catch {
        if (!cancelled) setPendingFees(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token?.bondingCurve, token?.address, token?.price, usesFeeRouter, wagmiConfig, busy, claimBusy, activeWallet]);

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
          const pooledWeth = token.metadata?.pooledWeth ?? 0;
          const pooledToken = token.metadata?.pooledToken ?? 0;
          if (
            hasTransferTax &&
            token.bondingCurve &&
            pooledWeth > 0 &&
            pooledToken > 0
          ) {
            const out = quotePoolSwap({
              isBuy: tradeMode === "buy",
              amountIn: Number(amount),
              pooledWeth,
              pooledToken,
            });
            if (cancelled) return;
            setQuoteOut(String(out));
            setQuoteGasUsd(null);
            setError("");
            return;
          }

          const q = await getUniswapQuote({
            swapper: activeWallet,
            tokenAddress: token.address as Address,
            isBuy: tradeMode === "buy",
            amount,
            tokenDecimals: token.metadata?.decimals ?? 18,
            platformCut: !isOurLaunch,
          });
          if (cancelled) return;
          let out = q.amountOutFormatted;
          if (hasTransferTax) {
            const netBps = 10_000 - CHAIN_CONFIG.tradeFeeBps;
            out = String((Number(out) * netBps) / 10_000);
          }
          setQuoteOut(out);
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
  }, [
    token?.graduated,
    token?.address,
    activeWallet,
    amount,
    tradeMode,
    hasTransferTax,
    token?.bondingCurve,
    token?.metadata?.decimals,
    token?.metadata?.pooledWeth,
    token?.metadata?.pooledToken,
  ]);

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
        if (hasTransferTax && token.bondingCurve) {
          const result = await executeGraduatedCurveTrade({
            config: wagmiConfig,
            curve: token.bondingCurve as Address,
            token: token.address as Address,
            trader,
            isBuy: tradeMode === "buy",
            amount,
          });
          setAmount("");
          setQuoteOut(null);
          void refreshTokens();
          void fetch("/api/trades/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tokenAddress: token.address,
              trader,
              isBuy: result.isBuy,
              ethAmount: result.ethAmount,
              tokenAmount: result.tokenAmount,
              price: result.price,
              feeEth: 0,
              txHash: result.txHash,
              uniswapPool: result.poolId,
            }),
          });
          return;
        }

        await executeUniswapSwap({
          config: wagmiConfig,
          swapper: trader,
          tokenAddress: token.address as Address,
          isBuy: tradeMode === "buy",
          amount,
          tokenDecimals: token.metadata?.decimals ?? 18,
          platformCut: !isOurLaunch,
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
          uniswapPool: result.poolId,
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
        <p className="rh-display text-3xl mb-4">
          {lookupFailed ? "Token not found" : "Loading token…"}
        </p>
        <Link href="/explore" className="text-rh-lime text-sm hover:underline">
          Back to Explore
        </Link>
      </div>
    );
  }

  const bondingCurve = token.bondingCurve || factoryCurve || "";
  const isOurLaunch = isPumpRobinLaunch({ ...token, bondingCurve });
  const isDexToken = !isOurLaunch;

  const poolFromMeta = token.metadata?.uniswapPool || null;
  const supply = token.metadata?.supply ?? DEFAULT_SUPPLY;
  const deadSupply = token.metadata?.deadSupply ?? 0;
  const mostlyBurned = deadSupply > 0 && deadSupply >= supply * 0.5;
  const dexUrl = `https://dexscreener.com/robinhood/${(
    poolFromMeta || token.address
  ).toLowerCase()}`;
  const gmgnUrl = `https://gmgn.ai/robinhood/token/${token.address}`;
  const website = normalizeHref(token.metadata?.website);
  const twitter = normalizeHref(token.metadata?.twitter);
  const telegram = normalizeHref(token.metadata?.telegram);
  const discord = normalizeHref(token.metadata?.discord);

  return (
    <div className="rh-container py-8 sm:py-12">
      <Link
        href="/explore"
        className="mb-6 inline-flex items-center gap-2 text-sm text-rh-muted hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Explore
      </Link>

      {/* Compact header — no duplicate GMGN/DEX/CA spam */}
      <div className="mb-6 flex items-start gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-rh-raised bg-rh-raised sm:h-16 sm:w-16">
          <TokenLogo
            src={token.imageUri}
            alt={token.name}
            symbol={token.symbol}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="rh-display text-2xl text-white sm:text-3xl">
              {token.name}
            </h1>
            <span className="text-rh-muted">${token.symbol}</span>
            <span className="text-sm tabular-nums text-white/80">
              {formatPriceEth(token.price)}
              <span className="ml-1.5 text-rh-muted">
                (~{formatUsd(ethToUsd(token.price, ethUsd))})
              </span>
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="font-mono text-[12px] text-white/70">
              {shortenAddress(token.address, 6)}
            </code>
            <button
              type="button"
              aria-label="Copy token address"
              className="rounded-lg p-1 text-rh-muted transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => void copyText(token.address, "ca")}
            >
              {copied === "ca" ? (
                <Check className="h-3.5 w-3.5 text-rh-lime" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>

            <span className="text-rh-raised">·</span>

            <div className="flex items-center gap-0.5">
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Website"
                  className="rounded-md p-1.5 text-rh-muted hover:bg-white/5 hover:text-rh-lime"
                >
                  <Globe className="h-3.5 w-3.5" />
                </a>
              )}
              {twitter && (
                <a
                  href={twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="X"
                  className="rounded-md p-1.5 text-rh-muted hover:bg-white/5 hover:text-rh-lime"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </a>
              )}
              {telegram && (
                <a
                  href={telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Telegram"
                  className="rounded-md p-1.5 text-rh-muted hover:bg-white/5 hover:text-rh-lime"
                >
                  <TelegramIcon className="h-3.5 w-3.5" />
                </a>
              )}
              {discord && (
                <a
                  href={discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Discord"
                  className="rounded-md p-1.5 text-rh-muted hover:bg-white/5 hover:text-rh-lime"
                >
                  <DiscordIcon className="h-3.5 w-3.5" />
                </a>
              )}
              <a
                href={gmgnUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="GMGN"
                className="rounded-md px-2 py-1 text-[11px] font-medium text-rh-muted hover:bg-white/5 hover:text-rh-lime"
              >
                GMGN
              </a>
              <a
                href={dexUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="DEX Screener"
                className="rounded-md px-2 py-1 text-[11px] font-medium text-rh-muted hover:bg-white/5 hover:text-rh-lime"
              >
                DEX
              </a>
              <a
                href={explorerAddressUrl(token.address)}
                target="_blank"
                rel="noopener noreferrer"
                title="Explorer"
                className="rounded-md px-2 py-1 text-[11px] font-medium text-rh-muted hover:bg-white/5 hover:text-rh-lime"
              >
                Explorer
              </a>
              <a
                href={blockscoutVerifyUrl(token.address)}
                target="_blank"
                rel="noopener noreferrer"
                title="Verified source on Blockscout"
                className="rounded-md px-2 py-1 text-[11px] font-medium text-rh-muted hover:bg-white/5 hover:text-rh-lime"
              >
                Source
              </a>
              {!isDexToken && (
                <Link
                  href={`/wallet/${token.creator}`}
                  title="Creator"
                  aria-label="Creator profile"
                  className="rounded-md p-1.5 text-rh-muted hover:bg-white/5 hover:text-rh-lime"
                >
                  <CreatorIcon />
                </Link>
              )}
            </div>
          </div>

          <details className="mt-2 group">
            <summary className="cursor-pointer list-none text-[11px] text-rh-dim hover:text-rh-muted [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">More details</span>
              <span className="hidden group-open:inline">Hide details</span>
            </summary>
            <div className="mt-2 space-y-1.5 text-[11px] text-rh-muted">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-rh-dim">CA</span>
                <code className="break-all font-mono text-white/80">
                  {token.address}
                </code>
              </div>
              {token.bondingCurve && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-rh-dim">Curve</span>
                  <code className="font-mono text-white/70">
                    {shortenAddress(token.bondingCurve, 6)}
                  </code>
                  <button
                    type="button"
                    aria-label="Copy curve"
                    className="rounded p-1 hover:bg-white/10"
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
                  className="inline-flex items-center gap-1 hover:text-rh-lime"
                >
                  Launch tx {shortenAddress(token.txHash, 6)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </details>
        </div>
      </div>

      {/* Main split: chart + activity | trade + holders + same ticker */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-8">
        <div className="relative z-0 min-w-0 space-y-4">
          <TokenChart
            tokenAddress={token.address}
            poolAddress={poolFromMeta}
            graduated={token.graduated}
          />

          <div className="grid grid-cols-2 gap-px bg-rh-raised sm:grid-cols-3 lg:grid-cols-5">
            {[
              {
                label: isDexToken ? "Market cap" : mostlyBurned ? "Market cap" : "Market cap (FDV)",
                value: isDexToken && token.metadata?.marketCapUsd
                  ? formatUsd(token.metadata.marketCapUsd)
                  : `${formatEth(token.marketCap)} ETH`,
                hint: isDexToken && token.metadata?.priceUsd
                  ? `${formatUsd(token.metadata.priceUsd)} / token`
                  : mostlyBurned
                    ? `Circulating · FDV ${formatEth(token.marketCapFdv)} ETH · ~${formatUsd(ethToUsd(token.marketCap, ethUsd))}`
                    : `~${formatUsd(ethToUsd(token.marketCap, ethUsd))}`,
              },
              {
                label: isDexToken ? "24h volume" : "ATH market cap",
                value: isDexToken && token.metadata?.volumeUsd24h
                  ? formatUsd(token.metadata.volumeUsd24h)
                  : `${formatEth(isDexToken ? token.volume24h : token.athMarketCap)} ETH`,
                hint: isDexToken
                  ? `${token.metadata?.txns24h ?? 0} txns`
                  : `~${formatUsd(ethToUsd(token.athMarketCap, ethUsd))}`,
              },
              {
                label: isDexToken ? "24h change" : "24h volume",
                value: isDexToken
                  ? `${token.priceChange24h >= 0 ? "+" : ""}${token.priceChange24h.toFixed(1)}%`
                  : `${formatEth(liveVolume24h ?? token.volume24h)} ETH`,
                hint: isDexToken
                  ? "Price change"
                  : `~${formatUsd(ethToUsd(liveVolume24h ?? token.volume24h, ethUsd))}`,
              },
              {
                label: "Holders",
                value:
                  holderCount != null
                    ? holderCount.toLocaleString("en-US")
                    : String(token.holders || "—"),
                hint: "Wallets with balance",
              },
              token.graduated
                ? {
                    label: "Liquidity",
                    value: token.metadata?.liquidityUsd
                      ? formatUsd(token.metadata.liquidityUsd)
                      : `${formatEth(token.ethReserves)} ETH`,
                    hint: token.metadata?.pooledWeth != null
                      ? `${formatEth(token.metadata.pooledWeth)} WETH · ~${formatUsd(ethToUsd(token.ethReserves, ethUsd))}`
                      : `~${formatUsd(ethToUsd(token.ethReserves, ethUsd))}`,
                  }
                : {
                    label: "Raised (curve ETH)",
                    value: `${formatEth(token.ethReserves)} ETH`,
                    hint: `~${formatUsd(ethToUsd(token.ethReserves, ethUsd))} · ${CHAIN_CONFIG.graduationThreshold} ETH to graduate`,
                  },
            ].map((s) => (
              <div key={s.label} className="bg-black p-4 text-center">
                <p className="mb-1 text-xs text-rh-muted">{s.label}</p>
                <p className="text-sm font-medium">{s.value}</p>
                {"hint" in s && s.hint && (
                  <p className="mt-1 text-[10px] text-rh-dim">{s.hint}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-rh-dim">
            <span>Created {timeAgo(token.createdAt)}</span>
            {token.metadata?.dexId && (
              <span className="uppercase">
                {token.metadata.dexId.replace(/-robinhood$/i, "")}
              </span>
            )}
            {typeof token.metadata?.traders24h === "number" &&
              token.metadata.traders24h > 0 && (
                <span>{token.metadata.traders24h.toLocaleString("en-US")} traders / 24h</span>
              )}
            {typeof token.metadata?.priceChange1h === "number" &&
              token.metadata.priceChange1h !== 0 && (
                <span>
                  1h {token.metadata.priceChange1h >= 0 ? "+" : ""}
                  {token.metadata.priceChange1h.toFixed(1)}%
                </span>
              )}
            {typeof token.metadata?.priceChange5m === "number" &&
              token.metadata.priceChange5m !== 0 && (
                <span>
                  5m {token.metadata.priceChange5m >= 0 ? "+" : ""}
                  {token.metadata.priceChange5m.toFixed(1)}%
                </span>
              )}
          </div>

          {!isDexToken && (
          <div className="border border-rh-raised p-5">
            <ProgressBar value={token.progress} graduated={token.graduated} />
            <p className="mt-2 text-xs text-rh-dim">
              {token.graduated
                ? "Live on Uniswap v4 · 2% hook fee · liquidity locked. Stats from pool spot."
                : `${formatEth(CHAIN_CONFIG.graduationThreshold - token.ethReserves)} ETH until graduation`}
            </p>
          </div>
          )}

          <div className="border border-rh-raised p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-medium">Recent trades</h3>
              <span className="text-[11px] text-rh-dim tabular-nums">
                {activityLoading && tokenTrades.length === 0
                  ? "Loading…"
                  : `${Math.min(tokenTrades.length, 20)} shown`}
              </span>
            </div>
            {tokenTrades.length === 0 ? (
              <p className="text-sm text-rh-dim">
                {activityLoading ? "Loading trades…" : "No trades yet."}
              </p>
            ) : (
              <div className="max-h-72 space-y-0 overflow-y-auto">
                {tokenTrades.slice(0, 20).map((trade) => (
                  <div
                    key={trade.id}
                    className="flex h-10 items-center justify-between border-b border-rh-raised/50 text-sm last:border-0"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {trade.isBuy ? (
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-rh-lime" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-red-400" />
                      )}
                      <span
                        className={
                          trade.isBuy ? "text-rh-lime" : "text-red-400"
                        }
                      >
                        {trade.isBuy ? "Buy" : "Sell"}
                      </span>
                      <span className="font-mono text-xs text-rh-dim">
                        {shortenAddress(trade.trader)}
                      </span>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="text-sm">
                        {trade.ethAmount > 0
                          ? `${formatEth(trade.ethAmount)} ETH`
                          : `${formatTokenAmount(trade.tokenAmount)} ${token.symbol}`}
                      </p>
                      <p className="text-[10px] text-rh-dim">
                        {timeAgo(trade.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Same ticker — show under chart on mobile; duplicated in sidebar on xl via order */}
          <div className="xl:hidden">
            <SameTickerPanel
              symbol={token.symbol}
              tokens={tokens}
              currentAddress={token.address}
            />
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:z-20 xl:self-start">
          <div className="relative isolate overflow-hidden border border-rh-raised bg-black p-5 shadow-[0_0_0_1px_rgba(0,0,0,1)]">
            <div className="mb-4 flex overflow-hidden rounded-full border border-rh-raised">
              <button
                type="button"
                onClick={() => {
                  setTradeMode("buy");
                  setBusy(false);
                  setError("");
                }}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium",
                  tradeMode === "buy"
                    ? "bg-rh-lime text-rh-on-lime"
                    : "text-rh-muted"
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
                  tradeMode === "sell"
                    ? "bg-white text-black"
                    : "text-rh-muted"
                )}
              >
                Sell
              </button>
            </div>

            <label className="mb-1.5 block text-xs text-rh-muted">
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
              className="mb-3 w-full rounded-xl border border-rh-raised bg-black px-4 py-3 font-mono text-lg focus:border-rh-lime focus:outline-none"
            />

            <div className="mb-4 flex gap-2">
              {BUY_WALLET_PCTS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    if (tradeMode === "buy") applyBuyPct(pct);
                    else applySellPct(pct);
                  }}
                  className="flex-1 rounded-full border border-rh-raised py-1.5 text-xs text-rh-muted hover:border-rh-lime/40"
                >
                  {pct}%
                </button>
              ))}
            </div>

            {hasTransferTax && (
              <p className="mb-3 text-[11px] leading-snug text-rh-dim">
                Sell here on PumpRobin (handles the 2% transfer tax). MetaMask Swap
                often fails on these pools. Liquidity is tiny, so large sells return
                very little ETH.
              </p>
            )}

            {token.graduated && quoteOut && (
              <div className="mb-3 space-y-1 text-xs text-rh-muted">
                <p>
                  You receive ≈{" "}
                  <span className="font-mono text-white">
                    {tradeMode === "buy"
                      ? `${formatTokenAmount(quoteOut)} ${token.symbol}`
                      : `${formatEth(Number(quoteOut))} ETH`}
                  </span>
                </p>
                {quoteGasUsd != null && Number(quoteGasUsd) > 0 && (
                  <p className="text-rh-dim">
                    Network gas ≈ {formatGasUsd(quoteGasUsd)} (paid in ETH,
                    separate from the swap)
                  </p>
                )}
              </div>
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

            <p className="mt-3 text-center text-[11px] leading-relaxed text-rh-dim">
              {isDexToken
                ? `Swap via Uniswap. Non-PumpRobin tokens pay an extra ${CHAIN_CONFIG.externalSwapFeeBps / 100}% platform fee on this site.`
                : `${CHAIN_CONFIG.creatorFeeBps / 100}% creator + ${CHAIN_CONFIG.platformFeeBps / 100}% platform on every DEX trade (GMGN, Uniswap, MetaMask, this site) · LP locked`}
            </p>

            {usesFeeRouter &&
              pendingFees &&
              activeWallet?.toLowerCase() === token.creator.toLowerCase() && (
                <div className="mt-4 border border-rh-raised bg-black/60 p-3 text-center">
                  <p className="text-[11px] text-rh-muted">Your accumulated fees</p>
                  <p className="mt-1 text-sm font-medium tabular-nums">
                    {formatEth(pendingFees.creatorEth)} ETH
                  </p>
                  {ethUsd != null && (
                    <p className="mt-1 text-[10px] text-rh-dim">
                      (~{formatUsd(ethToUsd(pendingFees.creatorEth, ethUsd))})
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-rh-dim">
                    {CHAIN_CONFIG.creatorFeeBps / 100}% of every buy and sell, on
                    any venue. Claim anytime. Platform share auto-sends after ~$
                    {CHAIN_CONFIG.feeClaimThresholdUsdHint}.
                  </p>
                  {pendingFees.feeShare && (
                    <p className="mt-1 text-[10px] text-rh-dim">
                      Split between wallets — you can only claim your share.
                    </p>
                  )}
                  <RhButton
                    className="mt-3 w-full"
                    variant="ghost"
                    disabled={claimBusy || !pendingFees.creatorClaimable}
                    onClick={() => {
                      if (!token.bondingCurve) return;
                      setClaimBusy(true);
                      setError("");
                      void claimCreatorFees({
                        config: wagmiConfig,
                        curve: token.bondingCurve as Address,
                        token: token.address as Address,
                        feeShare: pendingFees.feeShare,
                      })
                        .then(() => {
                          void readPendingFees(
                            wagmiConfig,
                            token.bondingCurve as Address,
                            token.price,
                            token.address as Address,
                            activeWallet
                          ).then(setPendingFees);
                        })
                        .catch((err) =>
                          setError(friendlyWalletError(err, "Claim failed"))
                        )
                        .finally(() => setClaimBusy(false));
                    }}
                  >
                    {claimBusy
                      ? "Claiming…"
                      : pendingFees.creatorClaimable
                        ? "Claim creator fees"
                        : "No fees yet"}
                  </RhButton>
                </div>
              )}
          </div>

          <TopHoldersPanel holders={topHolders} />

          <div className="hidden xl:block">
            <SameTickerPanel
              symbol={token.symbol}
              tokens={tokens}
              currentAddress={token.address}
            />
          </div>

          <div className="relative isolate space-y-3 border border-rh-raised bg-black p-5">
            {!isDexToken && (
            <div>
              <p className="mb-1 text-xs text-rh-muted">Created by</p>
              <Link
                href={`/wallet/${token.creator}`}
                className="inline-flex items-center gap-2 text-sm text-rh-lime hover:underline"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-rh-muted">
                  <CreatorIcon className="h-3.5 w-3.5" />
                </span>
                Creator profile
              </Link>
            </div>
            )}
            <div>
              <p className="mb-1 text-xs text-rh-muted">Created</p>
              <p className="text-sm">{timeAgo(token.createdAt)}</p>
            </div>
            {token.description && (
              <div>
                <p className="mb-1 text-xs text-rh-muted">About</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-rh-muted">
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
