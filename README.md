# PumpRobin.fun

The premier token launchpad on **Robinhood Chain**. Launch, trade, and graduate memecoins with bonding curve mechanics — inspired by pump.fun, built for the Robinhood ecosystem.

![Robinhood Chain](public/brand/Robinhood_Icon_6-1cc454d4-ff58-49bf-8ff4-daf4415c49e7.png)

## Features

- **One-click token launch** — Create ERC-20 tokens for 0.0005 ETH
- **Bonding curve trading** — Constant-product AMM with instant price discovery
- **Graduation to DEX** — Auto-migrate to Uniswap V3 (1% TOKEN/WETH, locked LP) at 5 ETH
- **Motion-rich UI** — Framer Motion, GSAP, Three.js, particle effects
- **Admin dashboard** — Platform stats, auto-launch controls, hourly analytics
- **Multi-page app** — Explore, Launch, Portfolio, Leaderboard, Analytics, Docs

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with 3D hero, live ticker, trending tokens |
| `/explore` | Browse, search, and filter all tokens |
| `/launch` | Create a new token with image upload |
| `/token/[address]` | Token detail with chart, trades, buy/sell panel |
| `/portfolio` | Wallet holdings and created tokens |
| `/leaderboard` | Top tokens by market cap |
| `/analytics` | Platform-wide charts and metrics |
| `/admin` | Admin dashboard with stats and auto-launch config |
| `/docs` | Documentation and FAQ |

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS 4
- **Motion**: Framer Motion, GSAP, Lenis, Three.js, tsparticles
- **Web3**: Wagmi, Viem, RainbowKit
- **Charts**: Recharts
- **Contracts**: Solidity 0.8.20, Hardhat, OpenZeppelin

## Robinhood Chain

| Property | Mainnet | Testnet |
|----------|---------|---------|
| Chain ID | 4663 | 46630 |
| RPC | `https://rpc.mainnet.chain.robinhood.com` | `https://rpc.testnet.chain.robinhood.com` |
| Explorer | robinhoodchain.blockscout.com | explorer.testnet.chain.robinhood.com |
| Gas | ETH | ETH |

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy Contracts

```bash
# Compile
npm run compile

# Deploy to testnet
npm run deploy:testnet

# Set the factory address in .env.local
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
```

## Auto-Launch (Future Work)

A cron endpoint at `/api/cron/auto-launch` is configured to create tokens every 5 minutes. Enable via the admin dashboard once contracts are deployed.

Requirements:
1. Deploy `PumpRobinFactory` to Robinhood Chain
2. Set `NEXT_PUBLIC_FACTORY_ADDRESS` and `FACTORY_PRIVATE_KEY`
3. Enable in admin dashboard
4. Deploy to Vercel (cron configured in `vercel.json`)

## Brand

Uses official Robinhood brand colors:
- **Electric Lime**: `#CCFF00`
- **Eternity**: `#1C180D`
- **White**: `#FFFFFF`

Brand assets sourced from [brandfetch.com/robinhood.com](https://brandfetch.com/robinhood.com).

## Market Research

Built after analyzing leading launchpads:

| Platform | Chain | Model |
|----------|-------|-------|
| pump.fun | Solana | Bonding curve → PumpSwap graduation |
| NOXA Fun | Robinhood | Instant Uniswap V3 + graduation milestones |
| hood.fun | Robinhood | Bonding curve backed by stock perps |
| Openfair | Robinhood | Bonding curve OR instant V3 listing |

PumpRobin.fun combines the pump.fun bonding curve UX with Robinhood Chain's EVM compatibility and graduation mechanics.

## License

MIT — Not affiliated with Robinhood Markets, Inc.
