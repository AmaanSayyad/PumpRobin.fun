import { CHAIN_CONFIG } from "./chain";

/** Fee shares of each bonding-curve trade (percent of trade volume). */
export const CREATOR_FEE_PCT = CHAIN_CONFIG.creatorFeeBps / 100;
export const PLATFORM_FEE_PCT = CHAIN_CONFIG.platformFeeBps / 100;
export const TRADE_FEE_PCT = CHAIN_CONFIG.tradeFeeBps / 100;

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
    body: `Optional. When on, buys from the Uniswap pool start at an 80% fee that linearly decays to 0% over 10 seconds (Bankr-style). Swaps still succeed on Uniswap/GMGN — snipers just overpay. Your create-time first buy is exempt.`,
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
    value: `${PLATFORM_FEE_PCT}%`,
    label: "Platform share",
    detail: "PumpRobin fee on every trade",
  },
  {
    value: `${TRADE_FEE_PCT}%`,
    label: "Total trade fee",
    detail: "Taken on each buy & sell",
  },
] as const;

export const CREATOR_FEES_INTRO = `Every bonding-curve trade takes ${TRADE_FEE_PCT}% total — ${CREATOR_FEE_PCT}% to the creator fee collector and ${PLATFORM_FEE_PCT}% to PumpRobin's platform collector.`;

export const CREATOR_FEES_BODY = `On deployed BondingCurve contracts, the ${CREATOR_FEE_PCT}% creator-fee share is paid instantly to ${CHAIN_CONFIG.creatorFeeCollector} on every buy and sell. PumpRobin's ${PLATFORM_FEE_PCT}% goes to the platform collector (${CHAIN_CONFIG.feeCollector}) on every trade. Fee-share splits among multiple wallets and post-graduation Uniswap LP fee collection are on the roadmap. Platform also earns the ${CHAIN_CONFIG.creationFee} ETH creation fee.`;

export const FAIR_BY_DESIGN = [
  {
    title: "Transparent curve math",
    body: "Price follows constant-product virtual reserves (x·y = k). Progress to graduation is visible on every card and token page.",
  },
  {
    title: "Creator + platform fees on-chain",
    body: `Every bonding-curve trade takes ${TRADE_FEE_PCT}% total — ${CREATOR_FEE_PCT}% to the creator fee collector and ${PLATFORM_FEE_PCT}% to PumpRobin, both paid instantly.`,
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
