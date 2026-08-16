import { CHAIN_CONFIG } from "./chain";

/** Fee shares of each taxed buy (percent of tokens transferred pool → wallet). */
export const CREATOR_FEE_PCT = CHAIN_CONFIG.creatorFeeBps / 100;
export const PLATFORM_FEE_PCT = CHAIN_CONFIG.platformFeeBps / 100;
export const TRADE_FEE_PCT = CHAIN_CONFIG.tradeFeeBps / 100;

export const LAUNCH_MECHANICS = [
  {
    title: "On-chain create + fee",
    body: `Launch is a signed PumpRobinFactory.createToken transaction. It must pay ${CHAIN_CONFIG.creationFee} ETH creation fee plus at least ${CHAIN_CONFIG.minInstantSeedEth} ETH LP seed in that same tx. The API only indexes a confirmed factory receipt — it cannot mint a token from unsigned JSON.`,
  },
  {
    title: "Instant Uniswap V3 LP",
    body: `Every new launch seeds a Uniswap V3 TOKEN/WETH pool at the 1% fee tier immediately. ~${CHAIN_CONFIG.instantLpEthPct}% of the seed locks as LP; the rest buys tokens for the creator. Excess supply is burned. Trading is live on DEX Screener / GMGN from block one.`,
  },
  {
    title: "Locked liquidity",
    body: "The Uniswap V3 LP NFT is sent to the dead address so principal cannot be withdrawn. Verify the pool and lock on Blockscout and DEX Screener.",
  },
  {
    title: "2% buy tax",
    body: `Buys (pool → wallet) take a hardcoded ${TRADE_FEE_PCT}% token tax — ${CREATOR_FEE_PCT}% to the creator wallet and ${PLATFORM_FEE_PCT}% to PumpRobin. No owner, pause, blacklist, or fee setter.`,
  },
  {
    title: "Dev buy / ownership",
    body: "Raise the LP seed above the minimum to buy a larger first position in the same create transaction. Ownership presets on the launch form size that seed.",
  },
  {
    title: "Socials & metadata",
    body: "Add logo, name, ticker, description, website, X, Telegram, and an optional banner. They show on Explore and the token page so traders know what they're looking at.",
  },
] as const;

export const CREATOR_FEE_CARDS = [
  {
    value: `${CREATOR_FEE_PCT}%`,
    label: "Creator share",
    detail: "Of each taxed buy (pool → wallet)",
  },
  {
    value: `${PLATFORM_FEE_PCT}%`,
    label: "Platform share",
    detail: "PumpRobin fee on each taxed buy",
  },
  {
    value: `${TRADE_FEE_PCT}%`,
    label: "Total buy tax",
    detail: "Hardcoded on the token contract",
  },
] as const;

export const CREATOR_FEES_INTRO = `Each Uniswap buy takes a ${TRADE_FEE_PCT}% token tax — ${CREATOR_FEE_PCT}% to the creator wallet and ${PLATFORM_FEE_PCT}% to PumpRobin. The tax is a contract constant (no admin).`;

export const CREATOR_FEES_BODY = `PumpRobin also earns the ${CHAIN_CONFIG.creationFee} ETH creation fee, paid to the platform collector (${CHAIN_CONFIG.feeCollector}) inside createToken. Uniswap's 1% pool fee accrues to the locked LP NFT.`;

export const FAIR_BY_DESIGN = [
  {
    title: "Fee paid on-chain",
    body: `The ${CHAIN_CONFIG.creationFee} ETH creation fee is collected by the factory in the same signed transaction that deploys the token. Unsigned API posts cannot register a launch.`,
  },
  {
    title: "Locked Uniswap LP",
    body: "Every launch seeds a Uniswap V3 1% TOKEN/WETH pool and sends the LP NFT to the dead address — principal is not withdrawable.",
  },
  {
    title: "Hardcoded buy tax",
    body: `Buys take ${TRADE_FEE_PCT}% total — ${CREATOR_FEE_PCT}% creator + ${PLATFORM_FEE_PCT}% platform. No owner, pause, blacklist, or fee switches.`,
  },
  {
    title: "Launch options recorded",
    body: "Dev buy, socials, and optional flags are stored with the token so the UI can surface intent clearly.",
  },
] as const;
