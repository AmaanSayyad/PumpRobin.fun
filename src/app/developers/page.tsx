import Link from "next/link";
import { RhButton } from "@/components/ui/rh-button";

const TOC = [
  { href: "#introduction", label: "Introduction" },
  { href: "#authentication", label: "Authentication" },
  { href: "#pagination", label: "Pagination" },
  { href: "#rate-limiting", label: "Rate limiting" },
  { href: "#errors", label: "Error responses" },
  { href: "#endpoints", label: "Endpoints" },
];

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/tokens",
    title: "List tokens",
    body: "Returns all registered tokens (enriched with curve stats) and recent trades.",
    response: `{
  "tokens": [ /* Token[] */ ],
  "trades": [ /* Trade[] */ ],
  "count": 0
}`,
  },
  {
    method: "POST",
    path: "/api/tokens",
    title: "Create token",
    body: "Registers a new token in the platform registry. Requires name, symbol, and creator.",
    response: `{
  "name": "Example",
  "symbol": "EX",
  "creator": "0x…",
  "imageUri": "",
  "description": ""
}`,
  },
  {
    method: "GET",
    path: "/api/trades?token=0x…",
    title: "List trades",
    body: "Optional token query filters trades for a single bonding curve.",
    response: `{ "trades": [ /* Trade[] */ ] }`,
  },
  {
    method: "POST",
    path: "/api/trades",
    title: "Place trade",
    body: "Simulates/records a buy or sell against the bonding curve. Body: tokenAddress, trader, isBuy, amount.",
    response: `{
  "tokenAddress": "0x…",
  "trader": "0x…",
  "isBuy": true,
  "amount": 0.01
}`,
  },
  {
    method: "GET",
    path: "/api/platform/stats",
    title: "Platform stats",
    body: "Aggregate volume, launches, traders, fees, and graduations.",
    response: `{ /* PlatformStats */ }`,
  },
  {
    method: "GET",
    path: "/api/analytics",
    title: "Analytics series",
    body: "Time-series volume and graduation data for dashboards.",
    response: `{
  "stats": { /* … */ },
  "volumeSeries": [],
  "graduationSeries": []
}`,
  },
];

