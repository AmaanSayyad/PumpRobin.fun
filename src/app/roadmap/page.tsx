import Link from "next/link";
import { RhButton } from "@/components/ui/rh-button";
import { cn } from "@/lib/utils";

const PHASES = [
  {
    id: "01",
    title: "Phase 1 — Launchpad foundation",
    status: "current" as const,
    items: [
      "Ship PumpRobin.fun as a memecoin launchpad UI on Robinhood Chain",
      "Bonding-curve launches that graduate into locked Uniswap v4 pools",
      "On-chain creation fee collected in PumpRobinFactory.createToken",
      "Product docs, how-it-works, and developer API surface",
    ],
  },
  {
    id: "02",
    title: "Phase 2 — Factory live",
    status: "current" as const,
    items: [
      "PumpRobinFactory + PumpRobinToken on Robinhood Chain mainnet",
      "createToken pays 0.004 ETH fee and deploys the coin with its curve",
      "2% on every buy and sell, enforced by the v4 hook on any router",
      "Registry indexes only confirmed factory transactions",
    ],
  },
  {
    id: "03",
    title: "Phase 3 — Creator economy",
    status: "planned" as const,
    items: [
      "Post-graduation LP fee collector (protocol split)",
      "Fee payout history / explorer links",
      "Discovery signals (momentum / volume heat) on explore cards",
      "Continuous UX improvements from trader and creator feedback",
    ],
  },
  {
    id: "04",
    title: "Phase 4 — Long-term expansion",
    status: "planned" as const,
    items: [
      "Partnerships and ecosystem tooling on Robinhood Chain",
      "Partnerships and ecosystem tooling on Robinhood Chain",
      "Hardened public APIs and indexer-backed charts",
      "Establish PumpRobin as a leading fair-launch pad on the chain",
    ],
  },
];

const STATUS_LABEL = {
  current: "Current",
  next: "Next",
  planned: "Planned",
} as const;

export default function RoadmapPage() {
  return (
    <div className="rh-container py-12 sm:py-16 max-w-3xl">
      <p className="text-rh-lime text-sm font-medium mb-3">Product vision</p>
      <h1 className="rh-display text-4xl sm:text-5xl mb-4">Roadmap</h1>
      <p className="text-rh-muted text-[15px] leading-relaxed mb-3 max-w-2xl">
        Where PumpRobin is headed — from fair-launch tooling today to a full creator and
        trader stack on Robinhood Chain.
      </p>
      <p className="text-xs text-rh-dim mb-12">
        {PHASES.length} phases · Factory live on Robinhood Chain
      </p>

      <div className="flex flex-wrap gap-2 mb-12 text-xs">
        {["Launchpad", "On-chain", "Creator", "Long-term"].map((t) => (
          <span key={t} className="px-3 py-1.5 rounded-full bg-rh-raised text-rh-muted">
            {t}
          </span>
        ))}
      </div>

      <ol className="space-y-10 mb-16">
        {PHASES.map((phase) => (
          <li key={phase.id} className="rounded-2xl bg-rh-raised p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="text-rh-lime font-medium tabular-nums text-sm">
                {phase.id}
              </span>
              <h2 className="text-lg sm:text-xl font-medium flex-1 min-w-0">
                {phase.title}
              </h2>
              <span
                className={cn(
                  "text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full font-medium",
                  phase.status === "current"
                    ? "bg-rh-lime text-rh-on-lime"
                    : "bg-white/5 text-rh-muted"
                )}
              >
                {STATUS_LABEL[phase.status]}
              </span>
            </div>
            <ul className="space-y-2.5">
              {phase.items.map((item) => (
                <li
                  key={item}
                  className="text-[15px] text-rh-muted leading-relaxed pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[0.55em] before:w-1.5 before:h-1.5 before:rounded-full before:bg-rh-lime/70"
                >
                  {item}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className="pt-10 border-t border-rh-raised text-center space-y-5">
        <p className="text-rh-muted text-sm max-w-md mx-auto">
          The factory is live — launch a token or trade locked Uniswap pools on
          Robinhood Chain today.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <RhButton href="/explore">Explore tokens</RhButton>
          <RhButton href="/how-it-works" variant="outline">
            How it works
          </RhButton>
        </div>
        <p className="text-xs text-rh-dim">
          <Link href="/docs" className="text-rh-lime hover:underline">
            Docs
          </Link>
          {" · "}
          <Link href="/terms" className="text-rh-lime hover:underline">
            Terms
          </Link>
        </p>
      </div>
    </div>
  );
}
