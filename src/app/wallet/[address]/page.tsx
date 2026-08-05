"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Copy,
  Check,
  ExternalLink,
  Coins,
  Wallet,
  Activity,
  Layers,
} from "lucide-react";
import type { WalletProfile } from "@/lib/wallet-analytics";
import { explorerAddressUrl } from "@/lib/chain";
import { TokenLogo } from "@/components/token-logo";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  cn,
  formatEth,
  formatNumber,
  shortenAddress,
  timeAgo,
} from "@/lib/utils";

type Tab = "created" | "holdings" | "trades" | "analysis";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border border-rh-raised bg-black p-4">
      <p className="text-[11px] uppercase tracking-wider text-rh-dim">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums text-white">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-rh-muted">{hint}</p>}
    </div>
  );
}

export default function WalletPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: raw } = use(params);
  const address = raw.toLowerCase();
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("created");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const res = await fetch(`/api/wallet/${address}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load wallet");
        if (!cancelled) setProfile(data.profile);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="rh-container py-24 text-center text-rh-muted">
        Loading wallet analytics…
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rh-container py-24 text-center">
        <p className="mb-4 text-red-400">{error || "Wallet not found"}</p>
        <Link href="/explore" className="text-sm text-rh-lime hover:underline">
          Back to Explore
        </Link>
      </div>
    );
  }

  const s = profile.stats;
  const gmgnUrl = `https://gmgn.ai/robinhood/address/${address}`;
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "created", label: `Created (${s.coinsCreated})` },
    { id: "holdings", label: `Holdings (${s.holdingsCount})` },
    { id: "trades", label: `Trades (${s.tradeCount})` },
    { id: "analysis", label: "Deep analysis" },
  ];

  const buySellRatio =
    s.buyCount + s.sellCount > 0
      ? (s.buyCount / (s.buyCount + s.sellCount)) * 100
      : 0;

  return (
    <div className="rh-container py-8 sm:py-12">
      <Link
        href="/explore"
        className="mb-6 inline-flex items-center gap-2 text-sm text-rh-muted hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Explore
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wider text-rh-dim">
            Wallet / Creator
          </p>
          <h1 className="rh-display text-2xl text-white sm:text-3xl">
            {shortenAddress(address, 6)}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all font-mono text-[12px] text-white/80">
              {address}
            </code>
            <button
              type="button"
              onClick={() => void copy()}
              className="rounded-lg p-1.5 text-rh-muted hover:bg-white/10 hover:text-white"
              aria-label="Copy address"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-rh-lime" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
            <a
              href={explorerAddressUrl(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-rh-lime hover:underline"
            >
              Explorer <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={gmgnUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-rh-muted hover:text-rh-lime hover:underline"
            >
              GMGN <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="mt-2 text-xs text-rh-dim">
            {s.firstSeenAt
              ? `First seen ${timeAgo(new Date(s.firstSeenAt))}`
              : "No PumpRobin activity yet"}
            {s.lastActiveAt
              ? ` · Last active ${timeAgo(new Date(s.lastActiveAt))}`
              : ""}
          </p>
        </div>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-px bg-rh-raised sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Coins created"
          value={String(s.coinsCreated)}
          hint={`${s.graduatedCreated} graduated`}
        />
        <StatCard
          label="Portfolio value"
          value={`${formatEth(s.portfolioValueEth)} ETH`}
          hint={`${s.holdingsCount} holdings`}
        />
        <StatCard
          label="PnL (est.)"
          value={`${s.portfolioPnlPct >= 0 ? "+" : ""}${s.portfolioPnlPct.toFixed(1)}%`}
          hint={`Cost ${formatEth(s.portfolioCostEth)} ETH`}
        />
        <StatCard
          label="Volume traded"
          value={`${formatEth(s.volumeTradedEth)} ETH`}
          hint={`${s.tradeCount} trades`}
        />
        <StatCard
          label="Created volume"
          value={`${formatEth(s.totalCreatedVolumeEth)} ETH`}
          hint="On their coins"
        />
        <StatCard
          label="Creator fees (est.)"
          value={`${formatEth(s.estimatedCreatorFeesEth)} ETH`}
          hint="~1% of created vol"
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-1 border-b border-rh-raised pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.id
                ? "bg-rh-lime text-rh-on-lime"
                : "text-rh-muted hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "created" && (
        <section className="space-y-3">
          {profile.created.length === 0 ? (
            <p className="text-sm text-rh-dim">No coins created on PumpRobin.</p>
          ) : (
            profile.created.map((t) => (
              <Link
                key={t.address}
                href={`/token/${t.address}`}
                className="flex items-center gap-4 border border-rh-raised bg-black p-4 transition-colors hover:border-rh-lime/30"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-rh-raised">
                  <TokenLogo src={t.imageUri} alt={t.name} symbol={t.symbol} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{t.name}</p>
                    <span className="text-xs text-rh-muted">${t.symbol}</span>
                    {t.graduated && (
                      <span className="rounded bg-rh-lime/15 px-1.5 py-0.5 text-[10px] text-rh-lime">
                        Graduated
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-rh-dim">
                    {shortenAddress(t.address, 6)} · {timeAgo(t.createdAt)}
                  </p>
                  <div className="mt-2 max-w-xs">
                    <ProgressBar value={t.progress} graduated={t.graduated} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm tabular-nums text-white">
                    {formatEth(t.marketCap)} ETH
                  </p>
                  <p className="text-[11px] text-rh-dim">
                    ATH {formatEth(t.athMarketCap)} · {t.holders} holders
                  </p>
                </div>
              </Link>
            ))
          )}
        </section>
      )}

      {tab === "holdings" && (
        <section className="space-y-3">
          {profile.holdings.length === 0 ? (
            <p className="text-sm text-rh-dim">
              No open holdings from indexed PumpRobin trades.
            </p>
          ) : (
            profile.holdings.map((h) => (
              <Link
                key={h.token.address}
                href={`/token/${h.token.address}`}
                className="flex items-center gap-4 border border-rh-raised bg-black p-4 transition-colors hover:border-rh-lime/30"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-rh-raised">
                  <TokenLogo
                    src={h.token.imageUri}
                    alt={h.token.name}
                    symbol={h.token.symbol}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">
                    {h.token.name}{" "}
                    <span className="text-rh-muted">${h.token.symbol}</span>
                  </p>
                  <p className="mt-1 text-xs text-rh-dim">
                    {formatNumber(h.balance, 2)} tokens · {h.trades} trades
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm tabular-nums text-white">
                    {formatEth(h.valueEth)} ETH
                  </p>
                  <p
                    className={cn(
                      "text-[11px] tabular-nums",
                      h.pnlPct >= 0 ? "text-rh-lime" : "text-red-400"
                    )}
                  >
                    {h.pnlPct >= 0 ? "+" : ""}
                    {h.pnlPct.toFixed(1)}% PnL
                  </p>
                </div>
              </Link>
            ))
          )}
        </section>
      )}

      {tab === "trades" && (
        <section className="border border-rh-raised">
          {profile.recentTrades.length === 0 ? (
            <p className="p-5 text-sm text-rh-dim">No indexed trades.</p>
          ) : (
            <div className="max-h-[560px] divide-y divide-rh-raised overflow-y-auto">
              {profile.recentTrades.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {t.isBuy ? (
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-rh-lime" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 shrink-0 text-red-400" />
                    )}
                    <span
                      className={t.isBuy ? "text-rh-lime" : "text-red-400"}
                    >
                      {t.isBuy ? "Buy" : "Sell"}
                    </span>
                    <Link
                      href={`/token/${t.tokenAddress}`}
                      className="truncate text-white hover:text-rh-lime"
                    >
                      {t.tokenSymbol
                        ? `$${t.tokenSymbol}`
                        : shortenAddress(t.tokenAddress, 4)}
                    </Link>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular-nums">
                      {formatEth(t.ethAmount)} ETH
                    </p>
                    <p className="text-[11px] text-rh-dim">
                      {timeAgo(t.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "analysis" && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 border border-rh-raised bg-black p-5">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4 text-rh-lime" />
              Trading style
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-rh-muted">Buy / sell mix</dt>
                <dd className="tabular-nums text-white">
                  {s.buyCount} buys · {s.sellCount} sells ({buySellRatio.toFixed(0)}%
                  buys)
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-rh-muted">Unique tokens traded</dt>
                <dd className="tabular-nums text-white">
                  {s.uniqueTokensTraded}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-rh-muted">Fees paid (est.)</dt>
                <dd className="tabular-nums text-white">
                  {formatEth(s.feesPaidEth)} ETH
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-rh-muted">Avg trade size</dt>
                <dd className="tabular-nums text-white">
                  {s.tradeCount > 0
                    ? `${formatEth(s.volumeTradedEth / s.tradeCount)} ETH`
                    : "—"}
                </dd>
              </div>
            </dl>
            <div className="pt-2">
              <p className="mb-1.5 text-[11px] text-rh-dim">Buy share</p>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full bg-rh-lime"
                  style={{ width: `${buySellRatio}%` }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border border-rh-raised bg-black p-5">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Coins className="h-4 w-4 text-rh-lime" />
              Creator footprint
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-rh-muted">Launches</dt>
                <dd className="tabular-nums text-white">{s.coinsCreated}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-rh-muted">Graduated</dt>
                <dd className="tabular-nums text-white">
                  {s.graduatedCreated} (
                  {s.coinsCreated
                    ? ((s.graduatedCreated / s.coinsCreated) * 100).toFixed(0)
                    : 0}
                  %)
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-rh-muted">Sum of live FDVs</dt>
                <dd className="tabular-nums text-white">
                  {formatEth(s.totalCreatedMcapEth)} ETH
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-rh-muted">Volume on their coins</dt>
                <dd className="tabular-nums text-white">
                  {formatEth(s.totalCreatedVolumeEth)} ETH
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-rh-muted">Est. creator fees</dt>
                <dd className="tabular-nums text-rh-lime">
                  {formatEth(s.estimatedCreatorFeesEth)} ETH
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4 border border-rh-raised bg-black p-5 lg:col-span-2">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Wallet className="h-4 w-4 text-rh-lime" />
              Portfolio concentration
            </h3>
            {profile.holdings.length === 0 ? (
              <p className="text-sm text-rh-dim">No holdings to analyze.</p>
            ) : (
              <ul className="space-y-3">
                {profile.holdings.slice(0, 8).map((h) => {
                  const share =
                    s.portfolioValueEth > 0
                      ? (h.valueEth / s.portfolioValueEth) * 100
                      : 0;
                  return (
                    <li key={h.token.address}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-white">${h.token.symbol}</span>
                        <span className="tabular-nums text-rh-muted">
                          {share.toFixed(1)}% · {formatEth(h.valueEth)} ETH
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-rh-lime"
                          style={{ width: `${Math.min(100, share)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-start gap-3 border border-rh-raised bg-black p-5 text-sm text-rh-muted lg:col-span-2">
            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-rh-lime" />
            <p className="leading-relaxed">
              Analytics are built from PumpRobin registry trades and launches.
              On-chain balances outside indexed curve trades, or activity on
              other launchpads, won&apos;t appear here yet. Creator fees are
              estimated at 1% of volume on coins they launched.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
