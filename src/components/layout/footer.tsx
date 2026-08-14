import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { PUMPROBIN_TELEGRAM_URL, PUMPROBIN_X_URL } from "@/lib/socials";

const PRODUCT = [
  { href: "/explore", label: "Explore" },
  { href: "/trade", label: "Trade" },
  { href: "/tokens", label: "Tokens" },
  { href: "/launch", label: "Launch" },
  { href: "/alerts", label: "Alerts" },
  { href: "/earn", label: "Earn" },
  { href: "/early", label: "Early" },
  { href: "/onramp", label: "On-ramp" },
];

const PLATFORM = [
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/analytics", label: "Analytics" },
  { href: "/roadmap", label: "Roadmap" },
];

const RESOURCES = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/docs", label: "Docs" },
  { href: "/developers", label: "Developers" },
  { href: "/how-it-works", label: "About" },
  { href: PUMPROBIN_TELEGRAM_URL, label: "Telegram", external: true as const },
  { href: PUMPROBIN_X_URL, label: "X", external: true as const },
];

const COMPANY = [
  { href: "https://docs.robinhood.com/chain", label: "Chain docs", external: true },
  { href: "https://robinhoodchain.blockscout.com", label: "Explorer", external: true },
  { href: "https://robinhood.com/us/en/chain/", label: "Robinhood Chain", external: true },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/terms#privacy", label: "Privacy" },
  { href: "/terms", label: "Disclosures" },
];

const SOCIAL = [
  {
    label: "X",
    href: PUMPROBIN_X_URL,
    icon: (
      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.743l7.227-8.451L1.61 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Telegram",
    href: PUMPROBIN_TELEGRAM_URL,
    icon: (
      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor" aria-hidden>
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.788.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
];

function Col({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string; external?: boolean }>;
}) {
  return (
    <div>
      <p className="font-medium text-[15px] mb-4 text-rh-on-lime">{title}</p>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={`${l.href}-${l.label}`}>
            {l.external ? (
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] text-rh-on-lime/85 hover:text-rh-on-lime transition-colors"
              >
                {l.label}
              </a>
            ) : (
              <Link
                href={l.href}
                className="text-[14px] text-rh-on-lime/85 hover:text-rh-on-lime transition-colors"
              >
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 bg-rh-lime text-rh-on-lime">
      <div className="rh-container pt-10 pb-12 sm:pt-12 sm:pb-14">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-10">
          <BrandMark
            href={false}
            size={32}
            textClassName="text-[17px] text-rh-on-lime"
          />
          <div className="flex items-center gap-4">
            <span className="text-[14px] text-rh-on-lime/85">Follow us on</span>
            <div className="flex items-center gap-3.5">
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="text-rh-on-lime/90 hover:text-rh-on-lime transition-colors"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 mb-10">
          <Col title="Product" links={PRODUCT} />
          <Col title="Platform" links={PLATFORM} />
          <Col title="Resources" links={RESOURCES} />
          <Col title="Company" links={COMPANY} />
        </div>

        <div className="pt-8 border-t border-rh-on-lime/20 space-y-3 text-[12px] leading-relaxed text-rh-on-lime/75 max-w-4xl">
          <p>PumpRobin.fun is a token launchpad built on Robinhood Chain.</p>
          <p>
            Crypto assets involve significant risk and can result in loss of capital.
            Nothing on this site is financial advice.
          </p>
          <p className="text-rh-on-lime/55 pt-1">
            © {new Date().getFullYear()} PumpRobin.fun · Built on Robinhood Chain
          </p>
        </div>
      </div>

      <div className="overflow-hidden select-none" aria-hidden>
        <p className="font-bold text-rh-on-lime tracking-[-0.04em] leading-[0.85] whitespace-nowrap text-[clamp(3.5rem,14vw,11rem)] px-3 sm:px-5 pb-2 sm:pb-4">
          PumpRobin.fun
        </p>
      </div>
    </footer>
  );
}
