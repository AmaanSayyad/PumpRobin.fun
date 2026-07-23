"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  LogOut,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatEthBalance(displayBalance?: string): { amount: string; unit: string } | null {
  if (!displayBalance) return null;
  const match = displayBalance.match(/^([\d,.]+)\s*(.*)$/);
  if (!match) return { amount: displayBalance, unit: "" };
  const raw = match[1].replace(/,/g, "");
  const unit = match[2] || "ETH";
  const n = Number(raw);
  if (!Number.isFinite(n)) return { amount: displayBalance, unit: "" };
  const amount =
    n === 0
      ? "0"
      : n < 0.0001
        ? n.toExponential(2)
        : n < 1
          ? n.toFixed(4)
          : n < 100
            ? n.toFixed(3)
            : n.toFixed(2);
  return { amount, unit };
}

function addressHue(address?: string) {
  if (!address) return 72;
  return parseInt(address.slice(2, 8), 16) % 360;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/**
 * MetaMask’s connect popup does not select an account when you click its name.
 * Fresh reconnect after revoke is the reliable path: user uses “Edit accounts”
 * (or switches the active account at the top of MetaMask) then Connect.
 */
async function forceAccountPicker(provider: Eip1193Provider): Promise<string[] | null> {
  try {
    await provider.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    /* some wallets don’t support revoke — still try requestAccounts */
  }

  try {
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];
    return Array.isArray(accounts) ? accounts : null;
  } catch {
    return null;
  }
}

