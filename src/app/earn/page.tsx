"use client";

import Image from "next/image";
import { RhButton } from "@/components/ui/rh-button";
import { MediaFrame, SplitBlock, SplitHero } from "@/components/ui/media-frame";

/**
 * Media sourced from https://robinhood.com/us/en/crypto/earn/
 * (Earn page is image-only on RH — no videos.)
 */
export default function EarnPage() {
  return (
    <div className="bg-black">
      <SplitHero
        mediaFit="cover"
        copy={
          <>
            <p className="text-[15px] font-medium text-white/80 mb-6">PumpRobin Earn</p>
            <h1 className="rh-display text-[clamp(2.5rem,5.5vw,4.5rem)] text-white leading-[1.05] mb-5 max-w-lg">
              Put your launches to work
            </h1>
            <p className="text-white/65 text-lg max-w-md mb-8 leading-relaxed">
              Create a token on the bonding curve and capture attention as traders discover,
              buy, and push toward DEX graduation — on Robinhood Chain.
            </p>
            <RhButton href="/launch" size="lg">
              Get started
            </RhButton>
          </>
        }
        media={
          <>
            <Image
              src="/brand/earn/hero-desktop.jpeg"
              alt=""
              fill
              priority
              className="hidden object-cover object-center sm:block"
              sizes="(max-width:1024px) 100vw, 50vw"
            />
            <Image
              src="/brand/earn/hero-mobile.jpg"
              alt=""
              fill
              priority
              className="object-cover object-center sm:hidden"
              sizes="100vw"
            />
          </>
        }
      />

      <section className="py-20 sm:py-28">
        <div className="rh-container">
          <h2 className="rh-display text-3xl sm:text-4xl text-center mb-14">A new way to launch</h2>
          <div className="grid md:grid-cols-2 gap-8 lg:gap-10 max-w-5xl mx-auto">
            <div className="flex flex-col">
              <MediaFrame aspect="wide">
                <Image
                  src="/brand/earn/transfer-boost.jpg"
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width:768px) 100vw, 50vw"
                />
              </MediaFrame>
              <div className="border border-t-0 border-rh-raised p-6 sm:p-8 flex-1">
                <h3 className="text-xl font-medium mb-3">Built-in discovery</h3>
                <p className="text-rh-muted leading-relaxed">
                  New tokens appear on Explore and Leaderboard as volume and trades happen —
                  no listing desk required.
                </p>
              </div>
            </div>
            <div className="flex flex-col">
              <MediaFrame aspect="wide">
                <Image
                  src="/brand/earn/ira-match.jpg"
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width:768px) 100vw, 50vw"
                />
              </MediaFrame>
              <div className="border border-t-0 border-rh-raised p-6 sm:p-8 flex-1">
                <h3 className="text-xl font-medium mb-3">Flexible access</h3>
                <p className="text-rh-muted leading-relaxed">
                  No lock-ups to launch. Deploy for 0.0005 ETH, trade the curve, graduate when
                  the market is ready.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 border-t border-rh-raised">
        <div className="rh-container">
          <SplitBlock
            copy={
              <>
                <h2 className="rh-display text-3xl sm:text-4xl mb-5">
                  Start earning attention onchain
                </h2>
                <p className="text-rh-muted text-lg leading-relaxed mb-8 max-w-md">
                  Launch an ERC-20, seed price discovery on the curve, and let real traders
                  decide what graduates.
                </p>
                <RhButton href="/launch" size="lg">
                  Launch a token
                </RhButton>
              </>
            }
            media={
              <MediaFrame aspect="feature" size="lg" className="lg:ml-auto lg:mr-0">
                <Image
                  src="/brand/earn/apy-tablet.jpg"
                  alt=""
                  fill
                  className="hidden object-cover sm:block"
                  sizes="(max-width:1024px) 100vw, 40vw"
                />
                <Image
                  src="/brand/earn/apy-mobile.jpg"
                  alt=""
                  fill
                  className="object-cover sm:hidden"
                  sizes="100vw"
                />
              </MediaFrame>
            }
            reverse
          />
        </div>
      </section>

      <section className="relative min-h-[50vh] sm:min-h-[55vh] flex items-center justify-center overflow-hidden">
        <Image
          src="/brand/earn/cta-hero.jpg"
          alt=""
          fill
          className="object-cover opacity-50"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 text-center px-5 py-20 max-w-xl mx-auto">
          <h2 className="rh-display text-3xl sm:text-5xl text-white mb-8">
            Start earning with your next launch
          </h2>
          <RhButton href="/launch" size="lg">
            Get started
          </RhButton>
        </div>
      </section>
    </div>
  );
}
