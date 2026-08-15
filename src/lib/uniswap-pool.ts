import { formatEther, type Address, type Hash } from "viem";
import { ERC20_ABI, UNISWAP_V3_POOL_ABI } from "@/lib/contracts";
import { WETH_ADDRESS } from "@/lib/chain";
import { getRobinhoodPublicClient } from "@/lib/onchain-curve";
import type { TradeRecord } from "@/lib/data-types";

export interface UniswapPoolSpot {
  pool: string;
  priceEth: number;
  pooledWeth: number;
  pooledToken: number;
  /** Approximate TVL in ETH (2 × pooled WETH for 50/50-ish pools) */
  liquidityEth: number;
}

export interface UniswapSwapTrade {
  txHash: Hash;
  logIndex: number;
  blockNumber: bigint;
  trader: Address;
  isBuy: boolean;
  ethAmount: number;
  tokenAmount: number;
  price: number;
  timestamp: string;
}

/**
 * ETH per whole token from Uniswap V3 slot0 (both sides 18 decimals).
 */
function ethPerTokenFromSqrtPrice(
  sqrtPriceX96: bigint,
  tokenIsToken0: boolean
): number {
  if (sqrtPriceX96 === BigInt(0)) return 0;
  const Q192 = BigInt(2) ** BigInt(192);
  const SCALE = BigInt(10) ** BigInt(18);
  if (tokenIsToken0) {
    const scaled = (sqrtPriceX96 * sqrtPriceX96 * SCALE) / Q192;
    return Number(scaled) / 1e18;
  }
  const scaled = (Q192 * SCALE) / (sqrtPriceX96 * sqrtPriceX96);
  return Number(scaled) / 1e18;
}

function absBig(n: bigint): bigint {
  return n < BigInt(0) ? -n : n;
}

/** Live Uniswap V3 TOKEN/WETH spot + pool balances (DEX Screener-style). */
export async function readUniswapPoolSpot(
  pool: Address,
  token: Address
): Promise<UniswapPoolSpot> {
  const client = getRobinhoodPublicClient();
  const weth = WETH_ADDRESS as Address;

  const [token0, token1, slot0, wethBal, tokenBal] = await Promise.all([
    client.readContract({
      address: pool,
      abi: UNISWAP_V3_POOL_ABI,
      functionName: "token0",
    }),
    client.readContract({
      address: pool,
      abi: UNISWAP_V3_POOL_ABI,
      functionName: "token1",
    }),
    client.readContract({
      address: pool,
      abi: UNISWAP_V3_POOL_ABI,
      functionName: "slot0",
    }),
    client.readContract({
      address: weth,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [pool],
    }),
    client.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [pool],
    }),
  ]);

  const t0 = (token0 as string).toLowerCase();
  const tokenLc = token.toLowerCase();
  const tokenIsToken0 = t0 === tokenLc;
  const otherIsWeth =
    (tokenIsToken0
      ? (token1 as string).toLowerCase()
      : t0) === weth.toLowerCase();

  const pooledWeth = Number(formatEther(wethBal as bigint));
  const pooledToken = Number(formatEther(tokenBal as bigint));
  const fromReserves =
    pooledToken > 0 && otherIsWeth ? pooledWeth / pooledToken : 0;

  const sqrtPriceX96 = (slot0 as readonly [bigint, ...unknown[]])[0];
  const fromSlot =
    otherIsWeth && sqrtPriceX96 > BigInt(0)
      ? ethPerTokenFromSqrtPrice(sqrtPriceX96, tokenIsToken0)
      : 0;

  const priceEth =
    fromSlot > 0 && fromReserves > 0
      ? (() => {
          const liq = pooledWeth * 2;
          const ratio = fromSlot / fromReserves;
          // Micro-pools: slot0 tick is easy to spike — trust reserve ratio
          if (liq < 0.05 || ratio > 3 || ratio < 1 / 3) return fromReserves;
          return fromSlot;
        })()
      : fromSlot > 0 && Number.isFinite(fromSlot)
        ? fromSlot
        : fromReserves;

  return {
    pool: pool.toLowerCase(),
    priceEth: Number.isFinite(priceEth) ? priceEth : 0,
    pooledWeth,
    pooledToken,
    liquidityEth: pooledWeth * 2,
  };
}

