"use client";

import Image from "next/image";
import Link from "next/link";
import { RhButton } from "@/components/ui/rh-button";
import { MediaFrame, SplitBlock, BleedHero } from "@/components/ui/media-frame";

const STAGES = [
  {
    stage: "Launch",
    fee: "0.0005 ETH",
    liquidity: "Virtual reserves",
    trading: "Instant",
    settlement: "Bonding curve",
  },
  {
    stage: "Bonding",
    fee: "Curve spread",
    liquidity: "Growing ETH pool",
    trading: "24/7 onchain",
    settlement: "Constant-product",
  },
  {
    stage: "Graduate",
    fee: "Curve complete",
    liquidity: "DEX LP seed",
    trading: "Open market",
    settlement: "DEX pool",
  },
];

const FEATURES = [
  {
    title: "Enjoy low launch fees",
    body: "Deploy an ERC-20 on Robinhood Chain for 0.0005 ETH. No seed LP required — the bonding curve starts at block one.",
    media: (
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
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 pointer-events-none">
          <Image
            src="/brand/futures/fees-chart.png"
            alt=""
            width={480}
            height={260}
            className="w-full max-w-[85%] sm:max-w-sm mx-auto object-contain drop-shadow-lg"
          />
        </div>
      </MediaFrame>
    ),
  },
  {
    title: "Permissionless price discovery",
    body: "Every buy and sell moves the curve. No market makers, no listings desk — fair launch mechanics anyone can join.",
    media: (
      <MediaFrame aspect="wide">
        <Image
          src="/brand/futures/cards.jpg"
          alt=""
          fill
          className="object-cover object-center"
          sizes="(max-width:1024px) 100vw, 50vw"
        />
      </MediaFrame>
    ),
  },
  {
    title: "Trade nearly 24 hours a day",
    body: "Robinhood Chain never sleeps. Buy and sell as news breaks — EVM wallets, native ETH gas, always online.",
    media: (
      <MediaFrame aspect="wide">
        <video
          className="absolute inset-0 h-full w-full object-cover object-center"
          autoPlay
          muted
          loop
          playsInline
          poster="/brand/futures/fundamentals-poster.jpg"
        >
          <source src="/brand/futures/phone.mp4" type="video/mp4" />
        </video>
      </MediaFrame>
    ),
  },
];

