"use client";

import { useMemo, useState, useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useBalance,
  useConfig,
  useSendTransaction,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { decodeEventLog, formatEther, isAddress, parseEther, type Hash } from "viem";
import { waitForTransactionReceipt } from "@wagmi/core";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Globe,
  ImageIcon,
  MessageCircle,
  Plus,
  Percent,
  Shield,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { RhButton } from "@/components/ui/rh-button";
import { EthWithUsd } from "@/components/eth-with-usd";
import {
  CHAIN_CONFIG,
  FEE_COLLECTOR,
  OWNERSHIP_PRESETS,
  explorerAddressUrl,
  explorerTxUrl,
} from "@/lib/chain";
import { BONDING_CURVE_ABI, CONTRACTS, PUMP_ROBIN_FACTORY_ABI } from "@/lib/contracts";
import { useAppStore } from "@/lib/store";
import { cn, formatEthWithUsd, formatUsd, friendlyWalletError, shortenAddress } from "@/lib/utils";
import { useEthUsd } from "@/lib/use-eth-usd";
import {
  LAUNCH_EXTRA_SOCIAL_FIELDS,
  LAUNCH_PRIMARY_SOCIAL_FIELDS,
  LAUNCH_SOCIAL_FIELDS,
  pickSocialMetadata,
  type LaunchSocialKey,
} from "@/lib/data-client";
import type { LaunchMetadata } from "@/lib/data-types";
import {
  DEFAULT_SUPPLY,
  ethInForSupplyPercent,
  formatSupplyShort,
  launchBuyEth,
  minEthToLaunch,
  supplyPercentForEthIn,
  uniswapBuyImpactPct,
} from "@/lib/curve";

const EMPTY_SOCIALS = Object.fromEntries(
  LAUNCH_SOCIAL_FIELDS.map(({ key }) => [key, ""])
) as Record<LaunchSocialKey, string>;

type FeeShareRow = { address: string; pct: string };

const LAUNCH_DRAFT_KEY = "pumprobin.launch-draft.v1";

type LaunchDraft = {
  name: string;
  symbol: string;
  description: string;
  imagePreview: string | null;
  bannerPreview: string | null;
  socials: Record<LaunchSocialKey, string>;
  showSocials: boolean;
  showBanner: boolean;
  communityCoin: boolean;
  communityBoard: boolean;
  maxWallet2pct: boolean;
  antiSnipe: boolean;
  customSupply: boolean;
  supply: number;
  decimals: number;
  initialBuyEth: string;
  ownershipPct: number | null;
  feeSharing: boolean;
  feeShares: FeeShareRow[];
};

function readLaunchDraft(): LaunchDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAUNCH_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LaunchDraft;
  } catch {
    return null;
  }
}

function writeLaunchDraft(draft: LaunchDraft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAUNCH_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Quota exceeded (often large images) — retry without media
    try {
      localStorage.setItem(
        LAUNCH_DRAFT_KEY,
        JSON.stringify({ ...draft, imagePreview: null, bannerPreview: null })
      );
    } catch {
      /* ignore */
    }
  }
}

function clearLaunchDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LAUNCH_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

const fieldClass =
  "w-full px-4 py-3.5 rounded-2xl bg-black/55 border border-white/[0.06] text-sm text-white placeholder:text-rh-dim focus:outline-none focus:border-rh-lime/35 focus:bg-black/70 transition-[border-color,background-color,box-shadow] duration-200";

const panelClass =
  "rounded-[1.75rem] border border-white/[0.07] bg-[#111111] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_48px_-28px_rgba(0,0,0,0.85)]";

const SUPPLY_PRESETS = [
  { label: "1B (standard)", value: 1_000_000_000, decimals: 18 },
  { label: "100M", value: 100_000_000, decimals: 18 },
  { label: "10B", value: 10_000_000_000, decimals: 18 },
  { label: "1T", value: 1_000_000_000_000, decimals: 9 },
  { label: "1Q", value: 1_000_000_000_000_000, decimals: 6 },
] as const;

/** Default ERC-20 decimals for a given whole-token supply. */
function defaultDecimalsForSupply(supply: number): number {
  const preset = SUPPLY_PRESETS.find((p) => p.value === supply);
  if (preset) return preset.decimals;
  if (supply >= 1e15) return 6;
  if (supply >= 1e12) return 9;
  if (supply >= 1e10) return 12;
  return 18;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-rh-muted/90">
      {children}
    </p>
  );
}

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(panelClass, className)}>{children}</div>;
}

function ToggleRow({
  title,
  description,
  icon,
  checked,
  onChange,
  badge,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-2xl px-4 py-4 text-left transition-colors duration-200",
        checked ? "bg-rh-lime/[0.07]" : "hover:bg-white/[0.03]"
      )}
    >
      {icon && (
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            checked ? "bg-rh-lime/15 text-rh-lime" : "bg-white/[0.04] text-rh-muted"
          )}
        >
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-medium uppercase tracking-[0.08em] text-white">
            {title}
          </span>
          {badge && (
            <span className="rounded-md bg-rh-lime/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rh-lime">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-rh-muted">
          {description}
        </span>
      </span>
      <span
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-rh-lime" : "bg-white/15"
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200",
            checked && "translate-x-5"
          )}
        />
      </span>
    </button>
  );
}

