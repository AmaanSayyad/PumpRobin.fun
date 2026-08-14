"use client";

import { useEffect, useState } from "react";
import { CHAIN_CONFIG } from "@/lib/chain";
import { fetchEthUsdClient } from "@/lib/eth-usd";

/** Live ETH/USD for client components (falls back to config). */
export function useEthUsd(): number {
  const [usd, setUsd] = useState<number>(CHAIN_CONFIG.ethUsdFallback);

  useEffect(() => {
    let cancelled = false;
    void fetchEthUsdClient().then((price) => {
      if (!cancelled) setUsd(price);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return usd;
}
