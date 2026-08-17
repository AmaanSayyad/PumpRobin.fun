// Contract ABIs are generated from contracts/*.sol — see scripts/gen-abis.mjs.
export {
  PUMP_ROBIN_FACTORY_ABI,
  BONDING_CURVE_ABI,
  PUMP_ROBIN_TOKEN_ABI,
  PUMP_ROBIN_HOOK_ABI,
  PUMP_ROBIN_FEE_SHARE_ABI,
  PUMP_ROBIN_DEPLOYER_ABI,
} from "./abis.generated";

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
const address = (value?: string): `0x${string}` | undefined =>
  value && /^0x[a-fA-F0-9]{40}$/.test(value) ? (value as `0x${string}`) : undefined;

export const CONTRACTS = {
  factory: address(process.env.NEXT_PUBLIC_FACTORY_ADDRESS?.trim()),
  hook: address(process.env.NEXT_PUBLIC_HOOK_ADDRESS?.trim()),
  deployer: address(process.env.NEXT_PUBLIC_DEPLOYER_ADDRESS?.trim()),
  /**
   * @deprecated Launches are plain ERC-20s now — fees are taken by the v4 hook,
   * not on transfer — so sells no longer need a fee-on-transfer router. Kept
   * only so pre-migration tokens stay tradable.
   */
  fotSeller:
    address(process.env.NEXT_PUBLIC_FOT_SELLER_ADDRESS?.trim()) ??
    ("0x6b9C32318F82FD220464a2d53D9063e51e629A3F" as `0x${string}`),
} as const;
