import { defineChain } from "viem";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
    public: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.chain.robinhood.com"] },
    public: { http: ["https://rpc.testnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout Testnet",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  testnet: true,
});

export const WETH_ADDRESS = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as const;

/** Receives creation fees + platform trade-fee share (1%) */
export const FEE_COLLECTOR =
  "0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9" as const;

/** @deprecated Legacy address — v2 factory pays creator fees to the token creator wallet */
export const CREATOR_FEE_COLLECTOR =
  "0x4654FE1e59547372Db57e9F6865aa7aC3A0C77a3" as const;

/** Official Uniswap v3 + v4 deployments on Robinhood Chain (4663) */
export const UNISWAP_V3 = {
  factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
  positionManager: "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3",
  swapRouter02: "0xCaf681a66D020601342297493863E78C959E5cb2",
  /** Robinhood has UR 2.1.1 only — required for Trading API swaps */
  universalRouter: "0x8876789976decbfcbbbe364623c63652db8c0904",
  poolFee: 10_000, // 1% — legacy V3 launches
} as const;

export const UNISWAP_V4 = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
  stateView: "0xF3334192D15450CdD385c8B70e03f9A6bD9E673b",
  quoter: "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94",
  /** Dynamic-fee flag — PumpRobinHook takes 2% on the WETH leg */
  poolFee: 0x800000,
  tickSpacing: 60,
} as const;

export const CHAIN_CONFIG = {
  /** ~$10 platform fee at ~$2.5k ETH */
  creationFee: "0.004",
  creationFeeUsdHint: 10,
  /** Fallback ETH/USD when price feed is unavailable */
  ethUsdFallback: 2500,
  /**
   * Network gas headroom for createToken on Robinhood (~2M gas ≈ 0.00024 ETH today).
   * Kept slightly above live estimateGas so the launch banner isn't scary vs bags.fm.
   */
  launchGasBufferEth: "0.00035",
  /**
   * Paid Explore feature boost (~$100 at ~$1.8k ETH). Sent to feeCollector;
   * pins the coin in Featured for `featureBoostDays`.
   */
  featureBoostEth: "0.055",
  featureBoostUsdHint: 100,
  featureBoostDays: 7,
  /**
   * Telegram/Discord alert subscription (~$50). Manual fulfillment by team.
   * Paid to feeCollector; request stored for ops to activate.
   */
  alertsSubEth: "0.028",
  alertsSubUsdHint: 50,
  alertsSubDays: 30,
  /** ETH raised on the bonding curve before auto-graduation to Uniswap V3 */
  graduationThreshold: 8,
  /** Min ETH seed for instant Uniswap launch (~$250 at $2.5k ETH). */
  minInstantSeedEth: "0.1",
  minInstantSeedUsdHint: 250,
  /** Target starting FDV — contract puts fewer tokens in LP when seed is small */
  instantTargetFdvEth: 2,
  instantMinLpSupplyBps: 5,
  instantMaxLpSupplyBps: 10_000,
  /** @deprecated Use dynamic lpSupplyBps — max cap only */
  instantLpSupplyPct: 100,
  /** % of seed ETH that locks as LP when the creator also takes a first buy */
  instantLpEthPct: 70,
  /** Bonding-curve + DEX trade fees (1% creator + 1% platform on buys) */
  creatorFeeBps: 100,
  platformFeeBps: 100,
  tradeFeeBps: 200, // 2%
  /** Extra cut when swapping non-PumpRobin tokens on this site */
  externalSwapFeeBps: 1000, // 10%
  /** ~$30 at $2.5k ETH — auto-payout / claim threshold per fee bucket */
  feeClaimThresholdEth: "0.012",
  feeClaimThresholdUsdHint: 30,
  totalSupply: 1_000_000_000,
  decimals: 18,
  feeCollector: FEE_COLLECTOR,
  creatorFeeCollector: CREATOR_FEE_COLLECTOR,
  maxFeeShareRecipients: 100,
  uniswapPoolFee: UNISWAP_V3.poolFee,
} as const;

export function dexScreenerPoolUrl(poolAddress: string): string {
  return `https://dexscreener.com/robinhood/${poolAddress}`;
}

const EXPLORER = robinhoodChain.blockExplorers.default.url;

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}

export function explorerTxUrl(txHash: string): string {
  return `${EXPLORER}/tx/${txHash}`;
}

/** Ownership quick-select at launch (ETH cost scales with %). */
export const OWNERSHIP_PRESETS = [1, 10, 20, 30] as const;
