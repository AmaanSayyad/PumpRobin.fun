"use client";

import Image from "next/image";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { getLeaderboard } from "@/lib/data";
import { formatEth } from "@/lib/utils";

export default function LeaderboardPage() {
  const { tokens, hydrated } = useAppStore();
  const leaderboard = getLeaderboard(tokens);

  return (
    <div className="rh-container py-12 sm:py-16 max-w-3xl">
      <h1 className="rh-display text-4xl sm:text-5xl mb-3">Leaderboard</h1>
      <p className="text-rh-muted mb-10">Top tokens by market cap.</p>

      {!hydrated ? (
        <p className="text-rh-dim text-sm">Loading…</p>
      ) : leaderboard.length === 0 ? (
        <div className="py-20 text-center">
          <p className="rh-display text-3xl mb-2">No rankings yet</p>
          <p className="text-rh-muted text-sm">Launch a token to appear here.</p>
        </div>
      ) : (
        <div className="border border-rh-raised divide-y divide-rh-raised">
          {leaderboard.map((entry) => (
            <Link
              key={entry.address}
              href={`/token/${entry.address}`}
              className="flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-rh-surface transition-colors"
            >
              <span className="w-8 text-rh-dim tabular-nums text-sm">{entry.rank}</span>
              <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-rh-raised shrink-0">
                <Image src={entry.imageUri} alt="" fill className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{entry.name}</p>
                <p className="text-xs text-rh-muted">${entry.symbol}</p>
              </div>
              <div className="text-right">
                <p className="text-sm tabular-nums">{formatEth(entry.marketCap)} ETH</p>
                <p className="text-xs text-rh-lime">{entry.progress.toFixed(0)}%</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