function Collapsible({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border transition-colors duration-200",
        open ? "border-white/[0.1] bg-black/25" : "border-transparent bg-black/20"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-rh-muted">{icon}</span>
        <span className="flex-1 text-[12px] font-medium uppercase tracking-[0.12em] text-rh-muted">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-rh-dim transition-transform duration-200",
            open && "rotate-180 text-rh-muted"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-0">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function LaunchPage() {
  const router = useRouter();
  const wagmiConfig = useConfig();
  const { address, isConnected, status: accountStatus } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const { addToken, addTradeLocal, refreshTokens, upsertToken } = useAppStore();
  const walletReady = Boolean(address) || isConnected || accountStatus === "reconnecting";
  const ethUsd = useEthUsd();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  /** The IPFS address actually written on-chain — never the local blob: preview. */
  const [imageIpfsUrl, setImageIpfsUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [socials, setSocials] = useState<Record<LaunchSocialKey, string>>(EMPTY_SOCIALS);
  const [showSocials, setShowSocials] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  const [communityCoin, setCommunityCoin] = useState(false);
  const [communityBoard, setCommunityBoard] = useState(false);
  const [maxWallet2pct, setMaxWallet2pct] = useState(false);
  const [antiSnipe, setAntiSnipe] = useState(false);
  const [featureBoost, setFeatureBoost] = useState(false);
  const [customSupply, setCustomSupply] = useState(false);
  const [supply, setSupply] = useState(DEFAULT_SUPPLY);
  const [decimals, setDecimals] = useState(() => defaultDecimalsForSupply(DEFAULT_SUPPLY));
  const [initialBuyEth, setInitialBuyEth] = useState<string>(
    ""
  );
  const [ownershipPct, setOwnershipPct] = useState<number | null>(null);
  const [feeSharing, setFeeSharing] = useState(false);
  const [feeShares, setFeeShares] = useState<FeeShareRow[]>([
    { address: "", pct: "" },
  ]);
  const [showSupplyMenu, setShowSupplyMenu] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [copiedField, setCopiedField] = useState<"token" | "tx" | null>(null);
  const [launched, setLaunched] = useState<{
    address: string;
    bondingCurve?: string;
    txHash: string;
    name: string;
    symbol: string;
  } | null>(null);
  const pendingLaunch = useRef<{
    name: string;
    symbol: string;
    imageUri: string;
    description: string;
    creator: string;
    metadata: LaunchMetadata;
  } | null>(null);
  const registeredTx = useRef<Hash | null>(null);

  // Restore draft after refresh
  useEffect(() => {
    const draft = readLaunchDraft();
    if (draft) {
      setName(draft.name ?? "");
      setSymbol(draft.symbol ?? "");
      setDescription(draft.description ?? "");
      setImagePreview(draft.imagePreview ?? null);
      // A saved draft only ever holds a real upload URL — blob: previews die
      // with the tab, so anything else has to be re-uploaded.
      setImageIpfsUrl(
        draft.imagePreview && !draft.imagePreview.startsWith("blob:")
          ? draft.imagePreview
          : null
      );
      setBannerPreview(draft.bannerPreview ?? null);
      setSocials({ ...EMPTY_SOCIALS, ...(draft.socials ?? {}) });
      setShowSocials(Boolean(draft.showSocials));
      setShowBanner(Boolean(draft.showBanner));
      setCommunityCoin(Boolean(draft.communityCoin));
      setCommunityBoard(Boolean(draft.communityBoard));
      setMaxWallet2pct(Boolean(draft.maxWallet2pct));
      setAntiSnipe(Boolean(draft.antiSnipe));
      setCustomSupply(false);
      if (typeof draft.supply === "number" && draft.supply > 0) setSupply(draft.supply);
      if (typeof draft.decimals === "number") setDecimals(draft.decimals);
      setInitialBuyEth(
        draft.initialBuyEth && Number(draft.initialBuyEth) > 0
          ? draft.initialBuyEth
          : ""
      );
      setOwnershipPct(
        typeof draft.ownershipPct === "number" ? draft.ownershipPct : null
      );
      setFeeSharing(Boolean(draft.feeSharing));
      if (Array.isArray(draft.feeShares) && draft.feeShares.length > 0) {
        setFeeShares(draft.feeShares);
      }
      // Auto-expand sections that have content
      if (draft.bannerPreview) setShowBanner(true);
      const hasExtra = LAUNCH_EXTRA_SOCIAL_FIELDS.some(
        ({ key }) => draft.socials?.[key]?.trim()
      );
      if (hasExtra) setShowSocials(true);
    }
    setDraftReady(true);
  }, []);

  // Persist draft while editing
  useEffect(() => {
    if (!draftReady) return;
    const id = window.setTimeout(() => {
      writeLaunchDraft({
        name,
        symbol,
        description,
        imagePreview,
        bannerPreview,
        socials,
        showSocials,
        showBanner,
        communityCoin,
        communityBoard,
        maxWallet2pct,
        antiSnipe,
        customSupply,
        supply,
        decimals,
        initialBuyEth,
        ownershipPct,
        feeSharing,
        feeShares,
      });
    }, 250);
    return () => window.clearTimeout(id);
  }, [
    draftReady,
    name,
    symbol,
    description,
    imagePreview,
    bannerPreview,
    socials,
    showSocials,
    showBanner,
    communityCoin,
    communityBoard,
    maxWallet2pct,
    antiSnipe,
    customSupply,
    supply,
    decimals,
    initialBuyEth,
    ownershipPct,
    feeSharing,
    feeShares,
  ]);

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { sendTransactionAsync, isPending: boostPending } = useSendTransaction();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
    isError: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (writeError) {
      setStatus("error");
      setError(friendlyWalletError(writeError, "Transaction failed"));
    }
  }, [writeError]);

  useEffect(() => {
    if (receiptError) {
      setStatus("error");
      setError("Transaction failed or was rejected");
    }
  }, [receiptError]);

  useEffect(() => {
    if (!isSuccess || !receipt || !hash || !pendingLaunch.current) return;
    if (registeredTx.current === hash) return;
    registeredTx.current = hash;

    const pending = pendingLaunch.current;
    let tokenAddress: string | undefined;
    let bondingCurve: string | undefined;
    let uniswapPool: string | undefined;
    let lpEth = 0;
    let lpSupplyBps: number | undefined;
    let tokensInLp = 0;

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: PUMP_ROBIN_FACTORY_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "TokenCreated") {
          const args = decoded.args as {
            token: `0x${string}`;
            bondingCurve: `0x${string}`;
          };
          tokenAddress = args.token;
          bondingCurve = args.bondingCurve;
          break;
        }
      } catch {
        /* not our event */
      }
    }

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: BONDING_CURVE_ABI,
          data: log.data,
          topics: log.topics,
        });
        // A launch only graduates later, but a large first buy can cross the
        // threshold in the same transaction.
        if (decoded.eventName === "Graduated") {
          const args = decoded.args as unknown as {
            poolId: `0x${string}`;
            ethLiquidity: bigint;
            tokenLiquidity: bigint;
          };
          uniswapPool = args.poolId;
          lpEth = Number(formatEther(args.ethLiquidity));
          tokensInLp = Number(formatEther(args.tokenLiquidity));
          lpSupplyBps = Math.round((tokensInLp / DEFAULT_SUPPLY) * 10_000);
        }
      } catch {
        /* not curve event */
      }
    }

    void (async () => {
      try {
        const supply = pending.metadata?.supply ?? DEFAULT_SUPPLY;
        const deadSupply =
          tokensInLp > 0 ? Math.max(0, supply - tokensInLp) : undefined;
        const launchMeta = {
          ...pending.metadata,
          instantLaunch: true,
          ...(lpSupplyBps != null ? { lpSupplyBps } : {}),
          ...(deadSupply != null ? { deadSupply } : {}),
        };
        let launchTrade: {
          ethAmount: number;
          tokenAmount: number;
          price: number;
        } | null = null;
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: BONDING_CURVE_ABI,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName !== "Trade") continue;
            const args = decoded.args as unknown as {
              trader: `0x${string}`;
              isBuy: boolean;
              ethAmount: bigint;
              tokenAmount: bigint;
              newPrice: bigint;
            };
            if (!args.isBuy) continue;
            if (
              address &&
              args.trader.toLowerCase() !== address.toLowerCase()
            ) {
              continue;
            }
            launchTrade = {
              ethAmount: Number(formatEther(args.ethAmount)),
              tokenAmount: Number(formatEther(args.tokenAmount)),
              price: (() => {
                const eth = Number(formatEther(args.ethAmount));
                const tok = Number(formatEther(args.tokenAmount));
                // Prefer fill price — curve getPrice() stays at virtual open after seedAndGraduate
                if (eth > 0 && tok > 0) return eth / tok;
                return Number(formatEther(args.newPrice));
              })(),
            };
            break;
          } catch {
            /* not Trade */
          }
        }

        const res = await fetch("/api/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: pending.name,
            symbol: pending.symbol,
            imageUri: pending.imageUri,
            description: pending.description,
            creator: pending.creator,
            address: tokenAddress,
            bondingCurve,
            txHash: hash,
            source: "onchain",
            metadata: launchMeta,
            graduated: Boolean(uniswapPool),
            uniswapPool,
            realEthReserves: lpEth || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to index token");
        addToken({
          ...data.token,
          createdAt: new Date(data.token.createdAt),
        });
        await refreshTokens();

        const finalAddress = String(
          data.token?.address || tokenAddress || ""
        ).toLowerCase();
        const finalCurve = String(
          data.token?.bondingCurve || bondingCurve || ""
        ).toLowerCase();

        if (launchTrade && finalAddress && address) {
          try {
            const sync = await fetch("/api/trades/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tokenAddress: finalAddress,
                trader: address,
                isBuy: true,
                ethAmount: launchTrade.ethAmount,
                tokenAmount: launchTrade.tokenAmount,
                price: launchTrade.price,
                feeEth: 0,
                txHash: hash,
                // Don't fake bonding-curve virtuals after instant Uniswap seed
                graduated: Boolean(uniswapPool),
                uniswapPool,
              }),
            });
            const syncData = await sync.json();
            if (sync.ok && syncData.token) {
              upsertToken({
                ...syncData.token,
                createdAt: new Date(syncData.token.createdAt),
              });
              if (syncData.trade) {
                addTradeLocal(
                  {
                    ...syncData.trade,
                    timestamp: new Date(syncData.trade.timestamp),
                  },
                  {
                    ...syncData.token,
                    createdAt: new Date(syncData.token.createdAt),
                  }
                );
              }
              await refreshTokens();
            }
          } catch {
            /* index best-effort */
          }
        }

        // Best-effort on-chain refresh so pool + graduated flags stick
        if (finalAddress) {
          try {
            await fetch(`/api/tokens/${finalAddress}/refresh`, {
              method: "POST",
            });
            await refreshTokens();
            void fetch(`/api/tokens/${finalAddress}/verify`, {
              method: "POST",
              keepalive: true,
            });
          } catch {
            /* ignore */
          }
        }

        setLaunched({
          address: finalAddress,
          bondingCurve: finalCurve || undefined,
          txHash: hash,
          name: pending.name,
          symbol: pending.symbol,
        });
        setStatus("success");
        pendingLaunch.current = null;
        resetForm();
        clearLaunchDraft();

        if (finalAddress) {
          router.push(`/token/${finalAddress}`);
        }
      } catch (err) {
        // On-chain launch may still have succeeded — keep tx + decoded addresses if any
        if (tokenAddress) {
          setLaunched({
            address: tokenAddress.toLowerCase(),
            bondingCurve: bondingCurve?.toLowerCase(),
            txHash: hash,
            name: pending.name,
            symbol: pending.symbol,
          });
          setStatus("success");
          pendingLaunch.current = null;
        } else {
          setStatus("error");
        }
        setError(
          err instanceof Error
            ? friendlyWalletError(err, "Indexing failed — use the tx link below")
            : "Onchain launch succeeded but indexing failed — use the tx link below"
        );
      }
    })();
    // resetForm is stable enough for this effect; omit to avoid re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, receipt, hash, addToken, refreshTokens, router, address, upsertToken, addTradeLocal]);

  const effectiveSupply = customSupply
    ? Math.max(1, Math.min(1e15, supply || DEFAULT_SUPPLY))
    : DEFAULT_SUPPLY;

  const buyEthNum = Number(initialBuyEth) || 0;

  const preview = useMemo(() => {
    const ownershipCosts = OWNERSHIP_PRESETS.map((pct) => ({
      pct,
      eth: ethInForSupplyPercent(pct, effectiveSupply),
    }));
    return {
      buyEth: launchBuyEth(buyEthNum),
      /** Spot market cap the coin opens at, before any buy. */
      fdv: CHAIN_CONFIG.launchFdvEth,
      ownershipCosts,
    };
  }, [effectiveSupply, buyEthNum]);

  const buyEthForTx = launchBuyEth(buyEthNum);
  const minEthNeeded = minEthToLaunch(buyEthNum, featureBoost);
  const walletEth = ethBalance ? Number(formatEther(ethBalance.value)) : 0;
  const feeShareTotalPct = feeShares.reduce((sum, row) => sum + (Number(row.pct) || 0), 0);
  const receivedPct =
    buyEthNum > 0 || ownershipPct != null
      ? supplyPercentForEthIn(buyEthForTx, effectiveSupply)
      : 0;

  const applyOwnershipPct = (pct: number) => {
    const eth = ethInForSupplyPercent(pct, effectiveSupply);
    setOwnershipPct(pct);
    setInitialBuyEth(Number.isFinite(eth) ? eth.toFixed(6).replace(/\.?0+$/, "") : "");
  };

  const setBuyEthManual = (value: string) => {
    setInitialBuyEth(value);
    setOwnershipPct(null);
  };
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "image" | "banner"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Allow re-selecting the same file after a failed attempt
    e.target.value = "";

    setError("");

    // Instant local preview while upload runs (HEIC may not paint until IPFS JPEG returns)
    const localUrl = URL.createObjectURL(file);
    if (kind === "image") {
      setImagePreview(localUrl);
      // A blob: URL only resolves inside this tab. Clear the IPFS address until
      // the upload lands so a launch can never write one on-chain.
      setImageIpfsUrl(null);
      setImageUploading(true);
    } else setBannerPreview(localUrl);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error || "IPFS upload failed");
      }
      if (kind === "image") {
        setImagePreview(json.url);
        setImageIpfsUrl(json.url);
      } else setBannerPreview(json.url);
      URL.revokeObjectURL(localUrl);
    } catch (err) {
      if (kind === "image") {
        setImagePreview(null);
        setImageIpfsUrl(null);
      } else setBannerPreview(null);
      URL.revokeObjectURL(localUrl);
      setError(
        err instanceof Error
          ? err.message
          : "Could not upload image to IPFS — try again"
      );
    } finally {
      if (kind === "image") setImageUploading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setSymbol("");
    setDescription("");
    setImagePreview(null);
    setImageIpfsUrl(null);
    setBannerPreview(null);
    setSocials(EMPTY_SOCIALS);
    setShowSocials(false);
    setShowBanner(false);
    setCommunityCoin(false);
    setCommunityBoard(false);
    setMaxWallet2pct(false);
    setFeatureBoost(false);
    setCustomSupply(false);
    setSupply(DEFAULT_SUPPLY);
    setDecimals(defaultDecimalsForSupply(DEFAULT_SUPPLY));
    setInitialBuyEth("");
    setOwnershipPct(null);
    setFeeSharing(false);
    setFeeShares([{ address: "", pct: "" }]);
    clearLaunchDraft();
  };

  const handleLaunch = async () => {
    if (!name || !symbol || !address) return;
    setError("");
    setLaunched(null);

    if (imageUploading) {
      setError("Still uploading the logo to IPFS — give it a second.");
      return;
    }
    if (!imageIpfsUrl || imageIpfsUrl.startsWith("blob:")) {
      setError(
        "Upload a logo and wait for IPFS — wallets and DEX Screener need a public image URL."
      );
      return;
    }
    const imageUrl: string = imageIpfsUrl;

    const parsedShares = feeSharing
      ? feeShares
          .map((s) => ({
            address: s.address.trim(),
            pct: Number(s.pct) || 0,
          }))
          .filter((s) => s.address && s.pct > 0)
      : [];

    if (feeSharing && parsedShares.length === 0) {
      setError("Add at least one collection address and percent, or turn fee sharing off.");
      return;
    }
    if (feeSharing && parsedShares.some((s) => !isAddress(s.address))) {
      setError("Each fee-share recipient must be a valid 0x address.");
      return;
    }
    if (feeSharing && Math.abs(feeShareTotalPct - 100) > 0.01) {
      setError("Fee share percentages must add up to 100%.");
      return;
    }

    const feeShareBps = feeSharing
      ? (() => {
          const bps = parsedShares.map((s) => Math.round(s.pct * 100));
          const sum = bps.reduce((a, b) => a + b, 0);
          if (bps.length > 0 && sum !== 10_000) {
            bps[bps.length - 1] += 10_000 - sum;
          }
          return bps;
        })()
      : [];
    if (feeSharing && feeShareBps.some((b) => b <= 0)) {
      setError("Each recipient percent must be greater than 0.");
      return;
    }

    const metadata: LaunchMetadata = {
      ...pickSocialMetadata(socials),
      bannerUri: bannerPreview || undefined,
      communityCoin,
      communityBoard,
      instantLaunch: true,
      antiSnipe,
      maxWallet2pct,
      customSupply,
      supply: effectiveSupply,
      decimals,
      initialBuyEth: buyEthNum > 0 ? buyEthNum : undefined,
      ownershipPct: ownershipPct ?? undefined,
      feeSharing,
      feeShares: feeSharing ? parsedShares : undefined,
    };

    if (!CONTRACTS.factory) {
      setError("Factory is not configured — launches must go through PumpRobinFactory.createToken.");
      return;
    }
    const factory = CONTRACTS.factory;

    const fee = parseEther(CHAIN_CONFIG.creationFee);
    // Anything above the creation fee is spent on the curve as the creator's
    // first buy. Zero is fine — a launch needs no liquidity behind it.
    const seedWei = parseEther(String(launchBuyEth(buyEthNum)));

    setStatus("pending");
    try {
      // Pay Explore feature boost to collector first (separate from create+buy value)
      if (featureBoost) {
        const boostWei = parseEther(CHAIN_CONFIG.featureBoostEth);
        const boostHash = await sendTransactionAsync({
          to: FEE_COLLECTOR,
          value: boostWei,
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: boostHash });
        const until = new Date();
        until.setDate(until.getDate() + CHAIN_CONFIG.featureBoostDays);
        metadata.featured = true;
        metadata.featuredUntil = until.toISOString();
        metadata.featuredPaidEth = Number(CHAIN_CONFIG.featureBoostEth);
        metadata.featuredTxHash = boostHash;
      }

      pendingLaunch.current = {
        name,
        symbol,
        imageUri: imageUrl,
        description,
        creator: address,
        metadata,
      };
      registeredTx.current = null;

      let metadataURI: string = imageUrl;
      try {
        const metaRes = await fetch("/api/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Wallets, DEX Screener and GMGN read the pump.fun-style shape:
          // a flat `image` plus `createdOn` for launchpad attribution.
          body: JSON.stringify({
            name,
            symbol,
            description,
            image: imageUrl,
            createdOn: "https://pumprobin.fun",
            website: socials.website || "https://pumprobin.fun",
            twitter: socials.twitter || null,
            telegram: socials.telegram || null,
            ...pickSocialMetadata(socials),
          }),
        });
        const metaJson = (await metaRes.json()) as { url?: string };
        if (metaRes.ok && metaJson.url) metadataURI = metaJson.url;
      } catch {
        /* image URL still works as metadataURI fallback */
      }

      writeContract({
        address: factory,
        abi: PUMP_ROBIN_FACTORY_ABI,
        functionName: "createToken",
        args: [
          name,
          symbol,
          imageUrl,
          description,
          metadataURI,
          antiSnipe,
          maxWallet2pct,
          feeSharing
            ? parsedShares.map((s) => s.address as `0x${string}`)
            : [],
          feeShareBps,
        ],
        value: fee + seedWei,
      });
    } catch (err) {
      setStatus("error");
      setError(friendlyWalletError(err, "Feature payment or launch failed"));
    }
  };

  const ticker = symbol || "TICK";
  const displayName = name || "Your coin";
  const launching =
    isPending || isConfirming || boostPending || status === "pending";
  const canLaunch = Boolean(name.trim() && symbol.trim());

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(204,255,0,0.07),transparent_55%),radial-gradient(ellipse_at_80%_20%,rgba(255,255,255,0.04),transparent_40%)]"
      />

      <div className="rh-container relative py-10 sm:py-14">
        <header className="mx-auto mb-8 max-w-5xl sm:mb-10">
          <h1 className="rh-display text-[2.15rem] text-white sm:text-[2.75rem]">
            Launch your coin
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-rh-muted">
            One wallet confirm, {formatEthWithUsd(Number(CHAIN_CONFIG.creationFee), ethUsd)}{" "}
            creation fee, no liquidity to seed. Your coin trades on a curve from
            block one and graduates to Uniswap v4 at{" "}
            {CHAIN_CONFIG.graduationThreshold} ETH raised, with liquidity locked
            forever.
          </p>
        </header>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 xl:gap-12">
          <div className="min-w-0 space-y-4">
            {/* Coin details */}
            <Panel className="p-4 sm:p-5">
              <SectionLabel>Coin details</SectionLabel>
              <div className="mt-4 flex gap-3 sm:gap-4">
                <label className="relative flex h-[112px] w-[112px] shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[1.25rem] border border-dashed border-white/15 bg-black/40 transition-colors hover:border-rh-lime/40 sm:h-[120px] sm:w-[120px]">
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt="Coin"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-rh-muted">
                      <Plus className="h-5 w-5" />
                      <span className="text-xs">Upload</span>
                      <span className="px-1 text-center text-[10px] leading-tight text-rh-dim">
                        JPG · PNG · GIF · WebP · HEIC
                      </span>
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/gif,image/jpeg,image/png,image/webp,image/heic,image/heif,.gif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, "image")}
                  />
                </label>

                <div className="grid min-w-0 flex-1 grid-cols-1 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs text-rh-muted">Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Name your coin"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-rh-muted">Ticker</label>
                    <input
                      value={symbol}
                      onChange={(e) =>
                        setSymbol(e.target.value.toUpperCase().slice(0, 10))
                      }
                      placeholder="e.g. HOOD"
                      maxLength={10}
                      className={cn(fieldClass, "uppercase")}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs text-rh-muted">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Write a short description"
                  className={cn(fieldClass, "resize-none")}
                />
              </div>
            </Panel>

            {/* Socials */}
            <Panel className="space-y-3 p-4 sm:p-5">
              <SectionLabel>Social links</SectionLabel>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {LAUNCH_PRIMARY_SOCIAL_FIELDS.map(({ key, label }) => (
                  <input
                    key={key}
                    value={socials[key]}
                    onChange={(e) =>
                      setSocials((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={label}
                    aria-label={label}
                    className={fieldClass}
                    inputMode="url"
                    autoComplete="url"
                  />
                ))}
              </div>

              <Collapsible
                title="More links (optional)"
                icon={<Globe className="h-4 w-4" />}
                open={showSocials}
                onToggle={() => setShowSocials((v) => !v)}
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {LAUNCH_EXTRA_SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
                    <label key={key} className="block">
                      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-rh-dim">
                        {label}
                      </span>
                      <input
                        value={socials[key]}
                        onChange={(e) =>
                          setSocials((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder={placeholder}
                        className={fieldClass}
                        inputMode="url"
                        autoComplete="url"
                      />
                    </label>
                  ))}
                </div>
              </Collapsible>

              <Collapsible
                title="Banner (optional)"
                icon={<ImageIcon className="h-4 w-4" />}
                open={showBanner}
                onToggle={() => setShowBanner((v) => !v)}
              >
                <label className="relative flex h-28 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-black/40 transition-colors hover:border-rh-lime/40">
                  {bannerPreview ? (
                    <Image
                      src={bannerPreview}
                      alt="Banner"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-rh-muted">
                      <Plus className="h-4 w-4" /> Upload banner
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/gif,image/jpeg,image/png,image/webp,image/heic,image/heif,.gif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, "banner")}
                  />
                </label>
              </Collapsible>
            </Panel>

            {/* Launch options */}
            <Panel className="overflow-hidden divide-y divide-white/[0.05]">
              <ToggleRow
                title="Anti-snipe · first 15 min"
                description="Buys pay a 99% fee to PumpRobin for 15 minutes after launch. Optional."
                icon={<Shield className="h-4 w-4" />}
                checked={antiSnipe}
                onChange={setAntiSnipe}
              />
              <ToggleRow
                title="2% max per wallet"
                description="On-chain cap: no wallet can hold more than 2% of supply (pool exempt)."
                icon={<Wallet className="h-4 w-4" />}
                checked={maxWallet2pct}
                onChange={setMaxWallet2pct}
              />
              <ToggleRow
                title={`Feature on Explore · ${formatEthWithUsd(Number(CHAIN_CONFIG.featureBoostEth), ethUsd)}`}
                description={`Pin in Featured for ${CHAIN_CONFIG.featureBoostDays} days. Paid to platform.`}
                icon={<Sparkles className="h-4 w-4" />}
                checked={featureBoost}
                onChange={setFeatureBoost}
              />
              <ToggleRow
                title="Add a community"
                description="Holder comment board · needs a banner"
                icon={<MessageCircle className="h-4 w-4" />}
                checked={communityBoard}
                onChange={(v) => {
                  setCommunityBoard(v);
                  if (v && !showBanner) setShowBanner(true);
                }}
              />
            </Panel>

            <Panel className="p-4 sm:p-5">
              <p className="text-[13px] leading-relaxed text-rh-muted">
                Every buy and sell (GMGN, MetaMask, Axiom, this site) pays{" "}
                <span className="text-white">1% creator + 1% platform</span>. Creator
                fees accrue for you to claim anytime. Platform fees auto-send after ~
                ${CHAIN_CONFIG.feeClaimThresholdUsdHint}.
              </p>
            </Panel>

            <Panel className="overflow-hidden">
              <ToggleRow
                title="Creator fee collection"
                description={`Send the 1% creator fee to one or more wallets. Percents must add to 100.`}
                icon={<Percent className="h-4 w-4" />}
                checked={feeSharing}
                onChange={(v) => {
                  setFeeSharing(v);
                  if (v && feeShares.length === 0) {
                    setFeeShares([{ address: address || "", pct: "100" }]);
                  }
                }}
              />
              {feeSharing && (
                <div className="space-y-2 border-t border-white/[0.05] bg-black/20 px-4 py-4">
                  {feeShares.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={row.address}
                        onChange={(e) => {
                          const next = [...feeShares];
                          next[i] = { ...next[i], address: e.target.value };
                          setFeeShares(next);
                        }}
                        placeholder="0x… collection address"
                        className={cn(fieldClass, "flex-1 font-mono text-xs")}
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        value={row.pct}
                        onChange={(e) => {
                          const next = [...feeShares];
                          next[i] = { ...next[i], pct: e.target.value };
                          setFeeShares(next);
                        }}
                        placeholder="%"
                        className={cn(fieldClass, "w-20 text-center")}
                      />
                      <button
                        type="button"
                        aria-label="Remove recipient"
                        disabled={feeShares.length <= 1}
                        onClick={() =>
                          setFeeShares((rows) => rows.filter((_, j) => j !== i))
                        }
                        className="p-2 text-rh-muted hover:text-white disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      disabled={feeShares.length >= CHAIN_CONFIG.maxFeeShareRecipients}
                      onClick={() =>
                        setFeeShares((rows) => [...rows, { address: "", pct: "" }])
                      }
                      className="text-xs text-rh-lime hover:underline disabled:opacity-40 disabled:no-underline"
                    >
                      + Add recipient
                    </button>
                    <p
                      className={cn(
                        "text-xs tabular-nums",
                        Math.abs(feeShareTotalPct - 100) < 0.01
                          ? "text-rh-lime"
                          : "text-rh-muted"
                      )}
                    >
                      {feeShareTotalPct.toFixed(0)}% / 100%
                    </p>
                  </div>
                </div>
              )}
            </Panel>

            {/* Ownership */}
            <Panel className="relative overflow-hidden p-4 sm:p-5">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-rh-lime/10 blur-3xl"
              />
              <SectionLabel>Your first buy</SectionLabel>
              <p className="mt-1 text-[13px] text-rh-muted">
                No liquidity to seed — your coin opens at{" "}
                <span className="text-white">
                  {CHAIN_CONFIG.launchFdvEth} ETH market cap
                </span>{" "}
                and trades on the curve straight away. Leave this at 0 to launch
                with nothing, or add ETH to buy your own bag in the same
                transaction, before anyone else can trade.
              </p>

              <div className="relative mt-4">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={initialBuyEth}
                  onChange={(e) => setBuyEthManual(e.target.value)}
                  placeholder="0"
                  className={cn(
                    fieldClass,
                    "pr-16 text-2xl font-medium tracking-tight placeholder:text-rh-dim/80"
                  )}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-rh-muted">
                  ETH
                </span>
              </div>
              {buyEthNum > 0 && (
                <p className="mt-1.5 text-xs tabular-nums text-rh-muted">
                  ≈ {formatUsd(buyEthNum * ethUsd)}
                </p>
              )}
              {receivedPct > 0 && (
                <p className="mt-1.5 text-xs tabular-nums text-rh-muted">
                  You receive ≈ {receivedPct.toFixed(2)}% of supply
                  {receivedPct > 30
                    ? " — a bag this large will read as a dev dump"
                    : ""}
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                <p className="flex items-center gap-1.5 text-rh-muted">
                  <Wallet className="h-3.5 w-3.5 text-rh-lime" />
                  <span className="tabular-nums">
                    Wallet{" "}
                    {walletReady || address ? (
                      <EthWithUsd eth={walletEth} ethUsd={ethUsd} layout="inline" />
                    ) : (
                      "— connect to see"
                    )}
                  </span>
                </p>
                {receivedPct > 0 ? (
                  <p className="tabular-nums text-rh-lime">
                    You get ≈{" "}
                    {receivedPct < 0.01
                      ? receivedPct.toFixed(4)
                      : receivedPct.toFixed(2)}
                    % of supply in your wallet
                  </p>
                ) : (
                  <p className="text-amber-200/90">
                    Dev wallet gets 0 tokens at this amount
                  </p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {preview.ownershipCosts.map(({ pct, eth }) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyOwnershipPct(pct)}
                    className={cn(
                      "rounded-2xl border px-2 py-3.5 text-center transition-all duration-200",
                      ownershipPct === pct
                        ? "border-rh-lime/50 bg-rh-lime/10 text-rh-lime shadow-[0_0_24px_-8px_rgba(204,255,0,0.45)]"
                        : "border-white/[0.06] bg-black/40 text-white hover:border-white/15 hover:bg-black/55"
                    )}
                  >
                    <span className="block text-sm font-semibold">{pct}%</span>
                    <span className="mt-0.5 block text-[11px] tabular-nums text-rh-muted">
                      {Number.isFinite(eth) ? (
                        <EthWithUsd
                          eth={eth}
                          ethUsd={ethUsd}
                          layout="stacked"
                          decimals={eth < 1 ? 4 : 2}
                        />
                      ) : (
                        "—"
                      )}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-rh-dim">
                Every coin opens at {CHAIN_CONFIG.launchFdvEth} ETH market cap and
                graduates to Uniswap once the curve raises{" "}
                {CHAIN_CONFIG.graduationThreshold} ETH.
                {buyEthForTx > 0 ? (
                  <>
                    {" "}
                    Your {buyEthForTx.toFixed(4)} ETH buys ≈{" "}
                    {receivedPct.toFixed(2)}% of supply on the curve.
                  </>
                ) : null}{" "}
                Plus {formatEthWithUsd(Number(CHAIN_CONFIG.creationFee), ethUsd)} creation fee.
              </p>

              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-500/15 to-amber-500/5 px-4 py-3.5 text-sm leading-snug text-amber-100/95">
                You need at least{" "}
                <span className="font-semibold tabular-nums text-amber-50">
                  <EthWithUsd eth={minEthNeeded} ethUsd={ethUsd} layout="inline" />
                </span>
                <span className="mt-1 block text-[11px] text-amber-100/70">
                  {formatEthWithUsd(Number(CHAIN_CONFIG.creationFee), ethUsd)} creation
                  {buyEthForTx > 0
                    ? ` + ${formatEthWithUsd(buyEthForTx, ethUsd)} first buy`
                    : ""}
                  {receivedPct > 0
                    ? ` (≈${receivedPct.toFixed(1)}% ownership)`
                    : ""}
                  {featureBoost
                    ? ` + ${formatEthWithUsd(Number(CHAIN_CONFIG.featureBoostEth), ethUsd)} feature`
                    : ""}{" "}
                  + ~{formatEthWithUsd(Number(CHAIN_CONFIG.launchGasBufferEth), ethUsd)} network gas on Robinhood
                  {featureBoost
                    ? " · feature is a separate wallet confirm before create"
                    : ""}
                </span>
              </div>
            </Panel>

            {/* CTA */}
            <div className="space-y-3 pt-1">
              {(status === "success" || launched) && launched && (
                <div className="space-y-3 rounded-2xl border border-rh-lime/30 bg-rh-lime/10 px-4 py-4">
                  <p className="text-center text-sm font-medium text-rh-lime">
                    {launched.name} (${launched.symbol}) is live
                  </p>

                  <div className="space-y-2 text-left">
                    <div className="rounded-xl bg-black/40 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-rh-dim">
                        Token address (CA)
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-white">
                          {launched.address}
                        </code>
                        <button
                          type="button"
                          aria-label="Copy token address"
                          className="shrink-0 rounded-lg p-1.5 text-rh-muted transition-colors hover:bg-white/10 hover:text-white"
                          onClick={async () => {
                            await navigator.clipboard.writeText(launched.address);
                            setCopiedField("token");
                            window.setTimeout(() => setCopiedField(null), 1500);
                          }}
                        >
                          {copiedField === "token" ? (
                            <Check className="h-3.5 w-3.5 text-rh-lime" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {launched.bondingCurve && (
                      <div className="rounded-xl bg-black/40 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-rh-dim">
                          Bonding curve
                        </p>
                        <code className="mt-1 block break-all font-mono text-[12px] text-white/80">
                          {launched.bondingCurve}
                        </code>
                      </div>
                    )}

                    <div className="rounded-xl bg-black/40 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-rh-dim">
                        Transaction
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-white/80">
                          {shortenAddress(launched.txHash, 6)}
                        </code>
                        <button
                          type="button"
                          aria-label="Copy transaction hash"
                          className="shrink-0 rounded-lg p-1.5 text-rh-muted transition-colors hover:bg-white/10 hover:text-white"
                          onClick={async () => {
                            await navigator.clipboard.writeText(launched.txHash);
                            setCopiedField("tx");
                            window.setTimeout(() => setCopiedField(null), 1500);
                          }}
                        >
                          {copiedField === "tx" ? (
                            <Check className="h-3.5 w-3.5 text-rh-lime" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <RhButton
                      href={`/token/${launched.address}`}
                      size="lg"
                      className="w-full !rounded-2xl !py-4 text-[15px] font-semibold"
                    >
                      Open token page
                    </RhButton>
                    <a
                      href={explorerAddressUrl(launched.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-[13px] font-medium text-white transition-colors hover:border-rh-lime/40 hover:text-rh-lime"
                    >
                      Explorer
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <a
                      href={explorerTxUrl(launched.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-[13px] font-medium text-white transition-colors hover:border-rh-lime/40 hover:text-rh-lime"
                    >
                      Tx
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <button
                    type="button"
                    className="w-full text-center text-[12px] text-rh-muted underline-offset-2 hover:text-white hover:underline"
                    onClick={() => {
                      setLaunched(null);
                      setStatus("idle");
                      setError("");
                    }}
                  >
                    Launch another coin
                  </button>
                </div>
              )}

              {error && !(launched && status === "success") && (
                <p className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
                  {error}
                </p>
              )}
              {error && launched && (
                <p className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100/90">
                  {error}
                </p>
              )}

              {!launched && (
                <ConnectButton.Custom>
                  {({ account, chain, openConnectModal, openChainModal, mounted }) => {
                    const rkConnected = Boolean(mounted && account && chain);
                    const ready = rkConnected || walletReady || Boolean(address);

                    if (!mounted) {
                      return (
                        <RhButton
                          size="lg"
                          className="w-full !rounded-2xl !py-5 text-[17px] font-semibold"
                          disabled
                        >
                          Loading wallet…
                        </RhButton>
                      );
                    }

                    if (chain?.unsupported) {
                      return (
                        <RhButton
                          size="lg"
                          className="w-full !rounded-2xl !py-5 text-[17px] font-semibold"
                          onClick={openChainModal}
                        >
                          Switch to Robinhood Chain
                        </RhButton>
                      );
                    }

                    if (!ready) {
                      return (
                        <RhButton
                          size="lg"
                          className="w-full !rounded-2xl !py-5 text-[17px] font-semibold shadow-[0_0_40px_-10px_rgba(204,255,0,0.55)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
                          onClick={openConnectModal}
                        >
                          Connect wallet to launch
                        </RhButton>
                      );
                    }

                    return (
                      <RhButton
                        size="lg"
                        className="w-full !rounded-2xl !py-5 text-[17px] font-semibold shadow-[0_0_40px_-10px_rgba(204,255,0,0.55)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
                        onClick={handleLaunch}
                        disabled={!canLaunch || launching}
                      >
                        {launching
                          ? "Confirm create + buy…"
                          : canLaunch
                            ? `Launch + buy · ${formatEthWithUsd(minEthNeeded, ethUsd)}`
                            : "Add name & ticker to launch"}
                      </RhButton>
                    );
                  }}
                </ConnectButton.Custom>
              )}

              {!launched && (
                <p className="text-center text-[11px] leading-relaxed text-rh-dim">
                  One wallet confirm · creation fee + ownership buy land on-chain together
                </p>
              )}
            </div>
          </div>

          {/* Preview */}
          <aside className="h-fit lg:sticky lg:top-24">
            <Panel className="relative overflow-hidden p-5">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-rh-lime/[0.08] to-transparent"
              />
              <SectionLabel>Preview</SectionLabel>

              <div className="relative mt-4 flex items-center gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-black/50 ring-1 ring-white/10">
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold tracking-wide text-rh-dim">
                      {ticker.slice(0, 4)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-white">
                    {displayName}
                  </p>
                  <p className="text-sm text-rh-muted">${ticker}</p>
                </div>
              </div>

              {bannerPreview && (
                <div className="relative mt-4 h-28 w-full overflow-hidden rounded-2xl ring-1 ring-white/10">
                  <Image
                    src={bannerPreview}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              )}

              <dl className="mt-5 space-y-3 border-t border-white/[0.06] pt-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-rh-muted">Supply</dt>
                  <dd className="tabular-nums text-white">
                    {formatSupplyShort(effectiveSupply)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-rh-muted">Est. start FDV</dt>
                  <dd className="text-right tabular-nums text-white">
                    <EthWithUsd eth={preview.fdv} ethUsd={ethUsd} layout="stacked" />
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-rh-muted">Sold on curve</dt>
                  <dd className="text-right tabular-nums text-rh-lime">
                    {formatSupplyShort(CHAIN_CONFIG.curveSupply)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-rh-muted">Graduates at</dt>
                  <dd className="text-right tabular-nums text-white">
                    <EthWithUsd
                      eth={CHAIN_CONFIG.graduationThreshold}
                      ethUsd={ethUsd}
                      layout="stacked"
                    />
                  </dd>
                </div>
                {buyEthNum > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-rh-muted">First buy</dt>
                    <dd className="text-right tabular-nums text-white">
                      <EthWithUsd eth={buyEthNum} ethUsd={ethUsd} layout="stacked" />
                      {ownershipPct != null ? (
                        <span className="block text-[11px] text-rh-muted">
                          {ownershipPct}% of supply
                        </span>
                      ) : null}
                    </dd>
                  </div>
                )}
              </dl>

              {(communityCoin ||
                communityBoard ||
                maxWallet2pct ||
                feeSharing) && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {communityCoin && <Chip>Community fees</Chip>}
                  {communityBoard && <Chip>Board</Chip>}
                  {maxWallet2pct && <Chip>2% max</Chip>}
                  {feeSharing && <Chip>Fee share</Chip>}
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/35 px-3.5 py-3 text-[12px] leading-relaxed text-rh-muted">
                Ready when you are — connect, name it, launch for{" "}
                <span className="text-rh-lime">
                  {formatEthWithUsd(Number(CHAIN_CONFIG.creationFee), ethUsd)}
                </span>
                .
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-wide text-rh-muted ring-1 ring-white/[0.04]">
      {children}
    </span>
  );
}
