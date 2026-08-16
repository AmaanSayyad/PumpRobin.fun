"use client";

import { useEffect, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { formatEther, type Address } from "viem";
import { CONTRACTS, PUMP_ROBIN_HOOK_ABI, PUMP_ROBIN_TOKEN_ABI } from "@/lib/contracts";
import { claimCreatorFees } from "@/lib/curve-trade";
import { friendlyWalletError } from "@/lib/utils";
import { RhButton } from "@/components/ui/rh-button";
import { readContract } from "@wagmi/core";

export function ClaimCreatorButton({
  token,
  curve,
}: {
  token: string;
  curve?: string;
}) {
  const { address } = useAccount();
  const config = useConfig();
  const [pending, setPending] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        let tokenWei = BigInt(0);
        if (address) {
          try {
            tokenWei = (await readContract(config, {
              address: token as Address,
              abi: PUMP_ROBIN_TOKEN_ABI,
              functionName: "pendingCreatorFeesOf",
              args: [address],
            })) as bigint;
          } catch {
            tokenWei = (await readContract(config, {
              address: token as Address,
              abi: PUMP_ROBIN_TOKEN_ABI,
              functionName: "pendingCreatorTokens",
            })) as bigint;
          }
        }
        let eth = 0;
        const hook = CONTRACTS.hook;
        if (hook) {
          try {
            const wei = await readContract(config, {
              address: hook,
              abi: PUMP_ROBIN_HOOK_ABI,
              functionName: "pendingCreatorFees",
              args: [token as Address],
            });
            eth = Number(formatEther(wei as bigint));
          } catch {
            eth = 0;
          }
        }
        if (!cancelled) {
          const tokens = Number(formatEther(tokenWei as bigint));
          setPending(eth > 0 ? eth : tokens);
        }
      } catch {
        if (!cancelled) setPending(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config, token, busy, address]);

  if (pending <= 0) return null;

  return (
    <div
      className="shrink-0"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <RhButton
        variant="ghost"
        className="px-3 py-1.5 text-xs"
        disabled={busy || !address}
        onClick={() => {
          setBusy(true);
          setError("");
          void claimCreatorFees({
            config,
            curve: (curve || token) as Address,
            token: token as Address,
          })
            .then(() => setPending(0))
            .catch((err) => setError(friendlyWalletError(err, "Claim failed")))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Claiming…" : `Claim fees`}
      </RhButton>
      {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