export default function DevelopersPage() {
  return (
    <div className="bg-black">
      <div className="rh-container py-12 sm:py-16">
        <div className="grid lg:grid-cols-[220px_1fr] gap-12 lg:gap-16">
          <aside className="lg:sticky lg:top-24 self-start">
            <p className="text-rh-lime text-sm font-medium mb-4">Developers</p>
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
            <div className="mt-8">
              <RhButton href="/docs" variant="outline" size="sm">
                Product docs
              </RhButton>
            </div>
          </aside>

          <article className="max-w-3xl min-w-0">
            <h1 className="rh-display text-4xl sm:text-5xl mb-4">
              PumpRobin Trading API
            </h1>
            <p className="text-rh-muted text-lg leading-relaxed mb-12">
              Public HTTP endpoints for listing tokens, recording trades, and reading
              platform analytics — the same surface the PumpRobin UI uses.
            </p>

            <section id="introduction" className="mb-14 scroll-mt-24">
              <h2 className="rh-display text-3xl mb-4">Introduction</h2>
              <p className="text-rh-muted leading-relaxed mb-4">
                Welcome to the PumpRobin.fun API docs for builders. Use these routes to
                index launches, mirror bonding-curve activity, or power bots and dashboards
                on Robinhood Chain.
              </p>
              <p className="text-rh-muted leading-relaxed mb-4">
                Base URL (local):{" "}
                <code className="text-rh-lime text-sm">http://localhost:3000</code>
                <br />
                Production:{" "}
                <code className="text-rh-lime text-sm">https://pumprobin.fun</code>
              </p>
              <p className="text-rh-muted leading-relaxed text-sm">
                Inspired by the structure of the{" "}
                <a
                  href="https://docs.robinhood.com/crypto/trading/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rh-lime hover:underline"
                >
                  Robinhood Crypto Trading API
                </a>{" "}
                docs — adapted for an open launchpad, not custodial brokerage trading.
              </p>
            </section>

            <section id="authentication" className="mb-14 scroll-mt-24">
              <h2 className="rh-display text-3xl mb-4">Authentication</h2>
              <p className="text-rh-muted leading-relaxed mb-4">
                Public read endpoints (<code className="text-white/90 text-sm">GET /api/tokens</code>,
                trades, stats, analytics) require no API key.
              </p>
              <p className="text-rh-muted leading-relaxed mb-4">
                Admin routes (<code className="text-white/90 text-sm">/api/admin/*</code>) use a
                password session cookie. Set{" "}
                <code className="text-white/90 text-sm">ADMIN_PASSWORD</code> and{" "}
                <code className="text-white/90 text-sm">ADMIN_SESSION_SECRET</code> in env, then
                <code className="text-white/90 text-sm"> POST /api/admin/login</code>.
              </p>
              <p className="text-rh-muted leading-relaxed text-sm">
                Unlike Robinhood Crypto&apos;s{" "}
                <code className="text-white/80">x-api-key</code> /{" "}
                <code className="text-white/80">x-signature</code> /{" "}
                <code className="text-white/80">x-timestamp</code> Ed25519 scheme, PumpRobin
                public trading reads are open; onchain settlement uses your wallet.
              </p>
            </section>

            <section id="pagination" className="mb-14 scroll-mt-24">
              <h2 className="rh-display text-3xl mb-4">Pagination</h2>
              <p className="text-rh-muted leading-relaxed mb-4">
                Robinhood Crypto APIs return cursor pages with{" "}
                <code className="text-white/90 text-sm">next</code> /{" "}
                <code className="text-white/90 text-sm">previous</code> URLs and a{" "}
                <code className="text-white/90 text-sm">results</code> array.
              </p>
              <p className="text-rh-muted leading-relaxed mb-4">
                PumpRobin currently returns full collections for tokens and trades. For large
                datasets, filter with{" "}
                <code className="text-white/90 text-sm">GET /api/trades?token=0x…</code>. Cursor
                pagination may be added later in the same{" "}
                <code className="text-white/90 text-sm">next</code> /{" "}
                <code className="text-white/90 text-sm">previous</code> style.
              </p>
              <pre className="bg-rh-raised/40 border border-rh-raised p-4 text-xs text-white/80 overflow-x-auto rounded-lg">
{`// Robinhood-style page shape (reference)
{
  "previous": null,
  "results": [ /* … */ ],
  "next": "https://api.example.com/items/?cursor=…"
}`}
              </pre>
            </section>

            <section id="rate-limiting" className="mb-14 scroll-mt-24">
              <h2 className="rh-display text-3xl mb-4">Rate limiting</h2>
              <p className="text-rh-muted leading-relaxed">
                Be a good citizen: cache <code className="text-white/90 text-sm">GET</code>{" "}
                responses, avoid tight polling loops, and prefer event-driven updates when
                indexing. Abuse may result in temporary blocks at the edge.
              </p>
            </section>

            <section id="errors" className="mb-14 scroll-mt-24">
              <h2 className="rh-display text-3xl mb-4">Error responses</h2>
              <p className="text-rh-muted leading-relaxed mb-4">
                Errors return JSON with an <code className="text-white/90 text-sm">error</code>{" "}
                string and an appropriate HTTP status (400 validation, 401 admin auth, 404
                missing resource).
              </p>
              <pre className="bg-rh-raised/40 border border-rh-raised p-4 text-xs text-white/80 overflow-x-auto rounded-lg">
{`{ "error": "name, symbol, and creator are required" }`}
              </pre>
            </section>

            <section id="endpoints" className="mb-14 scroll-mt-24">
              <h2 className="rh-display text-3xl mb-8">Endpoints</h2>
              <div className="space-y-10">
                {ENDPOINTS.map((ep) => (
                  <div key={ep.path + ep.method} className="border border-rh-raised p-6">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-rh-lime text-rh-on-lime">
                        {ep.method}
                      </span>
                      <code className="text-sm text-white/90 break-all">{ep.path}</code>
                    </div>
                    <h3 className="font-medium mb-2">{ep.title}</h3>
                    <p className="text-rh-muted text-sm leading-relaxed mb-4">{ep.body}</p>
                    <p className="text-xs text-rh-dim mb-2 uppercase tracking-wider">
                      Example body / shape
                    </p>
                    <pre className="bg-black border border-rh-raised p-4 text-xs text-white/75 overflow-x-auto rounded-lg">
                      {ep.response}
                    </pre>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-rh-raised pt-10">
              <h2 className="rh-display text-2xl mb-3">Related</h2>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/docs" className="text-rh-lime hover:underline">
                    Product FAQ →
                  </Link>
                </li>
                <li>
                  <a
                    href="https://docs.robinhood.com/chain"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rh-lime hover:underline"
                  >
                    Robinhood Chain docs →
                  </a>
                </li>
                <li>
                  <a
                    href="https://docs.robinhood.com/crypto/trading/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rh-lime hover:underline"
                  >
                    Robinhood Crypto Trading API (reference) →
                  </a>
                </li>
              </ul>
            </section>
          </article>
        </div>
      </div>
    </div>
  );
}
