import Link from "next/link";
import { RhButton } from "@/components/ui/rh-button";
import { CHAIN_CONFIG } from "@/lib/chain";
import { INITIAL_VIRTUAL_ETH, DEFAULT_SUPPLY } from "@/lib/curve";
import {
  CREATOR_FEE_CARDS,
  CREATOR_FEES_BODY,
  CREATOR_FEES_INTRO,
  CREATOR_FEE_PCT,
  FAIR_BY_DESIGN,
  LAUNCH_MECHANICS,
} from "@/lib/product-docs";

const LIFECYCLE = [
  "Create",
  "Seed LP",
  "Trade on DEX",
  "Locked liquidity",
] as const;

const STEPS = [
  {
    n: "01",
    title: "Create your token",
    body: `Connect your wallet and set name, ticker, image, description, and optional socials. Default supply is ${DEFAULT_SUPPLY.toLocaleString()} tokens. Min LP seed: ${CHAIN_CONFIG.minInstantSeedEth} ETH. Creation fee: ${CHAIN_CONFIG.creationFee} ETH.`,
  },
  {
    n: "02",
    title: "Instant Uniswap V3 LP",
    body: `Every launch seeds a Uniswap V3 TOKEN/WETH pool immediately. ~${CHAIN_CONFIG.instantLpEthPct}% of your seed locks as LP; the rest buys tokens for you. LP supply scales with seed size so small launches stay expensive. Excess supply is burned.`,
  },
  {
    n: "03",
    title: "Trade on DEX",
    body: "Trading happens on Uniswap V3 from block one — GMGN, DEX Screener, and PumpRobin all route through the locked pool. Uniswap pool fee is 1% (TOKEN/WETH tier used on Robinhood memecoins).",
  },
  {
    n: "04",
    title: "Liquidity locked",
    body: "The LP NFT is sent to the dead address so principal cannot be withdrawn. Verify pool + lock on Blockscout and DEX Screener.",
  },
];

const TOKENOMICS = [
  { label: "Default supply", value: "1B" },
  { label: "Min LP seed", value: `${CHAIN_CONFIG.minInstantSeedEth} ETH` },
  { label: "Target start FDV", value: `${CHAIN_CONFIG.instantTargetFdvEth} ETH` },
  { label: "Pool fee", value: "1% Uniswap" },
];

const FEES = [
  {
    title: "Token creation",
    detail: "Paid once at launch (+ min LP seed + gas)",
    value: `${CHAIN_CONFIG.creationFee} ETH`,
  },
  {
    title: "Uniswap pool",
    detail: "1% TOKEN/WETH · LP NFT locked at dead address",
    value: "1% tier",
  },
];

