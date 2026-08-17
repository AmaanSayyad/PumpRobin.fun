import Link from "next/link";
import { RhButton } from "@/components/ui/rh-button";
import { CHAIN_CONFIG } from "@/lib/chain";
import { DEFAULT_SUPPLY } from "@/lib/curve";
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
  "Trade on the curve",
  "Graduate to Uniswap v4",
  "Locked liquidity",
] as const;

const STEPS = [
  {
    n: "01",
    title: "Create your token",
    body: `Connect your wallet and set name, ticker, image, description, and optional socials. Supply is ${DEFAULT_SUPPLY.toLocaleString()} tokens. Creation fee: ${CHAIN_CONFIG.creationFee} ETH — no LP seed needed. Any extra ETH becomes your first buy.`,
  },
  {
    n: "02",
    title: "Trade on the curve",
    body: `Your coin opens at ${CHAIN_CONFIG.launchFdvEth} ETH market cap and trades on a bonding curve. ${CHAIN_CONFIG.curveSupply.toLocaleString()} of the ${DEFAULT_SUPPLY.toLocaleString()} supply sells here — no liquidity to seed, no price to set.`,
  },
  {
    n: "03",
    title: "Graduate to Uniswap v4",
    body: `Once the curve raises ${CHAIN_CONFIG.graduationThreshold} ETH the coin migrates automatically: the remaining ${CHAIN_CONFIG.poolSupply.toLocaleString()} tokens plus the entire raise go into a Uniswap v4 pool at roughly ${CHAIN_CONFIG.graduationFdvEth} ETH market cap.`,
  },
  {
    n: "04",
    title: "Liquidity locked, fees enforced",
    body: `Liquidity can never be pulled — the pool's hook rejects every removal. That same hook charges ${CHAIN_CONFIG.tradeFeeBps / 100}% on the ETH side of every buy and sell, whether the trade comes from PumpRobin, Uniswap, MetaMask, GMGN or Axiom.`,
  },
];

const TOKENOMICS = [
  { label: "Supply", value: "1B" },
  { label: "Sold on curve", value: `${CHAIN_CONFIG.curveSupply / 1e6}M` },
  { label: "Into the pool", value: `${CHAIN_CONFIG.poolSupply / 1e6}M` },
  { label: "Launch market cap", value: `${CHAIN_CONFIG.launchFdvEth} ETH` },
  { label: "Graduates at", value: `${CHAIN_CONFIG.graduationThreshold} ETH raised` },
  { label: "Trade fee", value: `${CHAIN_CONFIG.tradeFeeBps / 100}% everywhere` },
];

const FEES = [
  {
    title: "Token creation",
    detail: "Paid once at launch (+ gas)",
    value: `${CHAIN_CONFIG.creationFee} ETH`,
  },
  {
    title: "Every buy and every sell",
    detail: `${CHAIN_CONFIG.creatorFeeBps / 100}% to the creator, ${CHAIN_CONFIG.platformFeeBps / 100}% to PumpRobin — charged on-chain, on any venue`,
    value: `${CHAIN_CONFIG.tradeFeeBps / 100}%`,
  },
];

const FAQ = [
  {
    q: "What is PumpRobin.fun?",
    a: "A fair-launch memecoin launchpad on Robinhood Chain. Launch an ERC-20 that trades on a bonding curve, then graduates into a Uniswap v4 pool with permanently locked liquidity — indexed by DEX Screener and GMGN.",
  },
  {
    q: "How does launch work?",
    a: `Pay the ${CHAIN_CONFIG.creationFee} ETH creation fee and you are live — there is no liquidity to seed. ${CHAIN_CONFIG.curveSupply.toLocaleString()} tokens sell on the curve; at ${CHAIN_CONFIG.graduationThreshold} ETH raised the remaining ${CHAIN_CONFIG.poolSupply.toLocaleString()} and the whole raise move into Uniswap v4. Any ETH you send above the fee buys your own first bag.`,
  },
  {
    q: "What fees does PumpRobin charge?",
    a: `${CHAIN_CONFIG.creationFee} ETH once at launch, then ${CHAIN_CONFIG.tradeFeeBps / 100}% on the ETH side of every trade — ${CHAIN_CONFIG.creatorFeeBps / 100}% to the creator and ${CHAIN_CONFIG.platformFeeBps / 100}% to PumpRobin. The pool's hook takes it on-chain, so it applies on Uniswap, MetaMask, GMGN and Axiom too, not only here. Network gas is separate.`,
  },
  {
    q: "Is liquidity rug-pullable?",
    a: "No. Liquidity is minted full-range into the v4 pool and the hook reverts every removal attempt — there is no LP NFT to transfer or unlock. DYOR on contract addresses and always verify on Blockscout / DEX Screener.",
  },
  {
    q: "Can I customize supply?",
    a: "No — supply is fixed at 1 billion. The curve reserves are calibrated to that number, and changing it would break the 830M / 170M split that sets the launch price.",
  },
  {
    q: "How do I earn as a creator?",
    a: `${CREATOR_FEE_PCT}% of the ETH leg of every buy and every sell, for as long as the coin trades. It accrues on-chain and you claim it whenever you like — the curve holds it before graduation, the pool's hook after. No pause, no blacklist, no admin.`,
  },
  {
    q: "Why doesn't my logo show on GMGN / DEX Screener?",
    a: "GMGN and most wallets do read it — they fetch metadataURI from the contract and use its image field, which PumpRobin writes at launch. DEX Screener does not: its logos come from its own CMS, so you have to submit one through Update Token Info on your pair page (manual review, usually 24–72h).",
  },
  {
    q: "What do max wallet and community options do?",
    a: "Max wallet is enforced on-chain: with it on, no wallet outside the pool and routers can hold more than 2% of supply. Community coin / board are optional social features.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="rh-container py-12 sm:py-16 max-w-3xl">
      <p className="text-rh-lime text-sm font-medium mb-3">Product</p>
      <h1 className="rh-display text-4xl sm:text-5xl mb-4">How it works</h1>
      <p className="text-rh-muted text-[15px] leading-relaxed mb-10 max-w-2xl">
        PumpRobin is a fair-launch pad on Robinhood Chain. Every launch is a signed
        factory transaction that pays the creation fee. Coins trade on a bonding curve first, then graduate into a Uniswap v4 pool with liquidity locked for good.
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
