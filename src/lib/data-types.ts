export interface LaunchMetadata {
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  linkedin?: string;
  github?: string;
  litepaper?: string;
  teaserVideo?: string;
  pitchDeck?: string;
  docs?: string;
  instagram?: string;
  reddit?: string;
  tiktok?: string;
  farcaster?: string;
  bannerUri?: string;
  communityCoin?: boolean;
  communityBoard?: boolean;
  instantLaunch?: boolean;
  antiSnipe?: boolean;
  maxWallet2pct?: boolean;
  customSupply?: boolean;
  supply?: number;
  decimals?: number;
  initialBuyEth?: number;
  ownershipPct?: number;
  feeSharing?: boolean;
  feeShares?: Array<{ address: string; pct: number }>;
  uniswapPool?: string;
  spotPriceEth?: number;
  liquidityEth?: number;
  pooledWeth?: number;
  pooledToken?: number;
  spotAt?: string;
  holdersCount?: number;
  athMarketCapEth?: number;
  athAt?: string;
  featured?: boolean;
  featuredUntil?: string;
  featuredPaidEth?: number;
  featuredTxHash?: string;
  deadSupply?: number;
  lpSupplyBps?: number;
  verified?: boolean;
}

export interface TokenRecord {
  address: string;
  bondingCurve: string;
  name: string;
  symbol: string;
  imageUri: string;
  description: string;
  creator: string;
  createdAt: string;
  virtualEthReserves: number;
  virtualTokenReserves: number;
  realEthReserves: number;
  realTokenReserves: number;
  graduated: boolean;
  source: "registry" | "onchain";
  txHash?: string;
  metadata?: LaunchMetadata;
}

export interface TradeRecord {
  id: string;
  tokenAddress: string;
  trader: string;
  isBuy: boolean;
  ethAmount: number;
  tokenAmount: number;
  price: number;
  feeEth: number;
  timestamp: string;
}

export interface PlatformState {
  tokens: TokenRecord[];
  trades: TradeRecord[];
  autoLaunchEnabled: boolean;
  lastAutoLaunch: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TokenData {
  address: string;
  bondingCurve: string;
  name: string;
  symbol: string;
  imageUri: string;
  description: string;
  creator: string;
  createdAt: Date;
  price: number;
  marketCap: number;
  marketCapFdv: number;
  circulatingSupply: number;
  athMarketCap: number;
  volume24h: number;
  holders: number;
  progress: number;
  graduated: boolean;
  priceChange24h: number;
  ethReserves: number;
  virtualEthReserves: number;
  virtualTokenReserves: number;
  realTokenReserves: number;
  source: "registry" | "onchain";
  txHash?: string;
  metadata?: LaunchMetadata;
}

export interface TradeData {
  id: string;
  tokenAddress: string;
  trader: string;
  isBuy: boolean;
  ethAmount: number;
  tokenAmount: number;
  price: number;
  feeEth: number;
  timestamp: Date;
}

export interface PlatformStats {
  totalTokens: number;
  totalVolume: number;
  totalTrades: number;
  activeTraders: number;
  graduatedTokens: number;
  volume24h: number;
  feesCollected: number;
  avgGraduationTime: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  name: string;
  symbol: string;
  imageUri: string;
  marketCap: number;
  volume24h: number;
  holders: number;
  progress: number;
}
