import { CHAIN_CONFIG } from "./chain";

/** Creator share of each bonding-curve trade (percent of trade volume). bags.fm-style: full fee. */
export const CREATOR_FEE_PCT = CHAIN_CONFIG.platformFeeBps / 100;
export const PLATFORM_FEE_PCT = 0;
export const TRADE_FEE_PCT = CHAIN_CONFIG.platformFeeBps / 100;

export const LAUNCH_MECHANICS = [
  {
    title: "Dev buy (first buy)",
    body: "Optionally buy your own coin inside the launch flow so you start with a real position — and can be the curve's first buyer before anyone else.",
  },
  {
    title: "Max wallet (2%)",
    body: "Cap each wallet at roughly 2% of supply early on so a single buyer cannot vacuum the float. Toggle it on the launch form; on-chain enforcement ships with factory hardening.",
  },
  {
    title: "Anti-snipe",
    body: "A short launch window aimed at bots trying to front-run real buyers. Mark it on create so traders know the intent; contract-level fee stepping is on the roadmap.",
  },
  {
    title: "Custom supply",
    body: "Standard is 1 billion. Turn on custom supply to set any amount from 1 to 1Q — virtual reserves scale so curve economics stay comparable.",
  },
  {
    title: "Socials & metadata",
    body: "Add logo, name, ticker, description, website, X, Telegram, and an optional banner. They show on explore and the token page so traders know what they're looking at.",
  },
  {
    title: "Bonding-curve liquidity",
    body: "Trading starts immediately on the virtual AMM — no manual pool setup. Real DEX liquidity is added at graduation.",
  },
] as const;

export const CREATOR_FEE_CARDS = [
  {
    value: `${CREATOR_FEE_PCT}%`,
    label: "Creator share",
    detail: "Of every bonding-curve trade",
  },
  {
    value: "On trade",
    label: "Payout today",
    detail: "Sent to creator on deployed contracts",
  },
  {
    value: "Claim UX",
    label: "Coming next",
    detail: "Dashboard claim + payout redirect",
  },
] as const;

export const CREATOR_FEES_INTRO = `Launching isn't only about going live — creators earn ${CREATOR_FEE_PCT}% of every buy and sell on their bonding curve (bags.fm-style: the full trade fee goes to the creator).`;

export const CREATOR_FEES_BODY = `On deployed BondingCurve contracts, the creator fee is paid out on each trade. Fee-share splits (metadata), payout redirect, and post-graduation Uniswap LP fees are on the roadmap — see Roadmap for timing. Platform revenue is the ${CHAIN_CONFIG.creationFee} ETH creation fee.`;

export const FAIR_BY_DESIGN = [
  {
    title: "Transparent curve math",
    body: "Price follows constant-product virtual reserves (x·y = k). Progress to graduation is visible on every card and token page.",
  },
  {
    title: "Creator fees on-chain",
    body: `The ${TRADE_FEE_PCT}% trade fee goes entirely to the creator (bags.fm-style). What we document is what the contract does once the factory is live.`,
  },
  {
    title: "Launch options recorded",
    body: "Dev buy, anti-snipe, max wallet, community flags, and socials are stored with the token so the UI can surface intent clearly.",
  },
  {
    title: "Locked LP at graduation",
    body: "After graduation: Uniswap V3 1% TOKEN/WETH pool with permanently locked LP NFT — principal not withdrawable. Same venue as top Robinhood memes on DEX Screener.",
  },
] as const;
