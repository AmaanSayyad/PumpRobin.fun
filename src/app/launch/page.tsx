"use client";

import { useMemo, useState, useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import {
  useAccount,
  useBalance,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { decodeEventLog, formatEther, parseEther, type Hash } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  ChevronDown,
  Globe,
  ImageIcon,
  Layers,
  MessageCircle,
  Percent,
  Plus,
  Shield,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { RhButton } from "@/components/ui/rh-button";
import { CHAIN_CONFIG, OWNERSHIP_PRESETS } from "@/lib/chain";
import { CONTRACTS, PUMP_ROBIN_FACTORY_ABI } from "@/lib/contracts";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  LAUNCH_EXTRA_SOCIAL_FIELDS,
  LAUNCH_PRIMARY_SOCIAL_FIELDS,
  LAUNCH_SOCIAL_FIELDS,
  pickSocialMetadata,
  type LaunchMetadata,
  type LaunchSocialKey,
} from "@/lib/data";
import {
  DEFAULT_SUPPLY,
  INITIAL_VIRTUAL_ETH,
  ethInForSupplyPercent,
  formatSupplyShort,
  graduationMarketCapEth,
  initialTokenPriceEth,
  marketCapEth,
  minEthToLaunch,
  supplyPercentForEthIn,
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
  antiSnipe: boolean;
  maxWallet2pct: boolean;
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

function formatTinyEth(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1e-12) return `${n.toExponential(2)} ETH`;
  if (n < 1) {
    const fixed = n.toFixed(12).replace(/\.?0+$/, "");
    return `${fixed} ETH`;
  }
  return `${n.toFixed(4)} ETH`;
}

function formatMcap(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M ETH`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K ETH`;
  if (n >= 1) return `${n.toFixed(2)} ETH`;
  return `${n.toFixed(4)} ETH`;
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
  const { isConnected, address } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const { addToken, refreshTokens } = useAppStore();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [socials, setSocials] = useState<Record<LaunchSocialKey, string>>(EMPTY_SOCIALS);
  const [showSocials, setShowSocials] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  const [communityCoin, setCommunityCoin] = useState(false);
  const [communityBoard, setCommunityBoard] = useState(false);
  const [antiSnipe, setAntiSnipe] = useState(false);
  const [maxWallet2pct, setMaxWallet2pct] = useState(false);
  const [customSupply, setCustomSupply] = useState(false);
  const [supply, setSupply] = useState(DEFAULT_SUPPLY);
  const [decimals, setDecimals] = useState(() => defaultDecimalsForSupply(DEFAULT_SUPPLY));
  const [initialBuyEth, setInitialBuyEth] = useState("");
  const [ownershipPct, setOwnershipPct] = useState<number | null>(null);
  const [feeSharing, setFeeSharing] = useState(false);
  const [feeShares, setFeeShares] = useState<FeeShareRow[]>([
    { address: "", pct: "" },
  ]);
  const [showSupplyMenu, setShowSupplyMenu] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState("");
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
      setBannerPreview(draft.bannerPreview ?? null);
      setSocials({ ...EMPTY_SOCIALS, ...(draft.socials ?? {}) });
      setShowSocials(Boolean(draft.showSocials));
      setShowBanner(Boolean(draft.showBanner));
      setCommunityCoin(Boolean(draft.communityCoin));
      setCommunityBoard(Boolean(draft.communityBoard));
      setAntiSnipe(Boolean(draft.antiSnipe));
      setMaxWallet2pct(Boolean(draft.maxWallet2pct));
      setCustomSupply(Boolean(draft.customSupply));
      if (typeof draft.supply === "number" && draft.supply > 0) setSupply(draft.supply);
      if (typeof draft.decimals === "number") setDecimals(draft.decimals);
      setInitialBuyEth(draft.initialBuyEth ?? "");
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
        antiSnipe,
        maxWallet2pct,
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
    antiSnipe,
    maxWallet2pct,
    customSupply,
    supply,
    decimals,
    initialBuyEth,
    ownershipPct,
    feeSharing,
    feeShares,
  ]);

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
    isError: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (writeError) {
      setStatus("error");
      setError(writeError.message.slice(0, 180));
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

    void (async () => {
      try {
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
            metadata: pending.metadata,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to index token");
        addToken({
          ...data.token,
          createdAt: new Date(data.token.createdAt),
        });
        await refreshTokens();
        setStatus("success");
        pendingLaunch.current = null;
        resetForm();
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof Error
            ? err.message
            : "Onchain launch succeeded but indexing failed — check Explore later"
        );
      }
    })();
    // resetForm is stable enough for this effect; omit to avoid re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, receipt, hash, addToken, refreshTokens]);

  const effectiveSupply = customSupply
    ? Math.max(1, Math.min(1e15, supply || DEFAULT_SUPPLY))
    : DEFAULT_SUPPLY;

  const preview = useMemo(() => {
    const startPrice = initialTokenPriceEth(effectiveSupply);
    const startMcap = marketCapEth(startPrice, effectiveSupply);
    const gradsAt = graduationMarketCapEth(effectiveSupply, CHAIN_CONFIG.graduationThreshold);
    const ownershipCosts = OWNERSHIP_PRESETS.map((pct) => ({
      pct,
      eth: ethInForSupplyPercent(pct, effectiveSupply),
    }));
    return { startPrice, startMcap, gradsAt, ownershipCosts };
  }, [effectiveSupply]);

  const buyEthNum = Number(initialBuyEth) || 0;
  const minEthNeeded = minEthToLaunch(buyEthNum);
  const walletEth = ethBalance ? Number(formatEther(ethBalance.value)) : 0;
  const feeShareTotalPct = feeShares.reduce((sum, row) => sum + (Number(row.pct) || 0), 0);
  const receivedPct =
    buyEthNum > 0 ? supplyPercentForEthIn(buyEthNum, effectiveSupply) : 0;

  const applyOwnershipPct = (pct: number) => {
    const eth = ethInForSupplyPercent(pct, effectiveSupply);
    setOwnershipPct(pct);
    setInitialBuyEth(Number.isFinite(eth) ? eth.toFixed(6).replace(/\.?0+$/, "") : "");
  };

  const setBuyEthManual = (value: string) => {
    setInitialBuyEth(value);
    setOwnershipPct(null);
  };
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "image" | "banner"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      if (kind === "image") setImagePreview(data);
      else setBannerPreview(data);
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setName("");
    setSymbol("");
    setDescription("");
    setImagePreview(null);
    setBannerPreview(null);
    setSocials(EMPTY_SOCIALS);
    setShowSocials(false);
    setShowBanner(false);
    setCommunityCoin(false);
    setCommunityBoard(false);
    setAntiSnipe(false);
    setMaxWallet2pct(false);
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

    const parsedShares = feeSharing
      ? feeShares
          .map((s) => ({
            address: s.address.trim(),
            pct: Number(s.pct) || 0,
          }))
          .filter((s) => s.address && s.pct > 0)
      : [];

    if (feeSharing && parsedShares.length === 0) {
      setError("Add at least one fee-share recipient, or turn fee sharing off.");
      return;
    }
    if (feeSharing && Math.abs(feeShareTotalPct - 100) > 0.01) {
      setError("Fee share percentages must add up to 100%.");
      return;
    }

    const metadata: LaunchMetadata = {
      ...pickSocialMetadata(socials),
      bannerUri: bannerPreview || undefined,
      communityCoin,
      communityBoard,
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

    if (CONTRACTS.factory) {
      const fee = parseEther(CHAIN_CONFIG.creationFee);
      pendingLaunch.current = {
        name,
        symbol,
        imageUri: imagePreview || "",
        description,
        creator: address,
        metadata,
      };
      registeredTx.current = null;
      writeContract({
        address: CONTRACTS.factory,
        abi: PUMP_ROBIN_FACTORY_ABI,
        functionName: "createToken",
        args: [name, symbol, imagePreview || "", description],
        value: fee,
      });
      setStatus("pending");
      return;
    }

    setStatus("pending");
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          symbol,
          imageUri: imagePreview || "",
          description,
          creator: address,
          metadata,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Launch failed");
      addToken({
        ...data.token,
        createdAt: new Date(data.token.createdAt),
      });
      await refreshTokens();
      setStatus("success");
      resetForm();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Launch failed");
    }
  };

  const ticker = symbol || "TICK";
  const displayName = name || "Your coin";
  const launching = isPending || isConfirming || status === "pending";
  const canLaunch = Boolean(name.trim() && symbol.trim());

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(204,255,0,0.07),transparent_55%),radial-gradient(ellipse_at_80%_20%,rgba(255,255,255,0.04),transparent_40%)]"
      />

      <div className="rh-container relative py-10 sm:py-14">
        <header className="mx-auto mb-8 max-w-5xl sm:mb-10">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-rh-lime">
            Launch
          </p>
          <h1 className="rh-display mt-2 text-[2.15rem] text-white sm:text-[2.75rem]">
            Launch your coin
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-rh-muted">
            Name it, set ownership, and go live on Robinhood Chain in one click —{" "}
            {CHAIN_CONFIG.creationFee} ETH creation fee.
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
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
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
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, "banner")}
                  />
                </label>
              </Collapsible>
            </Panel>

            {/* Launch options */}
            <Panel className="overflow-hidden divide-y divide-white/[0.05]">
              <ToggleRow
                title="Community coin"
                description="Fees stream to holders"
                icon={<Users className="h-4 w-4" />}
                checked={communityCoin}
                onChange={setCommunityCoin}
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
              <ToggleRow
                title="Anti-snipe"
                description="Blocks bots for 2 min"
                icon={<Shield className="h-4 w-4" />}
                checked={antiSnipe}
                onChange={setAntiSnipe}
              />
              <ToggleRow
                title="2% max per wallet"
                description="Caps each wallet at 2%"
                icon={<Wallet className="h-4 w-4" />}
                checked={maxWallet2pct}
                onChange={setMaxWallet2pct}
              />
              <ToggleRow
                title="Custom supply"
                description={
                  customSupply
                    ? `${formatSupplyShort(effectiveSupply)} total supply`
                    : "Standard is 1 billion. Turn on to set any amount, 1 to 1Q."
                }
                icon={<Layers className="h-4 w-4" />}
                checked={customSupply}
                onChange={(v) => {
                  setCustomSupply(v);
                  if (!v) {
                    setSupply(DEFAULT_SUPPLY);
                    setDecimals(defaultDecimalsForSupply(DEFAULT_SUPPLY));
                    setShowSupplyMenu(false);
                  }
                }}
              />
              {customSupply && (
                <div className="space-y-3 bg-black/20 px-4 py-4">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSupplyMenu((v) => !v)}
                      className={cn(fieldClass, "flex items-center justify-between")}
                    >
                      <span>
                        {SUPPLY_PRESETS.find((p) => p.value === supply)?.label ??
                          `${formatSupplyShort(supply)} custom`}
                      </span>
                      <ChevronDown className="h-4 w-4 text-rh-muted" />
                    </button>
                    {showSupplyMenu && (
                      <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#161616] shadow-2xl">
                        {SUPPLY_PRESETS.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => {
                              setSupply(p.value);
                              setDecimals(p.decimals);
                              setShowSupplyMenu(false);
                            }}
                            className={cn(
                              "w-full px-4 py-2.5 text-left text-sm hover:bg-white/5",
                              supply === p.value && "text-rh-lime"
                            )}
                          >
                            {p.label}
                            <span className="ml-2 text-rh-dim">{p.decimals} dec</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs text-rh-muted">Supply</label>
                      <input
                        type="number"
                        min={1}
                        max={1e15}
                        value={supply}
                        onChange={(e) => {
                          const next = Number(e.target.value) || 1;
                          setSupply(next);
                          setDecimals(defaultDecimalsForSupply(next));
                        }}
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-rh-muted">
                        Decimals
                        <span className="font-normal text-rh-dim"> · from supply</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={18}
                        value={decimals}
                        readOnly
                        className={cn(fieldClass, "cursor-default opacity-80")}
                        title="Set automatically from supply"
                      />
                    </div>
                  </div>
                </div>
              )}
            </Panel>

            {/* Fee sharing */}
            <Panel className="overflow-hidden">
              <ToggleRow
                title="Fee sharing"
                description={`Share fees with up to ${CHAIN_CONFIG.maxFeeShareRecipients} creators, apps, or wallets.`}
                icon={<Percent className="h-4 w-4" />}
                checked={feeSharing}
                onChange={(v) => {
                  setFeeSharing(v);
                  if (v && feeShares.length === 0) {
                    setFeeShares([{ address: "", pct: "" }]);
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
                        placeholder="0x… wallet"
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
              <SectionLabel>Ownership</SectionLabel>
              <p className="mt-1 text-[13px] text-rh-muted">
                Buy shares before anyone else.
              </p>

              <div className="relative mt-4">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={initialBuyEth}
                  onChange={(e) => setBuyEthManual(e.target.value)}
                  placeholder="0.0"
                  className={cn(
                    fieldClass,
                    "pr-16 text-2xl font-medium tracking-tight placeholder:text-rh-dim/80"
                  )}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-rh-muted">
                  ETH
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                <p className="flex items-center gap-1.5 text-rh-muted">
                  <Wallet className="h-3.5 w-3.5 text-rh-lime" />
                  <span className="tabular-nums">
                    Wallet{" "}
                    {isConnected
                      ? `${walletEth.toFixed(4)} ETH`
                      : "— connect to see"}
                  </span>
                </p>
                {buyEthNum > 0 ? (
                  <p className="tabular-nums text-rh-lime">
                    You get ≈ {receivedPct < 0.01 ? receivedPct.toFixed(4) : receivedPct.toFixed(2)}%
                    of supply
                  </p>
                ) : (
                  <p className="text-rh-dim">Pick a % or enter ETH</p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
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
                      {Number.isFinite(eth)
                        ? `${eth < 1 ? eth.toFixed(4) : eth.toFixed(2)} ETH`
                        : "—"}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-rh-dim">
                Cost follows the bonding curve ({INITIAL_VIRTUAL_ETH} ETH × 1.073B virtual
                reserves) plus the {CHAIN_CONFIG.platformFeeBps / 100}% creator trade fee —
                same math as the on-chain buy. Spot FDV × % underestimates because price rises
                as you buy.
              </p>

              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-500/15 to-amber-500/5 px-4 py-3.5 text-sm leading-snug text-amber-100/95">
                You need at least{" "}
                <span className="font-semibold tabular-nums text-amber-50">
                  {minEthNeeded.toFixed(4)} ETH
                </span>{" "}
                to cover creation fee, gas
                {buyEthNum > 0 ? `, and this ${receivedPct.toFixed(2)}% buy` : ""}.
              </div>
            </Panel>

            {/* CTA */}
            <div className="space-y-3 pt-1">
              {status === "success" && (
                <p className="rounded-2xl border border-rh-lime/30 bg-rh-lime/10 px-4 py-3 text-center text-sm text-rh-lime">
                  Token launched. Check Explore.
                </p>
              )}
              {error && (
                <p className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
                  {error}
                </p>
              )}

              {!isConnected ? (
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <RhButton
                      size="lg"
                      className="w-full !rounded-2xl !py-5 text-[17px] font-semibold shadow-[0_0_40px_-10px_rgba(204,255,0,0.55)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
                      onClick={openConnectModal}
                    >
                      Connect wallet to launch
                    </RhButton>
                  )}
                </ConnectButton.Custom>
              ) : (
                <RhButton
                  size="lg"
                  className="w-full !rounded-2xl !py-5 text-[17px] font-semibold shadow-[0_0_40px_-10px_rgba(204,255,0,0.55)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  onClick={handleLaunch}
                  disabled={!canLaunch || launching}
                >
                  {launching
                    ? "Launching…"
                    : canLaunch
                      ? `Launch for ${CHAIN_CONFIG.creationFee} ETH`
                      : "Add name & ticker to launch"}
                </RhButton>
              )}

              <p className="text-center text-[11px] leading-relaxed text-rh-dim">
                Live on Robinhood Chain · curve starts instantly
                {buyEthNum > 0 ? ` · first buy ${initialBuyEth} ETH` : ""}
              </p>
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
                  <dt className="text-rh-muted">Start price</dt>
                  <dd className="text-right tabular-nums text-white">
                    {formatTinyEth(preview.startPrice)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-rh-muted">Start market cap</dt>
                  <dd className="text-right tabular-nums text-white">
                    {formatMcap(preview.startMcap)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-rh-muted">Graduates at</dt>
                  <dd className="text-right tabular-nums text-rh-lime">
                    {formatMcap(preview.gradsAt)}
                  </dd>
                </div>
                {buyEthNum > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-rh-muted">First buy</dt>
                    <dd className="text-right tabular-nums text-white">
                      {buyEthNum.toFixed(4)} ETH
                      {ownershipPct != null ? ` · ${ownershipPct}%` : ""}
                    </dd>
                  </div>
                )}
              </dl>

              {(communityCoin ||
                communityBoard ||
                antiSnipe ||
                maxWallet2pct ||
                feeSharing) && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {communityCoin && <Chip>Community fees</Chip>}
                  {communityBoard && <Chip>Board</Chip>}
                  {antiSnipe && <Chip>Anti-snipe</Chip>}
                  {maxWallet2pct && <Chip>2% max</Chip>}
                  {feeSharing && <Chip>Fee share</Chip>}
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/35 px-3.5 py-3 text-[12px] leading-relaxed text-rh-muted">
                Ready when you are — connect, name it, launch for{" "}
                <span className="text-rh-lime">{CHAIN_CONFIG.creationFee} ETH</span>.
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
