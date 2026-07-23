"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { RhButton } from "@/components/ui/rh-button";
import { BrandMark } from "@/components/brand-mark";
import { MediaFrame, SplitBlock } from "@/components/ui/media-frame";
import { useAppStore } from "@/lib/store";
import { formatEth } from "@/lib/utils";

const FEATURES = [
  {
    title: "The launchpad for memecoins",
    body: "Deploy an ERC-20 on Robinhood Chain in one transaction. Bonding curve starts at block one — no seed LP required.",
    href: "/launch",
    cta: "Launch a token",
    image: "/brand/chain/container1-desktop.jpg",
    video: "/brand/chain/mainnet-hero-desktop.webm" as string | undefined,
    /** Desktop webm is ultrawide 2800×1440 — match frame so top/bottom aren't cropped */
    aspect: "ultrawide" as const,
    mediaLift: "landscape" as const,
  },
  {
    title: "Create new ways to trade",
    body: "Buy and sell on a constant-product curve. Price discovery is automatic. Graduate to DEX liquidity when the curve fills.",
    href: "/explore",
    cta: "Explore tokens",
    image: "/brand/chain/speed-desktop.jpg",
    video: undefined,
    /** Still is portrait 1176×1633, subject sits low in frame */
    aspect: "portrait" as const,
    mediaLift: "portrait" as const,
  },
  {
    title: "Expand your reach",
    body: "Build where Robinhood Chain users already trade. EVM tooling, ETH gas, Arbitrum Orbit speed.",
    href: "/docs",
    cta: "Read the docs",
    image: "/brand/crypto/coins-frame.jpg",
    video: undefined,
    aspect: "portrait" as const,
    /** Extra top crop — candles sit low in the source art */
    mediaLift: "portraitTight" as const,
  },
];

const INFRA = [
  {
    title: "Permissionless by design",
    body: "Anyone can launch or trade without intermediaries or platform lock-in.",
  },
  {
    title: "Built for Robinhood Chain",
    body: "Chain ID 4663. Native ETH gas. Fully EVM-compatible with standard wallets and tooling.",
  },
  {
    title: "Made for builders",
    body: "Open contracts, event-driven indexing, and a clean API surface for bots and dashboards.",
  },
  {
    title: "Speed you can rely on",
    body: "Arbitrum Orbit L2 — high throughput with Ethereum security under the hood.",
  },
];

