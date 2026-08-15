export const PUMP_ROBIN_FACTORY_ABI = [
  {
    type: "event",
    name: "TokenCreated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "bondingCurve", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "imageUri", type: "string", indexed: false },
    ],
  },
  {
    type: "function",
    name: "createToken",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "imageUri", type: "string" },
      { name: "description", type: "string" },
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "bondingCurve", type: "address" },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "creationFee",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAllTokens",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const BONDING_CURVE_ABI = [
  {
    type: "event",
    name: "Trade",
    inputs: [
      { name: "trader", type: "address", indexed: true },
      { name: "isBuy", type: "bool", indexed: false },
      { name: "ethAmount", type: "uint256", indexed: false },
      { name: "tokenAmount", type: "uint256", indexed: false },
      { name: "newPrice", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Graduated",
    inputs: [
      { name: "pool", type: "address", indexed: true },
      { name: "ethLiquidity", type: "uint256", indexed: false },
      { name: "tokenLiquidity", type: "uint256", indexed: false },
      { name: "lpTokenId", type: "uint256", indexed: false },
      { name: "lpLockedTo", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FeesDistributed",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "creatorFee", type: "uint256", indexed: false },
      { name: "platform", type: "address", indexed: true },
      { name: "platformFee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CreatorFeesClaimed",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "seedInstantUniswap",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "minTokensOut", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "event",
    name: "InstantSeeded",
    inputs: [
      { name: "pool", type: "address", indexed: true },
      { name: "lpEth", type: "uint256", indexed: false },
      { name: "buyEth", type: "uint256", indexed: false },
      { name: "lpSupplyBps", type: "uint256", indexed: false },
      { name: "tokensInLp", type: "uint256", indexed: false },
      { name: "estimatedFdvEth", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "previewInstantLaunch",
    inputs: [{ name: "seedEth", type: "uint256" }],
    outputs: [
      { name: "lpEth", type: "uint256" },
      { name: "buyEth", type: "uint256" },
      { name: "lpSupplyBps", type: "uint256" },
      { name: "estimatedFdvEth", type: "uint256" },
    ],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "TARGET_START_FDV_ETH",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    inputs: [{ name: "minTokens", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "buyFor",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "minTokens", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "sell",
    inputs: [
      { name: "tokenAmount", type: "uint256" },
      { name: "minEth", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getPrice",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getProgress",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "virtualEthReserves",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "virtualTokenReserves",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "realEthReserves",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "realTokenReserves",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "graduated",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "uniswapPool",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lpTokenId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "token",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "creator",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "buyOnUniswap",
    inputs: [{ name: "minTokensOut", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "sellOnUniswap",
    inputs: [
      { name: "tokenAmount", type: "uint256" },
      { name: "minEthOut", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getPendingFees",
    inputs: [],
    outputs: [
      { name: "creatorEth", type: "uint256" },
      { name: "platformEth", type: "uint256" },
      { name: "creatorTokens", type: "uint256" },
      { name: "platformTokens", type: "uint256" },
      { name: "claimThreshold", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimCreatorFees",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
    {
      type: "function",
      name: "claimPlatformFees",
      inputs: [],
      outputs: [],
      stateMutability: "nonpayable",
    },
  {
    type: "function",
    name: "FEE_CLAIM_THRESHOLD",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "FeesAccumulated",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "creatorFee", type: "uint256", indexed: false },
      { name: "platform", type: "address", indexed: true },
      { name: "platformFee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "LP_LOCK_RECIPIENT",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

export const PUMP_ROBIN_TOKEN_ABI = [
  {
    type: "function",
    name: "FEE_BPS",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const UNISWAP_V3_FACTORY_ABI = [
  {
    type: "function",
    name: "getPool",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
    stateMutability: "view",
  },
] as const;

/** Minimal Uniswap V3 pool surface for spot price + token order */
export const UNISWAP_V3_POOL_ABI = [
  {
    type: "function",
    name: "token0",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "token1",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "slot0",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Swap",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount0", type: "int256", indexed: false },
      { name: "amount1", type: "int256", indexed: false },
      { name: "sqrtPriceX96", type: "uint160", indexed: false },
      { name: "liquidity", type: "uint128", indexed: false },
      { name: "tick", type: "int24", indexed: false },
    ],
  },
] as const;

export const FOT_UNISWAP_SELLER_ABI = [
  {
    type: "function",
    name: "sellTokenForEth",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokenAmount", type: "uint256" },
      { name: "minEthOut", type: "uint256" },
    ],
    outputs: [{ name: "ethOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Sold",
    inputs: [
      { name: "trader", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "tokensIn", type: "uint256", indexed: false },
      { name: "tokensSwapped", type: "uint256", indexed: false },
      { name: "ethOut", type: "uint256", indexed: false },
    ],
  },
] as const;

// Set after deploy: NEXT_PUBLIC_FACTORY_ADDRESS in .env.local
const factoryEnv = process.env.NEXT_PUBLIC_FACTORY_ADDRESS?.trim();
const fotSellerEnv = process.env.NEXT_PUBLIC_FOT_SELLER_ADDRESS?.trim();

export const CONTRACTS = {
  factory:
    factoryEnv && /^0x[a-fA-F0-9]{40}$/.test(factoryEnv)
      ? (factoryEnv as `0x${string}`)
      : undefined,
  fotSeller:
    fotSellerEnv && /^0x[a-fA-F0-9]{40}$/.test(fotSellerEnv)
      ? (fotSellerEnv as `0x${string}`)
      : undefined,
} as const;
