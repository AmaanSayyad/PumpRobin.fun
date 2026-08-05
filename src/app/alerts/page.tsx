"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useAccount,
  useConfig,
  useSendTransaction,
} from "wagmi";
import { parseEther } from "viem";
import { waitForTransactionReceipt } from "@wagmi/core";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Bell, Check, MessageCircle, Send } from "lucide-react";
import { RhButton } from "@/components/ui/rh-button";
import { CHAIN_CONFIG, FEE_COLLECTOR, explorerTxUrl } from "@/lib/chain";
import { friendlyWalletError, shortenAddress } from "@/lib/utils";

type SubRow = {
  id: string;
  status: string;
  telegram?: string;
  discord?: string;
  txHash: string;
  createdAt: string;
};

export default function AlertsPage() {
  const { address, isConnected } = useAccount();
  const wagmiConfig = useConfig();
  const { sendTransactionAsync, isPending } = useSendTransaction();

  const [telegram, setTelegram] = useState("");
  const [discord, setDiscord] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [successTx, setSuccessTx] = useState<string | null>(null);
  const [subs, setSubs] = useState<SubRow[]>([]);

  const loadSubs = async (wallet: string) => {
    try {
      const res = await fetch(`/api/alerts/subscribe?wallet=${wallet}`);
      const data = await res.json();
      if (res.ok) setSubs(data.subscriptions ?? []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (address) void loadSubs(address);
  }, [address]);

  const subscribe = async () => {
    if (!address) return;
    setError("");
    setSuccessTx(null);
    if (!telegram.trim() && !discord.trim()) {
      setError("Add Telegram (@handle) and/or Discord (user#0000 or username).");
      return;
    }
    try {
      const hash = await sendTransactionAsync({
        to: FEE_COLLECTOR,
        value: parseEther(CHAIN_CONFIG.alertsSubEth),
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });

      const res = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          txHash: hash,
          telegram: telegram.trim() || undefined,
          discord: discord.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record subscription");

      setSuccessTx(hash);
      setTelegram("");
      setDiscord("");
      setEmail("");
      await loadSubs(address);
    } catch (err) {
      setError(friendlyWalletError(err, "Payment failed"));
    }
  };

  return (
    <div className="rh-container py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <p className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-rh-lime">
          <Bell className="h-4 w-4" />
          Alerts
        </p>
        <h1 className="rh-display text-3xl text-white sm:text-4xl">
          Telegram & Discord alerts
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-rh-muted">
          Get whale buys, new launches, and graduation pings in your channel.
          Pay once — our team activates you manually within ~24h.
        </p>

        <div className="mt-8 grid gap-px bg-rh-raised sm:grid-cols-3">
          {[
            {
              label: "Price",
              value: `$${CHAIN_CONFIG.alertsSubUsdHint}`,
              hint: `${CHAIN_CONFIG.alertsSubEth} ETH`,
            },
            {
              label: "Duration",
              value: `${CHAIN_CONFIG.alertsSubDays} days`,
              hint: "Then renew",
            },
            {
              label: "Setup",
              value: "Manual",
              hint: "Team onboards you",
            },
          ].map((s) => (
            <div key={s.label} className="bg-black p-4 text-center">
              <p className="text-[11px] uppercase tracking-wider text-rh-dim">
                {s.label}
              </p>
              <p className="mt-1 text-lg font-medium text-white">{s.value}</p>
              <p className="mt-1 text-[11px] text-rh-muted">{s.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-4 border border-rh-raised bg-black p-5 sm:p-6">
          <h2 className="text-sm font-medium text-white">Subscribe</h2>
          <p className="text-xs leading-relaxed text-rh-dim">
            After payment, leave at least one handle. We&apos;ll DM / add you to
            the alert feed. Status stays <span className="text-rh-muted">pending</span>{" "}
            until ops flips it to active.
          </p>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs text-rh-muted">
              <Send className="h-3.5 w-3.5" /> Telegram
            </span>
            <input
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="@yourhandle or t.me/…"
              className="w-full rounded-xl border border-rh-raised bg-black px-4 py-3 text-sm focus:border-rh-lime focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs text-rh-muted">
              <MessageCircle className="h-3.5 w-3.5" /> Discord
            </span>
            <input
              value={discord}
              onChange={(e) => setDiscord(e.target.value)}
              placeholder="username or user#0000"
              className="w-full rounded-xl border border-rh-raised bg-black px-4 py-3 text-sm focus:border-rh-lime focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs text-rh-muted">
              Email (optional)
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-rh-raised bg-black px-4 py-3 text-sm focus:border-rh-lime focus:outline-none"
            />
          </label>

          {error && (
            <p className="text-xs leading-snug text-red-400">{error}</p>
          )}
          {successTx && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-rh-lime">
              <Check className="h-3.5 w-3.5" />
              Payment received — we&apos;ll activate soon.{" "}
              <a
                href={explorerTxUrl(successTx)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View tx
              </a>
            </p>
          )}

          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openChainModal, mounted }) => {
              if (!mounted) {
                return (
                  <RhButton className="w-full" disabled>
                    Loading…
                  </RhButton>
                );
              }
              if (chain?.unsupported) {
                return (
                  <RhButton className="w-full" onClick={openChainModal}>
                    Switch network
                  </RhButton>
                );
              }
              if (!isConnected && !account) {
                return (
                  <RhButton className="w-full" onClick={openConnectModal}>
                    Connect wallet
                  </RhButton>
                );
              }
              return (
                <RhButton
                  className="w-full"
                  disabled={isPending}
                  onClick={() => void subscribe()}
                >
                  {isPending
                    ? "Confirm in wallet…"
                    : `Pay ${CHAIN_CONFIG.alertsSubEth} ETH · ~$${CHAIN_CONFIG.alertsSubUsdHint}`}
                </RhButton>
              );
            }}
          </ConnectButton.Custom>
        </div>

        {subs.length > 0 && (
          <div className="mt-8 border border-rh-raised p-5">
            <h3 className="mb-3 text-sm font-medium">Your requests</h3>
            <ul className="space-y-3">
              {subs.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <div>
                    <p className="text-white">
                      {s.telegram || s.discord || "—"}{" "}
                      <span className="text-rh-dim">· {s.status}</span>
                    </p>
                    <p className="font-mono text-[11px] text-rh-dim">
                      {shortenAddress(s.txHash, 6)}
                    </p>
                  </div>
                  <a
                    href={explorerTxUrl(s.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-rh-lime hover:underline"
                  >
                    Tx
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10 border border-rh-raised bg-black p-5">
          <h3 className="mb-2 text-sm font-medium text-white">
            Creator fees — paid on every trade
          </h3>
          <p className="text-sm leading-relaxed text-rh-muted">
            On every bonding-curve buy/sell, traders pay{" "}
            <span className="text-white">
              {CHAIN_CONFIG.tradeFeeBps / 100}%
            </span>{" "}
            total:{" "}
            <span className="text-rh-lime">
              {CHAIN_CONFIG.creatorFeeBps / 100}%
            </span>{" "}
            goes to the creator fee collector, and{" "}
            <span className="text-white">
              {CHAIN_CONFIG.platformFeeBps / 100}%
            </span>{" "}
            goes to PumpRobin — both instantly. Post-graduation Uniswap LP fees
            are on the roadmap.
          </p>
          <Link
            href="/earn"
            className="mt-3 inline-block text-sm text-rh-lime hover:underline"
          >
            Learn more on Earn →
          </Link>
        </div>
      </div>
    </div>
  );
}
