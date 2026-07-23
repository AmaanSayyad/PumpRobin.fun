import Link from "next/link";
import type { ReactNode } from "react";

export default function TermsPage() {
  return (
    <div className="rh-container py-12 sm:py-16 max-w-2xl">
      <p className="text-rh-lime text-sm font-medium mb-3">Legal</p>
      <h1 className="rh-display text-4xl sm:text-5xl mb-3">Terms of Use</h1>
      <p className="text-xs text-rh-dim mb-10">Last updated: July 23, 2026</p>

      <div className="prose-invert space-y-10 text-[15px] leading-relaxed text-rh-muted">
        <p>
          These Terms of Use (“Terms”) govern your access to and use of the PumpRobin.fun
          website, interface, and related services (the “Service”). By accessing or using
          the Service, you agree to these Terms. If you do not agree, do not use the
          Service.
        </p>

        <Section title="1. Nature of the Service">
          <p>
            PumpRobin provides non-custodial software infrastructure that lets users create
            and trade tokens on Robinhood Chain, including bonding-curve launches and
            (when available) DEX graduation flows.
          </p>
          <p>
            PumpRobin is not a bank, broker, exchange operator, custodian, investment
            adviser, or financial institution. We do not hold your private keys, seed
            phrases, or crypto assets. You interact with smart contracts and your wallet
            directly.
          </p>
          <p>
            Nothing on the Service constitutes financial, investment, legal, or tax advice.
            You are solely responsible for your decisions.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            You must be at least 18 years old (or the age of majority in your jurisdiction)
            to use the Service.
          </p>
          <p>
            You are responsible for complying with all laws that apply to you, including
            sanctions and local restrictions on crypto assets. You may not use the Service
            if doing so would be unlawful where you live.
          </p>
        </Section>

        <Section title="3. Risks">
          <p>
            Tokens available through the Service are highly speculative and can lose all
            value. Prices can move quickly; liquidity can disappear; smart contracts,
            wallets, RPCs, and third-party infrastructure can fail or be exploited.
          </p>
          <p>
            On-chain transactions are generally irreversible. PumpRobin cannot reverse,
            cancel, or refund transactions submitted through your wallet.
          </p>
          <p>
            Always do your own research (DYOR) before creating, buying, or selling any
            token.
          </p>
        </Section>

        <Section title="4. User-created tokens">
          <p>
            Anyone with a compatible wallet may create tokens via the Service. PumpRobin
            does not issue, endorse, audit, or guarantee any token, project, team, or
            metadata.
          </p>
          <p>
            UI labels such as rankings, progress bars, or similar signals are informational
            only and do not mean a token is safe, legitimate, or reviewed.
          </p>
          <p>
            Creators are solely responsible for their tokens, images, descriptions, social
            links, and any claims they make. You must not impersonate others, infringe
            trademarks, or publish unlawful or deceptive content.
          </p>
        </Section>

        <Section title="5. Non-custodial; liquidity locks">
          <p>You control your wallet. PumpRobin never takes custody of your funds.</p>
          <p>
            Depending on contract version, Uniswap V3 liquidity may be locked or held in a
            non-custodial fee collector that can collect and distribute swap fees but cannot
            withdraw underlying liquidity. Protocol mechanics may change over time; on-chain
            code and explorers are the source of truth.
          </p>
        </Section>

        <Section title="6. Fees">
          <p>
            Using the Service may involve creation fees, trading fees, protocol or platform
            fees, Uniswap fees, and network gas fees paid on-chain or recorded by the
            interface.
          </p>
          <p>
            Fee parameters can change. Displayed estimates are approximate; the amounts
            executed in your wallet transaction (when on-chain) control.
          </p>
        </Section>

        <Section title="7. Prohibited use">
          <p>
            You agree not to use the Service to engage in fraud, market manipulation,
            phishing, malware distribution, wash trading intended to deceive others,
            unauthorized access, circumvention of safeguards, or any illegal activity.
          </p>
          <p>
            We may restrict access to the interface where reasonably necessary to protect
            the Service or users. On-chain contracts may remain usable independently of the
            website.
          </p>
        </Section>

        <Section title="8. Intellectual property">
          <p>
            The PumpRobin name, logo, and interface design are owned by PumpRobin or its
            licensors. You may not copy or use them without permission, except as needed to
            use the Service.
          </p>
          <p>
            By submitting content (including token metadata), you grant PumpRobin a
            worldwide, non-exclusive, royalty-free license to host, display, and distribute
            that content in connection with the Service.
          </p>
        </Section>

        <Section title="9. Disclaimer of warranties">
          <p className="uppercase text-sm tracking-wide">
            The Service is provided “as is” and “as available” without warranties of any
            kind, express or implied, including merchantability, fitness for a particular
            purpose, and non-infringement.
          </p>
          <p>
            We do not warrant that the Service will be uninterrupted, error-free, secure,
            or free of harmful components, or that any token or data is accurate or
            complete.
          </p>
        </Section>

        <Section title="10. Limitation of liability">
          <p>
            To the maximum extent permitted by law, PumpRobin and its contributors shall
            not be liable for any indirect, incidental, special, consequential, or punitive
            damages, or any loss of profits, data, or crypto assets, arising from your use
            of the Service or any token.
          </p>
          <p>
            Our aggregate liability for claims relating to the Service shall not exceed one
            hundred US dollars (US $100) or the equivalent, except where liability cannot
            be limited under applicable law.
          </p>
        </Section>

        <Section title="11. Indemnification">
          <p>
            You agree to indemnify and hold harmless PumpRobin and its contributors from
            claims, damages, and expenses (including reasonable legal fees) arising from
            your use of the Service, your tokens or content, or your violation of these
            Terms or applicable law.
          </p>
        </Section>

        <Section title="12. Changes">
          <p>
            We may update these Terms from time to time. The “Last updated” date at the top
            of this page will change when we do. Continued use of the Service after changes
            means you accept the updated Terms.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions about these Terms: use the official channels listed on PumpRobin.fun.
            These Terms are provided in English.
          </p>
        </Section>

        <hr className="border-rh-raised" />

        <div id="privacy">
          <h2 className="text-2xl font-medium text-white mb-2">Privacy Policy</h2>
          <p className="text-xs text-rh-dim mb-6">Last updated: July 23, 2026</p>

          <Section title="1. Overview">
            <p>
              PumpRobin is a non-custodial interface. We do not require account
              registration or KYC to use the core Service.
            </p>
            <p>
              Blockchain activity (wallet addresses, transactions, token balances) is public
              by nature of the network you use.
            </p>
          </Section>

          <Section title="2. Data we may process">
            <p>Wallet addresses you choose to connect or view in the interface.</p>
            <p>
              Technical logs and analytics such as approximate location, device/browser
              type, and referral URLs, if enabled.
            </p>
            <p>
              Content you submit (token images, names, social links) when creating a token,
              stored via our platform database and/or decentralized storage.
            </p>
          </Section>

          <Section title="3. Local storage & cookies">
            <p>
              We may use browser local storage for preferences such as UI state and
              acceptance of these Terms. Analytics providers may set cookies subject to
              their own policies.
            </p>
          </Section>

          <Section title="4. Third parties">
            <p>
              The Service relies on third parties including wallet providers, RPC nodes,
              block explorers, cloud databases, and analytics. Their processing is governed
              by their own terms and privacy policies.
            </p>
          </Section>

          <Section title="5. Contact">
            <p>
              For privacy questions, reach us via the official channels on PumpRobin.fun.
            </p>
          </Section>
        </div>
      </div>

      <p className="mt-14 text-sm text-rh-dim">
        Memecoins are highly speculative.{" "}
        <Link href="/" className="text-rh-lime hover:underline">
          Back to PumpRobin
        </Link>
        {" · "}
        <Link href="/how-it-works" className="text-rh-lime hover:underline">
          How it works
        </Link>
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 mb-8 last:mb-0">
      <h2 className="text-lg font-medium text-white">{title}</h2>
      {children}
    </section>
  );
}
