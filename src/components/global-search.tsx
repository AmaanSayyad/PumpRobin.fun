"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { TokenLogo } from "@/components/token-logo";
import { formatUsd } from "@/lib/utils";
import type { TokenData } from "@/lib/data-types";

function revive(t: TokenData): TokenData {
  return {
    ...t,
    createdAt: t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt),
  };
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 20);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          const data = await res.json();
          setResults(((data.tokens ?? []) as TokenData[]).map(revive));
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 280);
    return () => window.clearTimeout(handle);
  }, [q]);

  const go = (address?: string) => {
    setOpen(false);
    setQ("");
    if (address) router.push(`/token/${address}`);
    else if (q.trim()) router.push(`/explore?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-10 min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-sm text-rh-muted hover:border-rh-lime/30 hover:text-white md:flex md:w-56 lg:w-72"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search tokens</span>
        <kbd className="ml-auto hidden rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-rh-dim lg:inline">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        aria-label="Search tokens"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-white md:hidden"
      >
        <Search className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            aria-label="Close search"
            className="absolute inset-0 bg-black/70"
            onClick={() => setOpen(false)}
          />
          <div className="relative mx-auto mt-[12vh] w-[min(40rem,calc(100%-1.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-4">
              <Search className="h-4 w-4 text-rh-dim" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    go(results[0]?.address);
                  }
                }}
                placeholder="Search name, ticker, or contract"
                className="h-14 w-full bg-transparent text-sm text-white outline-none placeholder:text-rh-dim"
              />
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-rh-dim hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {loading && (
                <p className="px-4 py-6 text-sm text-rh-muted">Searching Robinhood…</p>
              )}
              {!loading && q.trim() && results.length === 0 && (
                <p className="px-4 py-6 text-sm text-rh-muted">
                  No tokens found. Paste a contract address to open it.
                </p>
              )}
              {results.map((t) => (
                <button
                  key={t.address}
                  type="button"
                  onClick={() => go(t.address)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04]"
                >
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-rh-raised">
                    <TokenLogo src={t.imageUri} alt={t.name} symbol={t.symbol} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {t.name}{" "}
                      <span className="text-rh-muted">${t.symbol}</span>
                    </p>
                    <p className="truncate font-mono text-[11px] text-rh-dim">
                      {t.address}
                    </p>
                  </div>
                  <span className="text-xs tabular-nums text-rh-muted">
                    {t.metadata?.marketCapUsd
                      ? formatUsd(t.metadata.marketCapUsd)
                      : t.source === "market"
                        ? "—"
                        : "PumpRobin"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
