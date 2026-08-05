"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Globe } from "lucide-react";
import { cn, formatEth, shortenAddress, timeAgo } from "@/lib/utils";
import type { TokenData } from "@/lib/data";
import { TokenLogo } from "@/components/token-logo";

interface TokenCardProps {
  token: TokenData;
  index?: number;
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

function normalizeHref(url?: string): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("t.me/") || u.startsWith("x.com/") || u.startsWith("twitter.com/")) {
    return `https://${u}`;
  }
  return `https://${u}`;
}

export function TokenCard({ token, index = 0 }: TokenCardProps) {
  const change = token.priceChange24h;
  const website = normalizeHref(token.metadata?.website);
  const twitter = normalizeHref(token.metadata?.twitter);
  const telegram = normalizeHref(token.metadata?.telegram);
  const hasSocials = Boolean(website || twitter || telegram);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.03 }}
      className="bg-rh-surface border border-rh-raised transition-colors hover:border-rh-border"
    >
      <Link href={`/token/${token.address}`} className="block p-5 pb-3">
        <div className="flex items-start gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-rh-raised">
            <TokenLogo
              src={token.imageUri}
              alt={token.name}
              symbol={token.symbol}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-medium">{token.name}</h3>
                <span className="text-xs text-rh-muted">${token.symbol}</span>
              </div>
              {change !== 0 && (
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    change >= 0 ? "text-rh-lime" : "text-red-400"
                  )}
                >
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-rh-muted">
              <span>{formatEth(token.marketCap)} ETH mcap</span>
              <span>{token.holders} holders</span>
              <span>{timeAgo(token.createdAt)}</span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-black">
              <div
                className="h-full rounded-full bg-rh-lime"
                style={{ width: `${Math.min(100, token.progress)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-rh-muted">
              {token.graduated
                ? "Graduated"
                : `${token.progress.toFixed(0)}% to graduate`}
            </p>
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-2 border-t border-rh-raised/60 px-5 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {hasSocials ? (
            <>
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Website"
                  aria-label={`${token.symbol} website`}
                  className="rounded-md p-1.5 text-rh-muted transition-colors hover:bg-white/5 hover:text-rh-lime"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Globe className="h-3.5 w-3.5" />
                </a>
              )}
              {twitter && (
                <a
                  href={twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="X / Twitter"
                  aria-label={`${token.symbol} on X`}
                  className="rounded-md p-1.5 text-rh-muted transition-colors hover:bg-white/5 hover:text-rh-lime"
                  onClick={(e) => e.stopPropagation()}
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
                  aria-label={`${token.symbol} Telegram`}
                  className="rounded-md p-1.5 text-rh-muted transition-colors hover:bg-white/5 hover:text-rh-lime"
                  onClick={(e) => e.stopPropagation()}
                >
                  <TelegramIcon className="h-3.5 w-3.5" />
                </a>
              )}
            </>
          ) : (
            <span className="text-[10px] text-rh-dim">No socials</span>
          )}
        </div>

        <Link
          href={`/wallet/${token.creator}`}
          title="Creator profile"
          className="shrink-0 font-mono text-[11px] text-rh-muted transition-colors hover:text-rh-lime"
          onClick={(e) => e.stopPropagation()}
        >
          {shortenAddress(token.creator, 4)}
        </Link>
      </div>
    </motion.div>
  );
}
