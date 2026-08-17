import { CHAIN_CONFIG } from "./chain";

/** Fee shares of each taxed buy (percent of tokens transferred pool → wallet). */
export const CREATOR_FEE_PCT = CHAIN_CONFIG.creatorFeeBps / 100;
export const PLATFORM_FEE_PCT = CHAIN_CONFIG.platformFeeBps / 100;
export const TRADE_FEE_PCT = CHAIN_CONFIG.tradeFeeBps / 100;

export const LAUNCH_MECHANICS = [
  {
    title: "On-chain create + fee",
    body: `Launch is a signed PumpRobinFactory.createToken transaction paying the ${CHAIN_CONFIG.creationFee} ETH creation fee. No LP seed is required. The API only indexes a confirmed factory receipt — it cannot mint a token from unsigned JSON.`,
  },
  {
    title: "Bonding curve first",
    body: `The whole ${CHAIN_CONFIG.totalSupply.toLocaleString()} supply goes to the curve, which sells ${CHAIN_CONFIG.curveSupply.toLocaleString()} of it against virtual reserves. Coins open at ${CHAIN_CONFIG.launchFdvEth} ETH market cap, so there is no price for the creator to set and nothing to seed.`,
  },
  {
    title: "Graduation to Uniswap v4",
    body: `At ${CHAIN_CONFIG.graduationThreshold} ETH raised the curve migrates in the same transaction as the crossing buy: the untouched ${CHAIN_CONFIG.poolSupply.toLocaleString()} tokens and the full raise become a Uniswap v4 position at about ${CHAIN_CONFIG.graduationFdvEth} ETH market cap.`,
  },
  {
    title: "Locked liquidity",
    body: "Liquidity is minted full-range and the hook reverts every removal attempt, so principal can never be withdrawn — there is no LP NFT to transfer or unlock. Verify the pool on Blockscout and DEX Screener.",
  },
  {
    title: `${TRADE_FEE_PCT}% on every buy and sell`,
    body: `The v4 hook takes ${TRADE_FEE_PCT}% of the ETH leg of every swap — ${CREATOR_FEE_PCT}% to the creator and ${PLATFORM_FEE_PCT}% to PumpRobin — no matter which router or aggregator sends it. The token itself is a plain ERC-20 with no transfer tax, owner, pause, blacklist or fee setter.`,
  },
  {
    title: "Dev buy / ownership",
    body: "Send ETH above the creation fee and the factory spends it on the curve for you in the same transaction, before anyone else can trade. Ownership presets on the launch form size that buy.",
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
