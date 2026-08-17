"use client";

import { useEffect, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { type Address } from "viem";
import { claimCreatorFees, readPendingFees, type PendingFees } from "@/lib/curve-trade";
import { friendlyWalletError } from "@/lib/utils";
import { RhButton } from "@/components/ui/rh-button";

/**
 * Creator fees accrue in ETH on the bonding curve before graduation and on the
 * v4 hook after it — readPendingFees adds both, and follows the splitter when
 * the 1% was shared between wallets.
 */
export function ClaimCreatorButton({
  token,
  curve,
}: {
  token: string;
  curve?: string;
}) {
  const { address } = useAccount();
  const config = useConfig();
  const [fees, setFees] = useState<PendingFees | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !curve) return;
    let cancelled = false;
    void readPendingFees(config, curve as Address, 0, token as Address, address)
      .then((next) => {
        if (!cancelled) setFees(next);
      })
      .catch(() => {
        if (!cancelled) setFees(null);
      });
    return () => {
      cancelled = true;
    };
  }, [config, token, curve, busy, address]);

  if (!fees?.creatorClaimable) return null;

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
            feeShare: fees.feeShare,
          })
            .then(() => setFees(null))
            .catch((err) => setError(friendlyWalletError(err, "Claim failed")))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Claiming…" : "Claim fees"}
      </RhButton>
      {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