const FAQ = [
  {
    q: "What is PumpRobin.fun?",
    a: "A fair-launch memecoin launchpad on Robinhood Chain. Launch an ERC-20 with instant Uniswap V3 locked LP — live on DEX Screener and GMGN from block one.",
  },
  {
    q: "How does launch work?",
    a: `Pay ${CHAIN_CONFIG.creationFee} ETH creation fee plus at least ${CHAIN_CONFIG.minInstantSeedEth} ETH LP seed. ~${CHAIN_CONFIG.instantLpEthPct}% seeds locked Uniswap liquidity; the rest buys tokens for you. Excess supply is burned.`,
  },
  {
    q: "What fees does PumpRobin charge?",
    a: `${CHAIN_CONFIG.creationFee} ETH creation fee at launch. Trades happen on Uniswap (1% pool fee). Network gas is separate.`,
  },
  {
    q: "Is liquidity rug-pullable?",
    a: "After graduation, the Uniswap V3 LP NFT is sent to the dead address so principal cannot be withdrawn. DYOR on contract addresses and always verify on Blockscout / DEX Screener.",
  },
  {
    q: "Can I customize supply?",
    a: "Yes on the launch form. Standard is 1 billion; custom supply scales virtual token reserves so curve economics stay comparable.",
  },
  {
    q: "How do I earn as a creator?",
    a: `${CREATOR_FEE_PCT}% creator + ${CHAIN_CONFIG.platformFeeBps / 100}% platform on taxed transfers. Fees go straight to the creator wallet and platform wallet as tokens — no pause, no blacklist, no admin.`,
  },
  {
    q: "Why doesn't my logo show on GMGN / DEX Screener?",
    a: "Indexers don't read on-chain imageUri automatically. After graduation, submit your logo via DEX Screener's Update Token Info on your token page (manual review, usually 24–72h). PumpRobin stores the IPFS URL on-chain and in our registry.",
  },
  {
    q: "What do max wallet and community options do?",
    a: "Max wallet aims to cap any wallet at ~2% of supply early (metadata today; on-chain enforcement follows). Community coin / board are optional social features on the token page.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="rh-container py-12 sm:py-16 max-w-3xl">
      <p className="text-rh-lime text-sm font-medium mb-3">Product</p>
      <h1 className="rh-display text-4xl sm:text-5xl mb-4">How it works</h1>
      <p className="text-rh-muted text-[15px] leading-relaxed mb-10 max-w-2xl">
        PumpRobin is a fair-launch pad on Robinhood Chain. Launch on a progressive
        bonding curve that graduates toward Uniswap — price discovery first, DEX
        liquidity after.
      </p>

      <div className="flex flex-wrap gap-2 mb-14">
        {LIFECYCLE.map((step, i) => (
          <span key={step} className="inline-flex items-center gap-2 text-xs sm:text-sm">
            <span className="px-3 py-1.5 rounded-full bg-rh-raised text-white">{step}</span>
            {i < LIFECYCLE.length - 1 && (
              <span className="text-rh-dim hidden sm:inline" aria-hidden>
                →
              </span>
            )}
          </span>
        ))}
      </div>

      <ol className="space-y-12 mb-16">
        {STEPS.map((s) => (
          <li key={s.n} className="grid sm:grid-cols-[4rem_1fr] gap-3 sm:gap-6">
            <span className="text-rh-lime font-medium tabular-nums">{s.n}</span>
            <div>
              <h2 className="text-xl font-medium mb-2">{s.title}</h2>
              <p className="text-rh-muted leading-relaxed text-[15px]">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mb-16">
        <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-6">Tokenomics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TOKENOMICS.map((t) => (
            <div key={t.label} className="rounded-2xl bg-rh-raised p-4">
              <p className="text-xs text-rh-muted mb-1">{t.label}</p>
              <p className="text-lg font-medium text-white tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-6">Fees</h2>
        <div className="space-y-3">
          {FEES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl bg-rh-raised px-4 py-4"
            >
              <div>
                <p className="text-sm font-medium text-white">{f.title}</p>
                <p className="text-xs text-rh-muted mt-0.5">{f.detail}</p>
              </div>
              <p className="text-sm text-rh-lime tabular-nums shrink-0">{f.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-3">
          Launch mechanics
        </h2>
        <p className="text-rh-muted text-[15px] leading-relaxed mb-6">
          Every launch can use the same optional guards and metadata. Here&apos;s what each
          one does.
        </p>
        <div className="space-y-5">
          {LAUNCH_MECHANICS.map((m) => (
            <div key={m.title}>
              <h3 className="text-base font-medium mb-1.5">{m.title}</h3>
              <p className="text-rh-muted text-[15px] leading-relaxed">{m.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-3">
          Creator fees
        </h2>
        <p className="text-rh-muted text-[15px] leading-relaxed mb-4">
          {CREATOR_FEES_INTRO}
        </p>
        <p className="text-rh-muted text-[15px] leading-relaxed mb-6">{CREATOR_FEES_BODY}</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {CREATOR_FEE_CARDS.map((c) => (
            <div key={c.label} className="rounded-2xl bg-rh-raised p-4">
              <p className="text-lg font-medium text-rh-lime tabular-nums">{c.value}</p>
              <p className="text-sm text-white mt-1">{c.label}</p>
              <p className="text-xs text-rh-muted mt-0.5">{c.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-3">
          Fair by design
        </h2>
        <p className="text-rh-muted text-[15px] leading-relaxed mb-6">
          Fairness is the product goal — curve math and fees are meant to be enforced by
          contracts, not slogans.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {FAIR_BY_DESIGN.map((f) => (
            <div key={f.title} className="rounded-2xl bg-rh-raised p-4">
              <h3 className="text-sm font-medium text-white mb-1.5">{f.title}</h3>
              <p className="text-xs text-rh-muted leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-6">FAQ</h2>
        <div className="space-y-8">
          {FAQ.map((item) => (
            <div key={item.q}>
              <h3 className="text-lg font-medium mb-2">{item.q}</h3>
              <p className="text-rh-muted leading-relaxed text-[15px]">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="pt-10 border-t border-rh-raised text-center space-y-5">
        <p className="rh-display text-3xl">Ready to launch?</p>
        <div className="flex flex-wrap justify-center gap-3">
          <RhButton href="/launch">Launch a token</RhButton>
          <RhButton href="/explore" variant="outline">
            Explore tokens
          </RhButton>
        </div>
        <p className="text-xs text-rh-dim max-w-md mx-auto leading-relaxed">
          Memecoins are highly speculative. PumpRobin provides infrastructure only — not
          financial advice.{" "}
          <Link href="/terms" className="text-rh-lime hover:underline">
            Terms
          </Link>
          {" · "}
          <Link href="/docs" className="text-rh-lime hover:underline">
            Docs
          </Link>
        </p>
      </div>
    </div>
  );
}
