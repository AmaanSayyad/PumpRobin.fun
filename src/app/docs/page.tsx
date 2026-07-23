import Link from "next/link";
import { RhButton } from "@/components/ui/rh-button";
import { CHAIN_CONFIG, WETH_ADDRESS } from "@/lib/chain";
import { INITIAL_VIRTUAL_ETH, INITIAL_VIRTUAL_TOKENS, DEFAULT_SUPPLY } from "@/lib/curve";
import {
  CREATOR_FEE_CARDS,
  CREATOR_FEES_BODY,
  CREATOR_FEES_INTRO,
  CREATOR_FEE_PCT,
  PLATFORM_FEE_PCT,
  FAIR_BY_DESIGN,
  LAUNCH_MECHANICS,
  TRADE_FEE_PCT,
} from "@/lib/product-docs";

const TOC = [
  { href: "#overview", label: "Overview" },
  { href: "#getting-started", label: "Getting started" },
  { href: "#mechanics", label: "Mechanics" },
  { href: "#launch-mechanics", label: "Launch mechanics" },
  { href: "#creator-fees", label: "Creator fees" },
  { href: "#fair-by-design", label: "Fair by design" },
  { href: "#chain", label: "Chain" },
  { href: "#constants", label: "Constants" },
  { href: "#contracts", label: "Contracts" },
  { href: "#apis", label: "Public APIs" },
  { href: "#faq", label: "FAQ" },
];

const FAQ = [
  {
    q: "How much does it cost to launch a token?",
    a: `${CHAIN_CONFIG.creationFee} ETH creation fee, plus gas. After that you only pay normal network gas for buys, sells, and (when live) fee claims.`,
  },
  {
    q: "How do I earn as a creator?",
    a: `You earn ${CREATOR_FEE_PCT}% of every bonding-curve trade on your token. PumpRobin takes ${PLATFORM_FEE_PCT}% (${TRADE_FEE_PCT}% total). Fees are paid on each trade.`,
  },
  {
    q: "Do I need to deploy my own API?",
    a: "No. Use the site UI, call our public JSON routes, or integrate contracts directly once the factory is deployed.",
  },
  {
    q: "Are launches on-chain today?",
    a: "Bonding-curve math and registry persistence are live in the app. Set NEXT_PUBLIC_FACTORY_ADDRESS after deploying PumpRobinFactory to create tokens fully on-chain.",
  },
  {
    q: "Where is Uniswap migrate?",
    a: `On graduation (~${CHAIN_CONFIG.graduationThreshold} ETH), BondingCurve wraps ETH to WETH, creates a Uniswap V3 TOKEN/WETH pool at the 1% fee tier (same as VLAD / CASHCAT / PONS on DEX Screener), seeds a full-range locked LP, then the token page routes trades via the Uniswap Trading API.`,
  },
  {
    q: "Are fees transparent?",
    a: `Yes — ${TRADE_FEE_PCT}% total on bonding-curve trades (${CREATOR_FEE_PCT}% creator + ${PLATFORM_FEE_PCT}% platform). Creation fee is ${CHAIN_CONFIG.creationFee} ETH.`,
  },
];

