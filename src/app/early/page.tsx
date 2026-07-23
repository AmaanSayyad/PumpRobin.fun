"use client";

import Image from "next/image";
import { RhButton } from "@/components/ui/rh-button";
import { MediaFrame, SplitHero } from "@/components/ui/media-frame";

/**
 * Media sourced from https://robinhood.com/us/en/crypto/staking/
 */
const POINTS = [
  {
    title: "Get rewarded, on repeat",
    body: "Enter early on the bonding curve. As buyers arrive, price discovery compounds onchain — visible on every trade.",
    media: "/brand/staking/container-1.jpg",
    isVideo: false,
  },
  {
    title: "Competitive upside",
    body: "Thin early curves move more on each buy. Late entries pay the discovered price. Timing is the edge.",
    media: "/brand/staking/container-2.jpg",
    isVideo: false,
  },
  {
    title: "Start with what you choose",
    body: "Pick a token on Explore, choose an amount in ETH, and buy from your wallet. That’s all it takes.",
    media: "/brand/staking/container-desktop.jpg",
    isVideo: false,
  },
];

export default function EarlyPage() {
  return (
    <div className="bg-black">
      <SplitHero
        mediaFit="contain"
        copy={
          <>
            <h1 className="rh-display text-[clamp(2.5rem,5.5vw,4.25rem)] text-white leading-[1.05] mb-5 max-w-lg">
              Hold early.
              <br />
              Ride the curve.
            </h1>
            <p className="text-white/65 text-lg max-w-md mb-8 leading-relaxed">
              Buy tokens while they&apos;re bonding — before DEX graduation — for as little
              ETH as you choose. Self-custody from the first trade.
            </p>
            <RhButton href="/explore" size="lg">
              Get started
            </RhButton>
          </>
        }
        media={
          <video
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

      <section className="py-20 sm:py-28">
        <div className="rh-container">
          <h2 className="rh-display text-3xl sm:text-4xl text-center mb-14">
            Get rewarded, on repeat
          </h2>
          <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
            {POINTS.map((p) => (
              <div key={p.title} className="flex flex-col">
                <MediaFrame aspect="feature" className="mb-5">
                  <Image
                    src={p.media}
                    alt=""
                    fill
                    className="object-cover object-center"
                    sizes="(max-width:768px) 100vw, 33vw"
                  />
                </MediaFrame>
                <h3 className="text-xl font-medium mb-3">{p.title}</h3>
                <p className="text-rh-muted leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative min-h-[48vh] sm:min-h-[55vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <video
            className="absolute inset-0 hidden h-full w-full object-cover md:block"
            autoPlay
            muted
            loop
            playsInline
            poster="/brand/staking/cta-poster.jpg"
          >
            <source src="/brand/staking/cta-texture-desktop.webm" type="video/webm" />
          </video>
          <video
            className="absolute inset-0 h-full w-full object-cover md:hidden"
            autoPlay
            muted
            loop
            playsInline
            poster="/brand/staking/cta-poster.jpg"
          >
            <source src="/brand/staking/cta-texture-mobile.webm" type="video/webm" />
          </video>
          <div className="absolute inset-0 bg-black/45" />
        </div>
        <div className="relative z-10 text-center px-5 py-20 max-w-xl mx-auto">
          <h2 className="rh-display text-3xl sm:text-5xl text-white mb-8">
            Start early on the next bonding curve
          </h2>
          <RhButton href="/explore" size="lg">
            Get started
          </RhButton>
        </div>
      </section>
    </div>
  );
}