export default function HomePage() {
  const { stats } = useAppStore();

  return (
    <div className="bg-black">
      {/* Hero — full-bleed video from robinhood.com/us/en/ */}
      <section className="relative min-h-[100svh] flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-black">
          <video
            className="absolute inset-0 hidden h-full w-full object-cover md:block"
            autoPlay
            muted
            loop
            playsInline
            poster="/brand/home/poster-desktop.jpeg"
          >
            <source src="/brand/home/HPTO_V3-Fade-Desktop.mp4" type="video/mp4" />
          </video>
          <video
            className="absolute inset-0 h-full w-full object-cover md:hidden"
            autoPlay
            muted
            loop
            playsInline
            poster="/brand/home/poster-mobile.jpeg"
          >
            <source src="/brand/home/HPTO_V3-Fade-Mobile.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/70" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center px-5 pt-20 pb-16 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8 flex justify-center"
          >
            <BrandMark
              href={false}
              size={24}
              textClassName="text-[15px] text-white/85"
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.7 }}
            className="rh-display text-[clamp(3rem,8vw,5.5rem)] text-white mb-6"
          >
            Memes, onchain
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="text-[17px] sm:text-lg text-white/75 max-w-2xl leading-relaxed mb-10"
          >
            PumpRobin.fun is a permissionless token launchpad on Robinhood Chain
            <br />
            Bonding Curves, Instant Trading, and DEX Graduation.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <RhButton href="/launch" size="lg">
              Start launching
            </RhButton>
          </motion.div>
        </div>
      </section>

      {/* Unlock utility */}
      <section className="py-16 sm:py-24">
        <div className="rh-container">
          <h2 className="rh-display text-4xl sm:text-5xl text-center mb-12 sm:mb-14">
            Unlock a new era of utility
          </h2>

          <div className="space-y-12 sm:space-y-14">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5 }}
              >
                <SplitBlock
                  reverse={i % 2 === 1}
                  align="start"
                  copy={
                    <>
                      <h3 className="rh-display text-3xl sm:text-4xl mb-4">{f.title}</h3>
                      <p className="text-rh-muted text-lg leading-relaxed mb-8 max-w-md">
                        {f.body}
                      </p>
                      <RhButton href={f.href} variant="outline" size="sm">
                        {f.cta}
                      </RhButton>
                    </>
                  }
                  media={
                    f.mediaLift === "landscape" ? (
                      <div className="relative w-full overflow-hidden bg-black">
                        <div className="origin-center scale-[1.12] sm:scale-[1.15] -translate-y-[6%]">
                          <video
                            className="block w-full h-auto"
                            autoPlay
                            muted
                            loop
                            playsInline
                            poster="/brand/chain/mainnet-hero-mobile.jpg"
                          >
                            <source src={f.video} type="video/webm" />
                          </video>
                        </div>
                      </div>
                    ) : (
                      <MediaFrame
                        aspect={f.aspect}
                        className={
                          f.mediaLift === "portrait" || f.mediaLift === "portraitTight"
                            ? "!w-auto h-[min(40vh,380px)] max-w-full mx-auto lg:mx-0"
                            : undefined
                        }
                      >
                        <div
                          className={
                            f.mediaLift === "portraitTight"
                              ? "absolute inset-x-[-6%] -top-[62%] bottom-[-4%]"
                              : f.mediaLift === "portrait"
                                ? "absolute inset-x-[-8%] -top-[48%] bottom-[-8%]"
                                : "absolute inset-0"
                          }
                        >
                          <Image
                            src={f.image}
                            alt=""
                            fill
                            className={
                              f.mediaLift === "portraitTight"
                                ? "object-cover object-[center_92%]"
                                : f.mediaLift === "portrait"
                                  ? "object-cover object-[center_88%]"
                                  : "object-cover object-center"
                            }
                            sizes="(max-width:1024px) 100vw, 420px"
                          />
                        </div>
                      </MediaFrame>
                    )
                  }
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Infrastructure */}
      <section className="py-24 sm:py-32 bg-black">
        <div className="rh-container">
          <h2 className="rh-display text-4xl sm:text-5xl text-center max-w-2xl mx-auto mb-20">
            Modern infrastructure for a global economy
          </h2>
          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-14">
            {INFRA.map((item) => (
              <div key={item.title}>
                <h3 className="text-xl font-medium mb-3">{item.title}</h3>
                <p className="text-rh-muted leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-16 w-full overflow-hidden bg-rh-lime">
            <Image
              src="/brand/chain/chain-partners-banner-desktop.jpg"
              alt="Ecosystem partners"
              width={1600}
              height={600}
              className="w-full h-auto object-contain object-center"
              sizes="(max-width:1152px) 100vw, 72rem"
            />
          </div>
        </div>
      </section>

      {/* Stats strip — honest zeros */}
      <section className="py-16">
        <div className="rh-container grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: "Tokens launched", value: String(stats.totalTokens) },
            { label: "24h volume", value: `${formatEth(stats.volume24h)} ETH` },
            { label: "Traders (24h)", value: String(stats.activeTraders) },
            { label: "Graduated", value: String(stats.graduatedTokens) },
          ].map((s) => (
            <div key={s.label}>
              <p className="rh-display text-3xl sm:text-4xl mb-2">{s.value}</p>
              <p className="text-sm text-rh-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA — New Generation video from robinhood.com */}
      <section className="relative min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-black">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          >
            <source
              src="/brand/home/Dotcom_NewGeneration_Animation_WEB.webm"
              type="video/webm"
            />
          </video>
          <div className="absolute inset-0 bg-black/35" />
        </div>

        <div className="relative z-10 text-center px-5 py-28 sm:py-36">
          <h2 className="rh-display text-4xl sm:text-5xl lg:text-6xl mb-8 text-white">
            Join the next generation
            <br />
            of onchain builders
          </h2>
          <RhButton href="/launch" size="lg">
            Start launching
          </RhButton>
        </div>
      </section>
    </div>
  );
}
