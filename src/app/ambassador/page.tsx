import Link from "next/link";
import { RhButton } from "@/components/ui/rh-button";
import { PUMPROBIN_TELEGRAM_URL, PUMPROBIN_X_URL } from "@/lib/socials";

const PERKS = [
  {
    title: "Referral spotlight",
    body: "Get featured placement when your community launches through your link — we pin high-signal ambassadors on Explore.",
  },
  {
    title: "Launch support",
    body: "Priority help with IPFS logos, DEX Screener token info, and Blockscout verification for tokens you onboard.",
  },
  {
    title: "Revenue share (coming soon)",
    body: "Earn a slice of platform fees from launches attributed to your ambassador code once on-chain referral tracking ships.",
  },
  {
    title: "Early access",
    body: "Test new launch modes, analytics, and tooling before public release.",
  },
];

const STEPS = [
  "Apply with your X / Telegram and a short note on your audience.",
  "We send an ambassador kit: brand assets, talking points, and your trackable link.",
  "Host AMAs, threads, or streams — onboard creators to PumpRobin.fun.",
  "Report wins; we amplify successful launches across our channels.",
];

export default function AmbassadorPage() {
  return (
    <div className="bg-black min-h-screen">
      <section className="rh-container py-16 sm:py-24 max-w-3xl">
        <p className="text-rh-lime text-sm font-medium mb-3">Community</p>
        <h1 className="rh-display text-4xl sm:text-5xl mb-5">Ambassador program</h1>
        <p className="text-rh-muted text-[15px] leading-relaxed mb-10 max-w-2xl">
          Help builders launch on Robinhood Chain. Ambassadors grow the PumpRobin
          ecosystem, onboard creators, and get visibility for the communities they
          bring.
        </p>

        <div className="flex flex-wrap gap-3 mb-14">
          <RhButton
            href={`mailto:team@pumprobin.fun?subject=PumpRobin%20Ambassador%20Application`}
            size="lg"
          >
            Apply now
          </RhButton>
          <RhButton href={PUMPROBIN_TELEGRAM_URL} variant="outline" size="lg">
            Join Telegram
          </RhButton>
        </div>

        <h2 className="text-xl font-medium mb-6">What you get</h2>
        <div className="grid sm:grid-cols-2 gap-6 mb-14">
          {PERKS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-white/[0.06] bg-rh-raised/40 p-5"
            >
              <h3 className="font-medium mb-2">{p.title}</h3>
              <p className="text-sm text-rh-muted leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-medium mb-4">How it works</h2>
        <ol className="space-y-3 mb-14 text-[15px] text-rh-muted leading-relaxed list-decimal list-inside">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>

        <div className="rounded-2xl border border-rh-lime/25 bg-rh-lime/10 px-5 py-5 text-sm leading-relaxed text-rh-lime/95">
          <p className="font-medium text-rh-lime mb-2">Who we&apos;re looking for</p>
          <p className="text-rh-lime/85">
            CT natives, regional community leads, streamers, and devs who care about
            fair launches. You don&apos;t need a huge following — consistency and
            quality matter more than raw follower count.
          </p>
        </div>

        <p className="mt-10 text-sm text-rh-dim">
          Questions? DM us on{" "}
          <a
            href={PUMPROBIN_X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-rh-lime hover:underline"
          >
            X
          </a>{" "}
          or{" "}
          <Link href="/how-it-works" className="text-rh-lime hover:underline">
            read how launches work
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
