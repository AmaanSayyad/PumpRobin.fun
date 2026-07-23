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

/** Receives creation fees + platform trade-fee share */
export const FEE_COLLECTOR =
  "0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9" as const;

/** Official Uniswap v3 deployments on Robinhood Chain (4663) */
export const UNISWAP_V3 = {
  factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
  positionManager: "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3",
  swapRouter02: "0xCaf681a66D020601342297493863E78C959E5cb2",
  /** Robinhood has UR 2.1.1 only — required for Trading API swaps */
  universalRouter: "0x8876789976decbfcbbbe364623c63652db8c0904",
  /** Matches VLAD / CASHCAT-style Robinhood memecoin pools (~95% of meme TVL) */
  poolFee: 10_000, // 1%
} as const;

export const CHAIN_CONFIG = {
  creationFee: "0.0005",
  /**
   * Network gas headroom for createToken on Robinhood (~2M gas ≈ 0.00024 ETH today).
   * Kept slightly above live estimateGas so the launch banner isn't scary vs bags.fm.
   */
  launchGasBufferEth: "0.00035",
  /** ~8 ETH ≈ $30k LP at graduate — clears DEX Screener minLiq≈$25k filters */
  graduationThreshold: 8, // ETH
  /** Bonding-curve trade fees (of trade volume) */
  creatorFeeBps: 100, // 1% → creator wallet on each trade
  platformFeeBps: 30, // 0.3% → platform fee collector on each trade
  /** Total taken from buys/sells before curve math (= creator + platform) */
  tradeFeeBps: 130, // 1.3%
  totalSupply: 1_000_000_000,
  decimals: 18,
  feeCollector: FEE_COLLECTOR,
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

/** Ownership quick-select presets (bags.fm-style) */
export const OWNERSHIP_PRESETS = [1, 10, 30, 50, 80] as const;
