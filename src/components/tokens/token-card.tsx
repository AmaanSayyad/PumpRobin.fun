"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { cn, formatEth, timeAgo } from "@/lib/utils";
import type { TokenData } from "@/lib/data";

interface TokenCardProps {
  token: TokenData;
  index?: number;
}

export function TokenCard({ token, index = 0 }: TokenCardProps) {
  const change = token.priceChange24h;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.03 }}
    >
      <Link
        href={`/token/${token.address}`}
        className="block bg-rh-surface border border-rh-raised p-5 hover:border-rh-border transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-rh-raised shrink-0">
            <Image src={token.imageUri} alt={token.name} fill className="object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium truncate">{token.name}</h3>
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
            <div className="mt-3 flex items-center gap-3 text-xs text-rh-muted">
              <span>{formatEth(token.marketCap)} ETH mcap</span>
              <span>{token.holders} holders</span>
              <span>{timeAgo(token.createdAt)}</span>
            </div>
            <div className="mt-3 h-1 bg-black rounded-full overflow-hidden">
              <div
                className="h-full bg-rh-lime rounded-full"
                style={{ width: `${Math.min(100, token.progress)}%` }}
              />
            </div>
            <p className="text-xs text-rh-muted mt-1.5">
              {token.graduated ? "Graduated" : `${token.progress.toFixed(0)}% to graduate`}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