export function WalletButton({
  className,
  tone = "dark",
}: {
  className?: string;
  /** dark = black navbar · light = lime drawer */
  tone?: "dark" | "light";
}) {
  const isLight = tone === "light";
  const { address, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectAsync } = useConnect();
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<"menu" | "switch">("menu");
  const [copied, setCopied] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setPanel("menu");
    setSwitchError("");
  }, [address]);

  useEffect(() => {
    if (!menuOpen) {
      setPanel("menu");
      setSwitchError("");
      return;
    }
    const onPointer = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  const handleCopy = useCallback(async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
    } catch {
      /* ignore */
    }
  }, []);

  const handleSwitchAccount = useCallback(
    async (openConnectModal?: () => void) => {
      setSwitchError("");
      setSwitching(true);
      const activeConnector = connector;

      try {
        const provider = (await activeConnector?.getProvider?.()) as
          | Eip1193Provider
          | undefined;

        if (provider?.request) {
          const accounts = await forceAccountPicker(provider);
          if (accounts && accounts.length > 0) {
            // Permissions refreshed — reconnect wagmi so UI tracks the new active account
            try {
              disconnect();
              if (activeConnector) {
                await connectAsync({ connector: activeConnector });
              }
            } catch {
              openConnectModal?.();
            }
            setMenuOpen(false);
            setPanel("menu");
            return;
          }
        }

        disconnect();
        setMenuOpen(false);
        setPanel("menu");
        openConnectModal?.();
      } catch {
        setSwitchError(
          "MetaMask blocked the switch. Click Edit accounts in the popup, check the account you want, then Connect."
        );
      } finally {
        setSwitching(false);
      }
    },
    [connector, connectAsync, disconnect]
  );

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        const balance = formatEthBalance(account?.displayBalance);

        return (
          <div
            ref={menuRef}
            className={cn(
              "relative flex items-center",
              !ready && "pointer-events-none select-none opacity-0",
              className
            )}
            aria-hidden={!ready}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className={cn(
                      "rh-pill h-9 px-3 text-sm font-medium transition-colors sm:h-10 sm:px-5",
                      isLight
                        ? "border border-rh-on-lime/30 text-rh-on-lime hover:bg-rh-on-lime/10"
                        : "border border-rh-lime text-white hover:bg-rh-lime hover:text-rh-on-lime"
                    )}
                  >
                    <span className="sm:hidden">Connect</span>
                    <span className="hidden sm:inline">Connect Wallet</span>
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    type="button"
                    onClick={openChainModal}
                    className="rh-pill h-9 border border-red-500/40 bg-red-500/15 px-4 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/25 sm:h-10"
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <>
                  <div
                    className={cn(
                      "rh-pill inline-flex h-9 items-stretch overflow-hidden p-0 sm:h-10",
                      isLight
                        ? "border border-rh-on-lime/20 bg-rh-on-lime/10"
                        : "border border-rh-border bg-rh-raised"
                    )}
                  >
                    {/* Mobile: balance only */}
                    <button
                      type="button"
                      onClick={() => setMenuOpen((v) => !v)}
                      aria-expanded={menuOpen}
                      aria-haspopup="menu"
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 text-sm font-medium tabular-nums transition-colors sm:hidden",
                        isLight
                          ? "text-rh-on-lime hover:bg-rh-on-lime/10"
                          : "text-white/90 hover:bg-white/[0.04]"
                      )}
                      title="Wallet"
                    >
                      <span
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 rounded-full",
                          isLight
                            ? "ring-1 ring-rh-on-lime/25"
                            : "ring-1 ring-white/10"
                        )}
                        style={{
                          background: `linear-gradient(135deg, #CCFF00 0%, hsl(${addressHue(
                            account.address
                          )} 62% 40%) 100%)`,
                        }}
                      />
                      {balance ? (
                        <>
                          <span className="font-medium">{balance.amount}</span>
                          {balance.unit ? (
                            <span
                              className={cn(
                                "text-[10px] uppercase tracking-wide",
                                isLight ? "text-rh-on-lime/55" : "text-rh-muted"
                              )}
                            >
                              {balance.unit}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="max-w-[4.25rem] truncate">
                          {account.displayName}
                        </span>
                      )}
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 opacity-60 transition-transform",
                          menuOpen && "rotate-180",
                          isLight ? "text-rh-on-lime" : "text-rh-muted"
                        )}
                        strokeWidth={2}
                      />
                    </button>

                    {/* Desktop: balance + address */}
                    {balance && (
                      <button
                        type="button"
                        onClick={() => setMenuOpen((v) => !v)}
                        className={cn(
                          "hidden items-center gap-1.5 px-3 text-sm font-medium tabular-nums transition-colors sm:inline-flex sm:px-3.5",
                          isLight
                            ? "text-rh-on-lime hover:bg-rh-on-lime/10"
                            : "text-white/90 hover:bg-white/[0.04]"
                        )}
                        title="Wallet balance"
                      >
                        <span className="font-medium">{balance.amount}</span>
                        {balance.unit ? (
                          <span
                            className={cn(
                              "text-[11px] uppercase tracking-wide",
                              isLight ? "text-rh-on-lime/55" : "text-rh-muted"
                            )}
                          >
                            {balance.unit}
                          </span>
                        ) : null}
                      </button>
                    )}

                    {balance && (
                      <span
                        className={cn(
                          "my-1.5 hidden w-px self-stretch sm:block",
                          isLight ? "bg-rh-on-lime/20" : "bg-rh-border"
                        )}
                        aria-hidden
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => setMenuOpen((v) => !v)}
                      aria-expanded={menuOpen}
                      aria-haspopup="menu"
                      className={cn(
                        "hidden min-w-0 items-center gap-2 pl-2 pr-3 text-sm font-medium transition-colors sm:inline-flex",
                        isLight
                          ? "text-rh-on-lime hover:bg-rh-on-lime/10"
                          : "text-white hover:bg-white/[0.04]"
                      )}
                    >
                      {account.ensAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={account.ensAvatar}
                          alt=""
                          className="h-[22px] w-[22px] shrink-0 rounded-full"
                        />
                      ) : (
                        <span
                          className={cn(
                            "h-[22px] w-[22px] shrink-0 rounded-full",
                            isLight
                              ? "ring-1 ring-rh-on-lime/25"
                              : "ring-1 ring-white/10"
                          )}
                          style={{
                            background: `linear-gradient(135deg, #CCFF00 0%, hsl(${addressHue(
                              account.address
                            )} 62% 40%) 100%)`,
                          }}
                        />
                      )}
                      <span className="max-w-[7rem] truncate">{account.displayName}</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 opacity-60 transition-transform",
                          menuOpen && "rotate-180",
                          isLight ? "text-rh-on-lime" : "text-rh-muted"
                        )}
                        strokeWidth={2}
                      />
                    </button>
                  </div>

                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-[calc(100%+10px)] z-[80] w-[min(100vw-2rem,300px)] overflow-hidden rounded-2xl border border-white/10 bg-[#141414] shadow-[0_24px_64px_-20px_rgba(0,0,0,0.85)]"
                    >
                      {panel === "menu" ? (
                        <>
                          <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5">
                            <div className="min-w-0">
                              <p className="truncate font-mono text-sm text-white">
                                {shortenAddress(account.address)}
                              </p>
                              {balance && (
                                <p className="mt-0.5 text-xs tabular-nums text-rh-muted">
                                  {balance.amount} {balance.unit}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              aria-label="Close"
                              onClick={() => setMenuOpen(false)}
                              className="rounded-lg p-1 text-rh-muted hover:bg-white/5 hover:text-white"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="p-1.5">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => setPanel("switch")}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white transition-colors hover:bg-white/[0.05]"
                            >
                              <RefreshCw className="h-4 w-4 shrink-0 text-rh-lime" />
                              <span className="flex-1">
                                <span className="block font-medium">Switch account</span>
                                <span className="block text-[11px] text-rh-muted">
                                  Change to another MetaMask address
                                </span>
                              </span>
                            </button>

                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => void handleCopy(account.address)}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white transition-colors hover:bg-white/[0.05]"
                            >
                              {copied ? (
                                <Check className="h-4 w-4 shrink-0 text-rh-lime" />
                              ) : (
                                <Copy className="h-4 w-4 shrink-0 text-rh-muted" />
                              )}
                              <span>{copied ? "Copied" : "Copy address"}</span>
                            </button>

                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuOpen(false);
                                disconnect();
                              }}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-300 transition-colors hover:bg-red-500/10"
                            >
                              <LogOut className="h-4 w-4 shrink-0" />
                              <span>Disconnect</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="p-3.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPanel("menu");
                              setSwitchError("");
                            }}
                            className="mb-3 inline-flex items-center gap-1.5 text-xs text-rh-muted hover:text-white"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back
                          </button>

                          <p className="text-sm font-medium text-white">Switch account</p>
                          <ol className="mt-2.5 list-decimal space-y-2 pl-4 text-[12px] leading-relaxed text-rh-muted">
                            <li>
                              In MetaMask, tap{" "}
                              <span className="font-medium text-white">Edit accounts</span>{" "}
                              (pencil) — clicking a name alone does nothing.
                            </li>
                            <li>
                              Check the account you want (e.g. Account 45), uncheck others if
                              needed.
                            </li>
                            <li>
                              Tap <span className="font-medium text-white">Connect</span>.
                            </li>
                          </ol>

                          <p className="mt-2.5 text-[11px] leading-snug text-rh-dim">
                            Tip: you can also switch the active account at the top of the
                            MetaMask extension first, then continue here.
                          </p>

                          {switchError && (
                            <p className="mt-2.5 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-100/95">
                              {switchError}
                            </p>
                          )}

                          <button
                            type="button"
                            disabled={switching}
                            onClick={() => void handleSwitchAccount(openConnectModal)}
                            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-rh-lime px-3 py-2.5 text-sm font-semibold text-rh-on-lime transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            <RefreshCw
                              className={cn("h-4 w-4", switching && "animate-spin")}
                            />
                            {switching ? "Waiting for MetaMask…" : "Open MetaMask"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
