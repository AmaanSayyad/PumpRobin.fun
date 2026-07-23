"use client";

import Image from "next/image";
import { RhButton } from "@/components/ui/rh-button";
import { MediaFrame, BleedHero } from "@/components/ui/media-frame";

const FEATURES = [
  {
    title: "More ways to fund",
    body: "Bridge or transfer ETH to Robinhood Chain, then connect any EVM wallet to PumpRobin.fun.",
    icon: "/brand/onramp/transfer.svg",
  },
  {
    title: "Ramp up your reach",
    body: "Once you have ETH for gas on Chain ID 4663, launch and trade without leaving the open web.",
    icon: "/brand/onramp/ramp-up.svg",
  },
  {
    title: "Zero pad deposit fees",
    body: "No platform deposit fees on PumpRobin. You pay chain gas and transparent curve fees only.",
    icon: "/brand/onramp/zero-fees.svg",
  },
  {
    title: "Seamless integration",
    body: "Standard RPC, explorer, and wallets. Add the chain once — MetaMask, Rabby, or WalletConnect.",
    icon: "/brand/onramp/integration.svg",
  },
];

export default function OnrampPage() {
  return (
    <div className="bg-black">
      <BleedHero
        minHeight="hero"
        media={
          <>
            <video
              className="hidden md:block"
              autoPlay
              muted
              loop
              playsInline
              poster="/brand/onramp/hero-poster.jpg"
            >
              <source src="/brand/onramp/hero-desktop.webm" type="video/webm" />
            </video>
            <video
              className="md:hidden"
              autoPlay
              muted
              loop
              playsInline
              poster="/brand/onramp/hero-poster.jpg"
            >
              <source src="/brand/onramp/hero-mobile.webm" type="video/webm" />
            </video>
          </>
        }
      >
        <p className="text-rh-lime text-sm font-medium mb-4">On-ramp</p>
        <h1 className="rh-display text-[clamp(2.5rem,6vw,4.5rem)] text-white mb-5 leading-[1.05]">
          Easy on-ramp to Robinhood Chain
        </h1>
        <p className="text-white/70 text-lg max-w-xl mb-3 leading-relaxed">
          Low fees, seamless wallet connect
        </p>
        <p className="text-white/55 text-base max-w-xl mb-8 leading-relaxed">
          Get ETH onto Chain ID 4663, connect your wallet, and launch or trade on
          PumpRobin.fun — from funding to first memecoin in minutes.
        </p>
        <div className="flex flex-wrap gap-3">
          <RhButton href="/explore" size="lg">
            Let&apos;s connect
          </RhButton>
          <a
            href="https://docs.robinhood.com/chain"
            target="_blank"
            rel="noopener noreferrer"
            className="rh-pill inline-flex items-center justify-center font-medium text-base px-8 py-4 border border-rh-lime text-white hover:bg-rh-lime/10"
          >
            Chain docs
          </a>
        </div>
      </BleedHero>

      <section className="py-20 sm:py-28 border-y border-rh-raised">
        <div className="rh-container max-w-3xl text-center mx-auto">
          <h2 className="rh-display text-3xl sm:text-4xl mb-5">
            Offer yourself a path into onchain markets
          </h2>
          <p className="text-rh-muted text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            PumpRobin runs entirely on Robinhood Chain. Fund your wallet with ETH for gas,
            then buy, sell, and launch without custodial middlemen on the pad.
          </p>
          <MediaFrame aspect="wide" size="lg" className="border border-rh-raised">
            <Image
              src="/brand/onramp/ui-desktop.png"
              alt=""
              fill
              className="object-contain p-5 sm:p-8"
              sizes="(max-width:768px) 100vw, 560px"
            />
          </MediaFrame>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="rh-container">
          <div className="grid sm:grid-cols-2 gap-6 lg:gap-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="border border-rh-raised p-6 sm:p-8 flex gap-5">
                <div className="relative w-11 h-11 shrink-0 mt-0.5">
                  <Image src={f.icon} alt="" fill className="object-contain invert" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-medium mb-2">{f.title}</h3>
                  <p className="text-rh-muted leading-relaxed">{f.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 border border-rh-raised p-8 sm:p-10 max-w-2xl">
            <h3 className="font-medium mb-4">Quick network details</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-rh-raised pb-3">
                <dt className="text-rh-muted">Chain ID</dt>
                <dd className="font-mono">4663</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-rh-raised pb-3">
                <dt className="text-rh-muted">RPC</dt>
                <dd className="font-mono text-right break-all">
                  https://rpc.mainnet.chain.robinhood.com
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-rh-muted">Explorer</dt>
                <dd>
                  <a
                    href="https://robinhoodchain.blockscout.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rh-lime hover:underline"
                  >
                    Blockscout →
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="relative min-h-[45vh] flex items-center justify-center overflow-hidden border-t border-rh-raised">
        <div className="relative z-10 text-center px-5 py-20 max-w-xl mx-auto">
          <h2 className="rh-display text-3xl sm:text-5xl text-white mb-8">
            Sign up for the next trade
          </h2>
          <RhButton href="/explore" size="lg">
            Let&apos;s connect
          </RhButton>
        </div>
      </section>
    </div>
  );
}
