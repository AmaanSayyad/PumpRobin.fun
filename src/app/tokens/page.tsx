"use client";

import Image from "next/image";
import Link from "next/link";
import { RhButton } from "@/components/ui/rh-button";
import { MediaFrame, SplitHero } from "@/components/ui/media-frame";

/**
 * Tokens hero uses staking hero.mp4; mid-page still pulls crypto toolkit assets.
 */

const COST_ROWS = [
  { platform: "PumpRobin.fun", amount: "1% creator + 0.3% platform", delta: "—", highlight: true },
  { platform: "Typical CEX listing", amount: "High listing fees", delta: "Gated", highlight: false },
  { platform: "Seeded AMM", amount: "Requires LP capital", delta: "Upfront", highlight: false },
  { platform: "Permissioned pad", amount: "Approvals required", delta: "Waitlist", highlight: false },
];

const TOOLKIT = [
  {
    title: "Tokens",
    body: "Launch and trade memecoins as ERC-20s on Robinhood Chain. Bonding curves handle price discovery from block one.",
    image: "/brand/crypto/coins-frame.jpg",
    href: "/explore",
    crop: "default" as const,
  },
  {
    title: "Transfers",
    body: "Self-custody wallets. Send and receive with MetaMask, Rabby, or WalletConnect — your keys, your tokens.",
    image: "/brand/onramp/ramp-up.svg",
    href: "/onramp",
    crop: "default" as const,
  },
  {
    title: "Curve trades",
    body: "Buy and sell anytime while bonding. Transparent constant-product math with onchain settlement.",
    image: "/brand/crypto/component-2.jpg",
    href: "/trade",
    crop: "default" as const,
  },
  {
    title: "Alerts & tools",
    body: "Explore, charts, and leaderboards update from real onchain activity — not mock numbers.",
    image: "/brand/staking/container-2.jpg",
    href: "/analytics",
    /** Source has tall empty top — crop harder so it aligns with Curve trades */
    crop: "top" as const,
  },
];

const FAQ = [
  {
    q: "Do I own the tokens I buy?",
    a: "Yes. Tokens are ERC-20s in your wallet on Robinhood Chain — not synthetic price exposure.",
  },
  {
    q: "Is PumpRobin secure?",
    a: "Trading is onchain via open contracts. Verify addresses, size carefully, and never share seed phrases.",
  },
  {
    q: "Who can launch or trade?",
    a: "Anyone with a wallet and ETH for gas on Robinhood Chain (Chain ID 4663).",
  },
  {
    q: "What does it cost?",
    a: "0.0005 ETH to launch, plus gas. Creators earn 1% and PumpRobin takes 0.3% on every bonding-curve trade.",
  },
];