export default function DocsPage() {
  return (
    <div className="rh-container py-12 sm:py-16">
      <div className="grid lg:grid-cols-[200px_1fr] gap-12 lg:gap-16 max-w-5xl">
        <aside className="lg:sticky lg:top-24 self-start hidden lg:block">
          <p className="text-rh-lime text-sm font-medium mb-4">Docs</p>
          <nav className="space-y-2 text-sm">
            {TOC.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block text-rh-muted hover:text-white transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="mt-8 space-y-2">
            <RhButton href="/how-it-works" variant="outline" size="sm" className="w-full">
              How it works
            </RhButton>
            <RhButton href="/developers" variant="ghost" size="sm" className="w-full">
              Developers
            </RhButton>
          </div>
        </aside>

        <div className="min-w-0 max-w-2xl">
          <p className="text-rh-lime text-sm font-medium mb-3 lg:hidden">Docs</p>
          <h1 className="rh-display text-4xl sm:text-5xl mb-4">Docs</h1>
          <p className="text-rh-muted mb-4 leading-relaxed text-[15px]">
            Production reference for PumpRobin on Robinhood Chain — product mechanics,
            constants, contracts, and public reads.
          </p>
          <div className="flex flex-wrap gap-3 text-sm mb-12">
            <Link href="/how-it-works" className="text-rh-lime hover:underline">
              How it works
            </Link>
            <span className="text-rh-dim">·</span>
            <a
              href="https://robinhoodchain.blockscout.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rh-lime hover:underline"
            >
              Blockscout
            </a>
            <span className="text-rh-dim">·</span>
            <span className="text-rh-muted">chainId {4663}</span>
          </div>

          <section id="overview" className="mb-14 scroll-mt-24">
            <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-4">Overview</h2>
            <p className="text-rh-muted leading-relaxed text-[15px] mb-4">
              PumpRobin is a fair-launch pad for Robinhood Chain. Primary mode today:
              bonding curve with constant-product pricing that graduates at{" "}
              {CHAIN_CONFIG.graduationThreshold} ETH toward Uniswap V3 liquidity.
            </p>
            <p className="text-xs text-rh-dim">
              Flow: Create → Trade on curve → Graduate → DEX liquidity / LP fees
            </p>
          </section>

          <section id="getting-started" className="mb-14 scroll-mt-24">
            <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-6">
              Getting started
            </h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-medium mb-2">What is PumpRobin.fun?</h3>
                <p className="text-rh-muted leading-relaxed text-[15px]">
                  A permissionless token launchpad on Robinhood Chain. Launch ERC-20s with
                  bonding-curve trading and DEX graduation — similar in spirit to pump.fun,
                  built for an EVM L2.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">How do I connect?</h3>
                <p className="text-rh-muted leading-relaxed text-[15px]">
                  Use Connect in the header. Add Robinhood Chain (ID 4663, RPC{" "}
                  <code className="text-rh-lime text-[13px]">
                    https://rpc.mainnet.chain.robinhood.com
                  </code>
                  ) if your wallet does not auto-detect it.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">What does a launch cost?</h3>
                <p className="text-rh-muted leading-relaxed text-[15px]">
                  {CHAIN_CONFIG.creationFee} ETH creation fee, plus gas. Trading fee is{" "}
                  {CHAIN_CONFIG.tradeFeeBps / 100}% while on the bonding curve (
                  {CHAIN_CONFIG.creatorFeeBps / 100}% creator +{" "}
                  {CHAIN_CONFIG.platformFeeBps / 100}% platform).
                </p>
              </div>
            </div>
          </section>

          <section id="mechanics" className="mb-14 scroll-mt-24">
            <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-6">Mechanics</h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-medium mb-2">Bonding curve</h3>
                <p className="text-rh-muted leading-relaxed text-[15px]">
                  Constant-product AMM with virtual reserves (~{INITIAL_VIRTUAL_ETH} ETH ×{" "}
                  {INITIAL_VIRTUAL_TOKENS.toLocaleString()} virtual tokens at default
                  supply). Price rises as buyers enter. Anyone can sell before graduation.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">Graduation</h3>
                <p className="text-rh-muted leading-relaxed text-[15px]">
                  When the curve accumulates ~{CHAIN_CONFIG.graduationThreshold} ETH, the
                  token graduates: ETH is wrapped to WETH, a Uniswap V3 TOKEN/WETH pool
                  (1% fee) is created and seeded full-range, and the LP NFT is locked at
                  the dead address — then it trades like other Robinhood pairs on DEX Screener.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">Creator fees</h3>
                <p className="text-rh-muted leading-relaxed text-[15px]">
                  On-curve trade fee is {TRADE_FEE_PCT}% total — {CREATOR_FEE_PCT}% to the
                  creator and {PLATFORM_FEE_PCT}% to PumpRobin, paid on each trade.
                </p>
              </div>
            </div>
          </section>

          <section id="launch-mechanics" className="mb-14 scroll-mt-24">
            <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-3">
              Launch mechanics
            </h2>
            <p className="text-rh-muted text-[15px] leading-relaxed mb-6">
              Optional guards and metadata available on every create. Full product narrative
              also lives on{" "}
              <Link href="/how-it-works" className="text-rh-lime hover:underline">
                How it works
              </Link>
              .
            </p>
            <div className="space-y-6">
              {LAUNCH_MECHANICS.map((m) => (
                <div key={m.title}>
                  <h3 className="text-lg font-medium mb-2">{m.title}</h3>
                  <p className="text-rh-muted leading-relaxed text-[15px]">{m.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="creator-fees" className="mb-14 scroll-mt-24">
            <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-3">
              Creator fees & claiming
            </h2>
            <p className="text-rh-muted text-[15px] leading-relaxed mb-4">
              {CREATOR_FEES_INTRO}
            </p>
            <p className="text-rh-muted text-[15px] leading-relaxed mb-6">
              {CREATOR_FEES_BODY}
            </p>
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

          <section id="fair-by-design" className="mb-14 scroll-mt-24">
            <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-3">
              Fair by design
            </h2>
            <p className="text-rh-muted text-[15px] leading-relaxed mb-6">
              Trust comes from transparent math and contract-enforced rules — not marketing
              copy alone.
            </p>
            <div className="space-y-6">
              {FAIR_BY_DESIGN.map((f) => (
                <div key={f.title}>
                  <h3 className="text-lg font-medium mb-2">{f.title}</h3>
                  <p className="text-rh-muted leading-relaxed text-[15px]">{f.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="chain" className="mb-14 scroll-mt-24">
            <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-6">Chain</h2>
            <div className="rounded-2xl bg-rh-raised overflow-hidden text-sm">
              <Row k="Name" v="Robinhood Chain" />
              <Row k="Chain ID" v="4663" />
              <Row k="Native asset" v="ETH" />
              <Row
                k="RPC"
                v="https://rpc.mainnet.chain.robinhood.com"
                mono
              />
              <Row
                k="Explorer"
                v="robinhoodchain.blockscout.com"
                href="https://robinhoodchain.blockscout.com"
              />
              <Row
                k="WETH"
                v={WETH_ADDRESS}
                mono
                href={`https://robinhoodchain.blockscout.com/address/${WETH_ADDRESS}`}
              />
            </div>
          </section>

          <section id="constants" className="mb-14 scroll-mt-24">
            <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-6">
              Key constants
            </h2>
            <div className="rounded-2xl bg-rh-raised overflow-hidden text-sm">
              <Row k="createFee" v={`${CHAIN_CONFIG.creationFee} ETH`} />
              <Row k="Trade fee" v={`${CHAIN_CONFIG.tradeFeeBps / 100}% (${CHAIN_CONFIG.creatorFeeBps / 100}% creator + ${CHAIN_CONFIG.platformFeeBps / 100}% platform)`} />
              <Row k="GRADUATION_ETH" v={`${CHAIN_CONFIG.graduationThreshold} ETH`} />
              <Row k="Uniswap V3 fee" v="1% (10000) TOKEN/WETH" />
              <Row k="TOTAL_SUPPLY (default)" v={DEFAULT_SUPPLY.toLocaleString()} />
              <Row k="Virtual ETH" v={String(INITIAL_VIRTUAL_ETH)} />
              <Row
                k="Virtual tokens (default)"
                v={INITIAL_VIRTUAL_TOKENS.toLocaleString()}
              />
            </div>
          </section>

          <section id="contracts" className="mb-14 scroll-mt-24">
            <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-6">Contracts</h2>
            <p className="text-rh-muted text-[15px] leading-relaxed mb-4">
              Source lives in <code className="text-rh-lime text-[13px]">/contracts</code>:
              PumpRobinFactory, BondingCurve, PumpRobinToken. Deploy to mainnet/testnet,
              then set{" "}
              <code className="text-rh-lime text-[13px]">NEXT_PUBLIC_FACTORY_ADDRESS</code>.
            </p>
            <div className="rounded-2xl bg-rh-raised p-4 text-sm space-y-2">
              <p className="text-white font-medium">Factory status</p>
              <p className="text-rh-muted">
                {process.env.NEXT_PUBLIC_FACTORY_ADDRESS
                  ? `Configured: ${process.env.NEXT_PUBLIC_FACTORY_ADDRESS}`
                  : "Not deployed in this environment — launches use the platform registry until the factory address is set."}
              </p>
            </div>
            <p className="text-xs text-rh-dim mt-3">
              Shared infra on Robinhood Chain: WETH {WETH_ADDRESS.slice(0, 10)}…
            </p>
          </section>

          <section id="apis" className="mb-14 scroll-mt-24">
            <h2 className="text-sm uppercase tracking-wider text-rh-dim mb-4">
              Public APIs
            </h2>
            <p className="text-rh-muted text-[15px] leading-relaxed mb-4">
              Light JSON reads for catalog and stats. Full endpoint reference lives on the
              developers page.
            </p>
            <ul className="space-y-2 text-sm text-rh-muted mb-5">
              <li>
                <code className="text-rh-lime">GET /api/tokens</code> — token catalog
              </li>
              <li>
                <code className="text-rh-lime">GET /api/trades</code> — trade history
              </li>
              <li>
                <code className="text-rh-lime">GET /api/platform/stats</code> — aggregates
              </li>
              <li>
                <code className="text-rh-lime">GET /api/analytics</code> — series for charts
              </li>
            </ul>
            <RhButton href="/developers" variant="outline" size="sm">
              Open developer docs
            </RhButton>
          </section>

          <section id="faq" className="mb-14 scroll-mt-24">
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
            <RhButton href="/launch">Start launching</RhButton>
            <p className="text-sm text-rh-dim">
              <Link href="/roadmap" className="text-rh-lime hover:underline">
                Roadmap
              </Link>
              {" · "}
              <Link href="/terms" className="text-rh-lime hover:underline">
                Terms
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  k,
  v,
  mono,
  href,
}: {
  k: string;
  v: string;
  mono?: boolean;
  href?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-3 border-b border-white/[0.04] last:border-0">
      <span className="text-rh-muted shrink-0">{k}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-rh-lime hover:underline break-all text-right ${mono ? "font-mono text-xs" : ""}`}
        >
          {v}
        </a>
      ) : (
        <span
          className={`text-white break-all text-right ${mono ? "font-mono text-xs" : ""}`}
        >
          {v}
        </span>
      )}
    </div>
  );
}