/**
 * Index Uniswap V3 Swap events as PumpRobin trades.
 * Trader = tx.from (EOA that initiated), not the router recipient.
 */
export async function fetchUniswapPoolSwaps(input: {
  pool: Address;
  token: Address;
  lookbackBlocks?: number;
}): Promise<UniswapSwapTrade[]> {
  const client = getRobinhoodPublicClient();
  const lookback = BigInt(input.lookbackBlocks ?? 100_000);

  const [token0, latest] = await Promise.all([
    client.readContract({
      address: input.pool,
      abi: UNISWAP_V3_POOL_ABI,
      functionName: "token0",
    }),
    client.getBlockNumber(),
  ]);

  const tokenIsToken0 =
    (token0 as string).toLowerCase() === input.token.toLowerCase();
  const fromBlock = latest > lookback ? latest - lookback : BigInt(0);

  const logs = await client.getLogs({
    address: input.pool,
    event: {
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
    fromBlock,
    toBlock: latest,
  });

  if (logs.length === 0) return [];

  const uniqueTx = [...new Set(logs.map((l) => l.transactionHash).filter(Boolean))] as Hash[];
  const txFrom = new Map<string, Address>();
  await Promise.all(
    uniqueTx.map(async (hash) => {
      try {
        const tx = await client.getTransaction({ hash });
        txFrom.set(hash.toLowerCase(), tx.from);
      } catch {
        /* skip */
      }
    })
  );

  const blockNums = [
    ...new Set(
      logs
        .map((l) => l.blockNumber)
        .filter((b): b is bigint => b != null)
    ),
  ];
  const blockTs = new Map<string, number>();
  await Promise.all(
    blockNums.map(async (bn) => {
      try {
        const b = await client.getBlock({ blockNumber: bn });
        blockTs.set(bn.toString(), Number(b.timestamp) * 1000);
      } catch {
        /* skip */
      }
    })
  );

  const out: UniswapSwapTrade[] = [];

  for (const log of logs) {
    const amount0 = log.args.amount0 as bigint | undefined;
    const amount1 = log.args.amount1 as bigint | undefined;
    if (amount0 == null || amount1 == null || !log.transactionHash) continue;

    // Pool deltas: positive = into pool, negative = out of pool
    let isBuy: boolean;
    let ethWei: bigint;
    let tokenWei: bigint;
    if (tokenIsToken0) {
      // token0=TOKEN, token1=WETH
      isBuy = amount0 < BigInt(0);
      tokenWei = absBig(amount0);
      ethWei = absBig(amount1);
    } else {
      // token0=WETH, token1=TOKEN
      isBuy = amount1 < BigInt(0);
      tokenWei = absBig(amount1);
      ethWei = absBig(amount0);
    }

    const ethAmount = Number(formatEther(ethWei));
    const tokenAmount = Number(formatEther(tokenWei));
    if (!(ethAmount > 0) || !(tokenAmount > 0)) continue;

    const recipient = log.args.recipient as Address | undefined;
    const trader =
      txFrom.get(log.transactionHash.toLowerCase()) || recipient;
    if (!trader) continue;

    const tsMs =
      (log.blockNumber != null
        ? blockTs.get(log.blockNumber.toString())
        : undefined) ?? Date.now();

    out.push({
      txHash: log.transactionHash,
      logIndex: Number(log.logIndex ?? 0),
      blockNumber: log.blockNumber ?? BigInt(0),
      trader,
      isBuy,
      ethAmount,
      tokenAmount,
      price: ethAmount / tokenAmount,
      timestamp: new Date(tsMs).toISOString(),
    });
  }

  return out;
}

/** Convert indexed swaps into TradeRecords for the registry. */
export function swapsToTradeRecords(
  tokenAddress: string,
  swaps: UniswapSwapTrade[]
): TradeRecord[] {
  const addr = tokenAddress.toLowerCase();
  return swaps.map((s) => ({
    id: `${addr}-${s.txHash.toLowerCase()}-${s.logIndex}`,
    tokenAddress: addr,
    trader: s.trader.toLowerCase(),
    isBuy: s.isBuy,
    ethAmount: s.ethAmount,
    tokenAmount: s.tokenAmount,
    price: s.price,
    feeEth: 0,
    timestamp: s.timestamp,
  }));
}

const BLOCKSCOUT = "https://robinhoodchain.blockscout.com/api/v2";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dead";

export type OnChainHolderRow = {
  address: string;
  balance: number;
  pct: number;
  label?: string;
  isCurve?: boolean;
  isLp?: boolean;
  isDev?: boolean;
  isBurned?: boolean;
};

/** Best-effort holder count from Blockscout (graduated tokens). */
export async function fetchTokenHoldersCount(
  token: string
): Promise<number | null> {
  try {
    const res = await fetch(`${BLOCKSCOUT}/tokens/${token}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { holders_count?: string | number };
    const n = Number(data.holders_count);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

/** Top holders from Blockscout — works for any ERC-20, including market tokens. */
export async function fetchTokenTopHolders(
  token: string,
  limit: number,
  ctx: {
    supply: number;
    creator?: string;
    bondingCurve?: string | null;
    uniswapPool?: string | null;
  }
): Promise<OnChainHolderRow[]> {
  const creator = ctx.creator?.toLowerCase();
  const curve = ctx.bondingCurve?.toLowerCase();
  const pool = ctx.uniswapPool?.toLowerCase();
  const dead = DEAD_ADDRESS;

  try {
    const [metaRes, holdRes] = await Promise.all([
      fetch(`${BLOCKSCOUT}/tokens/${token}`, {
        next: { revalidate: 60 },
        headers: { accept: "application/json" },
      }),
      fetch(
        `${BLOCKSCOUT}/tokens/${token}/holders?items_count=${Math.min(limit + 5, 50)}`,
        {
          next: { revalidate: 30 },
          headers: { accept: "application/json" },
        }
      ),
    ]);
    if (!holdRes.ok) return [];

    const meta = metaRes.ok
      ? ((await metaRes.json()) as {
          decimals?: string | number;
          total_supply?: string;
        })
      : null;
    const decimals = Number(meta?.decimals ?? 18) || 18;
    const chainSupply =
      meta?.total_supply != null
        ? Number(meta.total_supply) / 10 ** decimals
        : 0;
    const supply =
      ctx.supply > 0 ? ctx.supply : chainSupply > 0 ? chainSupply : 1_000_000_000;

    const data = (await holdRes.json()) as {
      items?: Array<{
        address?: { hash?: string; is_contract?: boolean };
        value?: string;
      }>;
    };

    const rows: OnChainHolderRow[] = [];
    for (const item of data.items ?? []) {
      const address = item.address?.hash?.toLowerCase();
      const raw = item.value;
      if (!address || !raw) continue;

      const balance = Number(raw) / 10 ** decimals;
      if (!Number.isFinite(balance) || balance <= 1e-6) continue;

      const addr = address;
      const isBurned = addr === dead;
      const isLp = Boolean(pool && addr === pool);
      const isCurve = Boolean(curve && addr === curve);
      const isDev = Boolean(creator && addr === creator);

      let label: string | undefined;
      if (isBurned) label = "Burned";
      else if (isLp) label = "LP pool";
      else if (isCurve) label = "Bonding curve";
      else if (isDev) label = "Dev";

      rows.push({
        address: addr,
        balance,
        pct: supply > 0 ? (balance / supply) * 100 : 0,
        label,
        isBurned,
        isLp,
        isCurve,
        isDev,
      });
    }

    rows.sort((a, b) => b.balance - a.balance);
    return rows.slice(0, limit);
  } catch {
    return [];
  }
}