export default function TokensPage() {
  return (
    <div className="bg-black">
      {/* RH Crypto-style split: copy + spot render */}
      <SplitHero
        mediaFit="cover"
        className="bg-black"
        copy={
          <>
            <p className="text-[15px] font-medium text-rh-lime mb-6">PumpRobin Tokens</p>
            <h1 className="rh-display text-[clamp(2.5rem,5.5vw,4.25rem)] text-white leading-[1.05] mb-5 max-w-lg">
              Trade memecoins at launchpad cost.
            </h1>
            <p className="text-white/65 text-lg max-w-md mb-8 leading-relaxed">
              Buy &amp; sell on bonding curves with transparent fees. Launch for 0.0005 ETH —
              no seed LP, no gatekeepers — on Robinhood Chain.
            </p>
            <RhButton href="/explore" size="lg">
              Get started
            </RhButton>
          </>
        }
        media={
          <video
            className="absolute inset-0 h-full w-full object-cover object-center"
            autoPlay
            muted
            loop
            playsInline
            poster="/brand/staking/hero-graphic.jpg"
          >
            <source src="/brand/staking/hero.mp4" type="video/mp4" />
          </video>
        }
      />

      <section className="py-20 sm:py-28 bg-black">
        <div className="rh-container max-w-3xl">
          <h2 className="rh-display text-3xl sm:text-4xl mb-3 text-center text-white">
            Built for the lowest-friction launches
          </h2>
          <p className="text-rh-muted text-center mb-12">
            Compare the path from idea to tradeable token.
          </p>
          <div className="overflow-x-auto border border-rh-raised">
            <table className="w-full text-left text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-rh-raised text-rh-dim">
                  <th className="px-4 py-3 font-medium">Platform</th>
                  <th className="px-4 py-3 font-medium">Cost / access</th>
                  <th className="px-4 py-3 font-medium">vs PumpRobin</th>
                </tr>
              </thead>
              <tbody>
                {COST_ROWS.map((row) => (
                  <tr key={row.platform} className="border-b border-rh-raised/70 last:border-0">
                    <td className={`px-4 py-4 font-medium ${row.highlight ? "text-rh-lime" : "text-white"}`}>
                      {row.platform}
                    </td>
                    <td className="px-4 py-4 text-white/75">{row.amount}</td>
                    <td className="px-4 py-4 text-white/55">{row.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Put your crypto to work — RH uses staking clips here */}
      <section className="py-20 sm:py-28 border-t border-rh-raised">
        <div className="rh-container">
          <h2 className="rh-display text-3xl sm:text-4xl text-center mb-4">Put your tokens to work</h2>
          <p className="text-rh-muted text-center mb-14 max-w-lg mx-auto">
            Launch, trade, graduate — then keep building on Robinhood Chain.
          </p>
          <div className="grid sm:grid-cols-2 gap-8 lg:gap-10 max-w-4xl mx-auto">
            <Link href="/earn" className="flex flex-col border border-rh-raised overflow-hidden hover:border-rh-border transition-colors">
              <MediaFrame aspect="wide">
                <video
                  className="absolute inset-0 h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                >
                  <source src="/brand/futures/commissions-mobile.webm" type="video/webm" />
                </video>
              </MediaFrame>
              <div className="p-6 flex-1">
                <p className="text-rh-lime text-sm mb-2">Earn</p>
                <h3 className="text-xl font-medium mb-2">Creator upside</h3>
                <p className="text-rh-muted text-sm">Launch on the curve and capture early momentum.</p>
              </div>
            </Link>
            <Link href="/early" className="flex flex-col border border-rh-raised overflow-hidden hover:border-rh-border transition-colors">
              <MediaFrame aspect="wide">
                <video
                  className="absolute inset-0 h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                >
                  <source src="/brand/crypto/staking-clip-x2.mp4" type="video/mp4" />
                </video>
              </MediaFrame>
              <div className="p-6 flex-1">
                <p className="text-rh-lime text-sm mb-2">Early</p>
                <h3 className="text-xl font-medium mb-2">Hold through the curve</h3>
                <p className="text-rh-muted text-sm">Enter early while bonding — price discovery is visible.</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 border-t border-rh-raised">
        <div className="rh-container">
          <h2 className="rh-display text-3xl sm:text-4xl mb-12">Your complete toolkit</h2>
          <div className="grid sm:grid-cols-2 gap-10 lg:gap-12">
            {TOOLKIT.map((item) => (
              <div key={item.title} className="flex flex-col">
                <MediaFrame
                  aspect="square"
                  className="mb-5 max-w-[340px] w-full"
                >
                  {item.image.endsWith(".svg") ? (
                    // SVGs stay crisp via native img (Next Image SVG opt can break strokes)
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt=""
                      className="absolute inset-0 m-auto h-[78%] w-[78%] object-contain"
                    />
                  ) : (
                    <div
                      className={
                        item.crop === "top"
                          ? "absolute inset-x-[-2%] -top-[62%] bottom-[-10%]"
                          : "absolute inset-x-[-4%] -top-[42%] bottom-[-6%]"
                      }
                    >
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        className={
                          item.crop === "top"
                            ? "object-cover object-[center_70%]"
                            : "object-cover object-[center_88%]"
                        }
                        sizes="340px"
                      />
                    </div>
                  )}
                </MediaFrame>
                <h3 className="text-xl font-medium mb-2">{item.title}</h3>
                <p className="text-rh-muted leading-relaxed mb-4 flex-1">{item.body}</p>
                <Link href={item.href} className="text-rh-lime text-sm hover:underline">
                  Learn more →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 border-t border-rh-raised">
        <div className="rh-container max-w-2xl">
          <h2 className="rh-display text-3xl sm:text-4xl mb-3">You&apos;ve got questions.</h2>
          <p className="text-rh-muted mb-10">We&apos;ve got answers.</p>
          <div className="space-y-8">
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="font-medium mb-2">{item.q}</h3>
                <p className="text-rh-muted text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RH Crypto closing animation */}
      <section className="relative min-h-[50vh] sm:min-h-[55vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            poster="/brand/crypto/crypto-animation-poster.jpg"
          >
            <source src="/brand/crypto/crypto-animation.webm" type="video/webm" />
          </video>
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="relative z-10 text-center px-5 py-20 max-w-xl mx-auto">
          <h2 className="rh-display text-3xl sm:text-5xl text-white mb-8">
            Low-cost. Onchain. A new standard for memecoins.
          </h2>
          <RhButton href="/launch" size="lg">
            Get started
          </RhButton>
        </div>
      </section>
    </div>
  );
}
