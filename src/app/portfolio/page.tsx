"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useAppStore } from "@/lib/store";
import { RhButton } from "@/components/ui/rh-button";
import { TokenCard } from "@/components/tokens/token-card";
import { formatEth, formatNumber, shortenAddress } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { MediaFrame, SplitBlock } from "@/components/ui/media-frame";

function BgVideo({
  desktop,
  mobile,
  poster,
  className = "",
}: {
  desktop: string;
  mobile?: string;
  poster?: string;
  className?: string;
}) {
  return (
    <div className={`absolute inset-0 bg-black overflow-hidden ${className}`}>
      <video
        className={`absolute inset-0 h-full w-full object-cover ${mobile ? "hidden md:block" : ""}`}
        autoPlay
        muted
        loop
        playsInline
        poster={poster}
      >
        <source src={desktop} type={desktop.endsWith(".mp4") ? "video/mp4" : "video/webm"} />
      </video>
      {mobile && (
        <video
          className="absolute inset-0 h-full w-full object-cover md:hidden"
          autoPlay
          muted
          loop
          playsInline
          poster={poster}
        >
          <source src={mobile} type={mobile.endsWith(".mp4") ? "video/mp4" : "video/webm"} />
        </video>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const { isConnected, address } = useAccount();
  const { tokens, trades } = useAppStore();

  const created = useMemo(() => {
    if (!address) return [];
    return tokens.filter(
      (t) => t.creator.toLowerCase() === address.toLowerCase()
    );
  }, [tokens, address]);

  const holdings = useMemo(() => {
    if (!address) return [];
    const addr = address.toLowerCase();
    const balances = new Map<string, number>();
    const cost = new Map<string, number>();

    for (const trade of trades) {
      if (trade.trader.toLowerCase() !== addr) continue;
      const prev = balances.get(trade.tokenAddress) ?? 0;
      const prevCost = cost.get(trade.tokenAddress) ?? 0;
      if (trade.isBuy) {
        balances.set(trade.tokenAddress, prev + trade.tokenAmount);
        cost.set(trade.tokenAddress, prevCost + trade.ethAmount);
      } else {
        balances.set(trade.tokenAddress, prev - trade.tokenAmount);
        cost.set(trade.tokenAddress, Math.max(0, prevCost - trade.ethAmount));
      }
    }

    return tokens
      .map((t) => {
        const balance = balances.get(t.address) ?? 0;
        if (balance <= 1e-12) return null;
        const value = balance * t.price;
        const spent = cost.get(t.address) ?? 0;
        const pnl = spent > 0 ? ((value - spent) / spent) * 100 : 0;
        return { ...t, balance, value, pnl };
      })
      .filter(Boolean) as Array<
      (typeof tokens)[0] & { balance: number; value: number; pnl: number }
    >;
  }, [tokens, trades, address]);

  const totalValue = holdings.reduce((s, h) => s + h.value, 0);

  return (
    <div className="bg-black">
      {/* Hero — Strategies product header video */}
      <section className="relative min-h-[72vh] sm:min-h-[80vh] flex items-end sm:items-center overflow-hidden">
        <BgVideo
          desktop="/brand/strategies/header-desktop.webm"
          mobile="/brand/strategies/header-mobile.webm"
          poster="/brand/strategies/header-poster.jpg"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />

        <div className="relative z-10 rh-container w-full py-16 sm:py-24">
          <p className="text-rh-lime text-sm font-medium mb-4">Portfolio</p>
          <h1 className="rh-display text-4xl sm:text-5xl lg:text-6xl text-white max-w-2xl mb-5">
            Your tokens, tracked in one place
          </h1>
          <p className="text-white/70 text-lg max-w-lg mb-8 leading-relaxed">
            Holdings, launches, and PnL from real trades on PumpRobin.fun —
            bonding curves to DEX graduation.
          </p>
          {!isConnected ? (
            <p className="text-white/55 text-sm">Connect your wallet to load your portfolio.</p>
          ) : (
            <p className="font-mono text-sm text-white/55">{shortenAddress(address!, 6)}</p>
          )}
        </div>
      </section>

      {/* Live portfolio data */}
      {isConnected && address && (
        <section className="rh-container py-16 sm:py-20 max-w-3xl">
          <div className="grid grid-cols-3 gap-px bg-rh-raised mb-12">
            <div className="bg-black p-5">
              <p className="text-xs text-rh-muted mb-1">Value</p>
              <p className="rh-display text-2xl">{formatEth(totalValue)} ETH</p>
            </div>
            <div className="bg-black p-5">
              <p className="text-xs text-rh-muted mb-1">Holdings</p>
              <p className="rh-display text-2xl">{holdings.length}</p>
            </div>
            <div className="bg-black p-5">
              <p className="text-xs text-rh-muted mb-1">Created</p>
              <p className="rh-display text-2xl">{created.length}</p>
            </div>
          </div>

          <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-4">Holdings</h2>
          {holdings.length === 0 ? (
            <p className="text-rh-muted text-sm mb-12">
              No token balances from recorded trades.
            </p>
          ) : (
            <div className="space-y-2 mb-12">
              {holdings.map((h) => (
                <Link
                  key={h.address}
                  href={`/token/${h.address}`}
                  className="flex items-center justify-between gap-4 border border-rh-raised p-4 hover:bg-rh-raised/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-rh-raised">
                      <Image src={h.imageUri} alt="" fill className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{h.name}</p>
                      <p className="text-xs text-rh-muted">
                        {formatNumber(h.balance, 0)} ${h.symbol}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums">{formatEth(h.value)} ETH</p>
                    <p className={`text-xs ${h.pnl >= 0 ? "text-rh-lime" : "text-red-400"}`}>
                      {h.pnl >= 0 ? "+" : ""}
                      {h.pnl.toFixed(1)}%
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-4">Created</h2>
          {created.length === 0 ? (
            <p className="text-rh-muted text-sm mb-4">You haven&apos;t launched a token yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 mb-8">
              {created.map((t, i) => (
                <TokenCard key={t.address} token={t} index={i} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="py-20 sm:py-28">
        <div className="rh-container">
          <SplitBlock
            copy={
              <>
                <h2 className="rh-display text-3xl sm:text-4xl mb-5">
                  Cutting-edge tech meets onchain trading
                </h2>
                <p className="text-rh-muted text-lg leading-relaxed mb-8 max-w-md">
                  Watch price discovery unfold on bonding curves. Track gains and
                  losses in real time as you buy, sell, and graduate to DEX liquidity.
                </p>
                <RhButton href="/explore" variant="outline" size="sm">
                  Explore tokens
                </RhButton>
              </>
            }
            media={
              <MediaFrame aspect="video">
                <BgVideo
                  desktop="/brand/strategies/insights-desktop.webm"
                  mobile="/brand/strategies/insights-mobile.webm"
                  poster="/brand/strategies/insights-poster.jpg"
                />
              </MediaFrame>
            }
          />
        </div>
      </section>

      <section className="py-16 sm:py-24 border-y border-rh-raised">
        <div className="rh-container">
          <h2 className="rh-display text-3xl sm:text-4xl text-center mb-14">
            This is more than a launchpad
          </h2>
          <div className="grid md:grid-cols-2 gap-10 max-w-4xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <MediaFrame aspect="feature" size="md" className="mb-6">
                <Image
                  src="/brand/strategies/gains-loss.png"
                  alt=""
                  fill
                  className="object-contain p-3 sm:p-4"
                  sizes="(max-width:768px) 100vw, 384px"
                />
              </MediaFrame>
              <h3 className="text-xl font-medium mb-2">Gains &amp; losses</h3>
              <p className="text-rh-muted text-sm max-w-xs">
                See PnL on every holding from actual trade history — not mock numbers.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <MediaFrame aspect="feature" size="md" className="mb-6">
                <Image
                  src="/brand/strategies/tax.png"
                  alt=""
                  fill
                  className="object-contain p-3 sm:p-4"
                  sizes="(max-width:768px) 100vw, 384px"
                />
              </MediaFrame>
              <h3 className="text-xl font-medium mb-2">Clear activity</h3>
              <p className="text-rh-muted text-sm max-w-xs">
                Launches you created and tokens you hold, in one portfolio view.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="rh-container">
          <SplitBlock
            reverse
            copy={
              <>
                <h2 className="rh-display text-3xl sm:text-4xl mb-5">
                  Built for builders on Robinhood Chain
                </h2>
                <p className="text-rh-muted text-lg leading-relaxed mb-8 max-w-md">
                  Launch an ERC-20, trade the curve, and graduate when the market
                  is ready — with ETH gas and standard EVM wallets.
                </p>
                <RhButton href="/docs" variant="outline" size="sm">
                  Read the docs
                </RhButton>
              </>
            }
            media={
              <MediaFrame aspect="video">
                <BgVideo
                  desktop="/brand/strategies/expert-minds.mp4"
                  poster="/brand/strategies/expert-poster.jpg"
                />
              </MediaFrame>
            }
          />
        </div>
      </section>

      {/* Closing footer video CTA */}
      <section className="relative min-h-[60vh] sm:min-h-[70vh] flex items-center justify-center overflow-hidden">
        <BgVideo
          desktop="/brand/strategies/footer-desktop.webm"
          mobile="/brand/strategies/footer-mobile.webm"
          poster="/brand/strategies/footer-poster.png"
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 text-center px-5 py-24">
          <h2 className="rh-display text-4xl sm:text-5xl text-white mb-8">
            Start building your portfolio
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <RhButton href="/launch" size="lg">
              Launch a token
            </RhButton>
            <RhButton href="/explore" variant="outline" size="lg">
              Explore
            </RhButton>
          </div>
        </div>
      </section>
    </div>
  );
}