export default function TradePage() {
  return (
    <div className="bg-black">
      <BleedHero
        minHeight="hero"
        media={
          <>
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="/brand/futures/fundamentals-poster.jpg"
              className="absolute inset-0 h-full w-full object-cover object-center"
            >
              <source src="/brand/futures/fundamentals.mp4" type="video/mp4" />
            </video>
          </>
        }
      >
        <p className="text-rh-lime text-sm font-medium mb-4">Trade</p>
        <h1 className="rh-display text-[clamp(2.5rem,6vw,4.75rem)] text-white mb-6 leading-[1.05]">
          More insight.
          <br />
          More speed.
          <br />
          Smarter onchain tools.
        </h1>
        <p className="text-white/70 text-lg max-w-xl mb-10 leading-relaxed">
          Trade memecoins on bonding curves with instant settlement, transparent
          pricing, and DEX graduation when the curve fills — all on Robinhood Chain.
        </p>
        <div className="flex flex-wrap gap-3">
          <RhButton href="/explore" size="lg">
            Start trading
          </RhButton>
          <RhButton href="/docs" variant="outline" size="lg">
            Learn more
          </RhButton>
        </div>
      </BleedHero>

      <section className="border-y border-rh-raised py-12 sm:py-16">
        <div className="rh-container text-center max-w-3xl mx-auto">
          <h2 className="rh-display text-3xl sm:text-4xl mb-4">
            Trade new tokens, graduated markets, and everything in between.
          </h2>
          <p className="text-rh-muted text-lg">
            No greeks. No time decay. Just permissionless ERC-20s on a constant-product curve.
          </p>
        </div>
        <div className="rh-container mt-8 sm:mt-10">
          <MediaFrame aspect="wide" className="h-[180px] sm:h-[220px] lg:h-[260px] !aspect-auto">
            <Image
              src="/brand/futures/cards.jpg"
              alt=""
              fill
              className="object-cover object-center"
              sizes="100vw"
            />
          </MediaFrame>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="rh-container space-y-16 sm:space-y-20">
          {FEATURES.map((f, i) => (
            <SplitBlock
              key={f.title}
              reverse={i % 2 === 1}
              copy={
                <>
                  <h3 className="rh-display text-3xl sm:text-4xl mb-5">{f.title}</h3>
                  <p className="text-rh-muted text-lg leading-relaxed max-w-md">{f.body}</p>
                </>
              }
              media={f.media}
            />
          ))}
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="rh-container">
          <SplitBlock
            reverse
            copy={
              <>
                <h2 className="rh-display text-3xl sm:text-4xl mb-5">
                  The PumpRobin difference
                </h2>
                <ul className="space-y-4 text-rh-muted text-lg">
                  <li className="flex gap-3">
                    <span className="text-rh-lime shrink-0">→</span>
                    Real onchain balances — no simulated portfolio numbers
                  </li>
                  <li className="flex gap-3">
                    <span className="text-rh-lime shrink-0">→</span>
                    Transparent curve math anyone can verify
                  </li>
                  <li className="flex gap-3">
                    <span className="text-rh-lime shrink-0">→</span>
                    Built for Robinhood Chain (Chain ID 4663, ETH gas)
                  </li>
                  <li className="flex gap-3">
                    <span className="text-rh-lime shrink-0">→</span>
                    Graduate to open DEX liquidity when the curve completes
                  </li>
                </ul>
              </>
            }
            media={
              <MediaFrame aspect="video">
                <video
                  className="absolute inset-0 h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster="/brand/futures/fundamentals-poster.jpg"
                >
                  <source src="/brand/futures/fundamentals.mp4" type="video/mp4" />
                </video>
              </MediaFrame>
            }
          />
        </div>
      </section>

      <section className="py-12 sm:py-16 border-t border-rh-raised">
        <div className="rh-container">
          <h2 className="rh-display text-3xl sm:text-4xl mb-3">Choose your stage</h2>
          <p className="text-rh-muted mb-8 max-w-xl">
            Every token on PumpRobin moves through the same transparent lifecycle.
          </p>

          <div className="overflow-x-auto border border-rh-raised">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-rh-raised text-rh-dim">
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Cost</th>
                  <th className="px-4 py-3 font-medium">Liquidity</th>
                  <th className="px-4 py-3 font-medium">Trading</th>
                  <th className="px-4 py-3 font-medium">Settlement</th>
                </tr>
              </thead>
              <tbody>
                {STAGES.map((row) => (
                  <tr key={row.stage} className="border-b border-rh-raised/80 last:border-0">
                    <td className="px-4 py-4 font-medium text-rh-lime">{row.stage}</td>
                    <td className="px-4 py-4 text-white/85">{row.fee}</td>
                    <td className="px-4 py-4 text-white/85">{row.liquidity}</td>
                    <td className="px-4 py-4 text-white/85">{row.trading}</td>
                    <td className="px-4 py-4 text-white/85">{row.settlement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link href="/explore" className="text-rh-lime hover:underline">
              Browse live tokens →
            </Link>
            <Link href="/launch" className="text-rh-lime hover:underline">
              Launch a new token →
            </Link>
          </div>
        </div>
      </section>

      <section className="relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-black">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            poster="/brand/futures/cta-poster.jpg"
          >
            <source src="/brand/futures/cta-texture.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="relative z-10 text-center px-5 py-16 sm:py-20 max-w-xl mx-auto">
          <h2 className="rh-display text-4xl sm:text-5xl text-white mb-6">
            Onchain markets are one tap away
          </h2>
          <RhButton href="/explore" size="lg">
            Get started
          </RhButton>
        </div>
      </section>
    </div>
  );
}
