import {
  type Config,
  waitForTransactionReceipt,
  writeContract,
  readContract,
} from "@wagmi/core";
import {
  decodeEventLog,
  formatEther,
  parseEther,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { BONDING_CURVE_ABI, ERC20_ABI } from "@/lib/contracts";
import { CHAIN_CONFIG } from "@/lib/chain";

const DECIMALS = 18;
/** 2% slippage cushion on estimated out (minTokens / minEth) */
const SLIPPAGE_BPS = 200n;
const FEE_BPS = BigInt(CHAIN_CONFIG.tradeFeeBps);

export type CurveTradeResult = {
  txHash: Hash;
  isBuy: boolean;
  ethAmount: number;
  tokenAmount: number;
  price: number;
  graduated: boolean;
  uniswapPool: string | null;
  realEthReserves: number;
  realTokenReserves: number;
  virtualEthReserves: number;
  virtualTokenReserves: number;
};

async function readCurveState(config: Config, curve: Address) {
  const [
    graduated,
    uniswapPool,
    realEth,
    realTokens,
    virtualEth,
    virtualTokens,
    priceWei,
  ] = await Promise.all([
    readContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "graduated",
    }),
    readContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "uniswapPool",
    }),
    readContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "realEthReserves",
    }),
    readContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "realTokenReserves",
    }),
    readContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "virtualEthReserves",
    }),
    readContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "virtualTokenReserves",
    }),
    readContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "getPrice",
    }),
  ]);

  return {
    graduated: Boolean(graduated),
    uniswapPool:
      uniswapPool && uniswapPool !== "0x0000000000000000000000000000000000000000"
        ? (uniswapPool as string).toLowerCase()
        : null,
    realEthReserves: Number(formatEther(realEth as bigint)),
    realTokenReserves: Number(formatEther(realTokens as bigint)),
    virtualEthReserves: Number(formatEther(virtualEth as bigint)),
    virtualTokenReserves: Number(formatEther(virtualTokens as bigint)),
    price: Number(formatEther(priceWei as bigint)),
  };
}

function parseTradeFromReceipt(
  logs: { data: `0x${string}`; topics: [] | [`0x${string}`, ...`0x${string}`[]] }[],
  trader: Address
): { isBuy: boolean; ethAmount: number; tokenAmount: number; price: number } | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: BONDING_CURVE_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Trade") continue;
      const args = decoded.args as {
        trader: Address;
        isBuy: boolean;
        ethAmount: bigint;
        tokenAmount: bigint;
        newPrice: bigint;
      };
      if (args.trader.toLowerCase() !== trader.toLowerCase()) continue;
      return {
        isBuy: args.isBuy,
        ethAmount: Number(formatEther(args.ethAmount)),
        tokenAmount: Number(formatEther(args.tokenAmount)),
        price: Number(formatEther(args.newPrice)),
      };
    } catch {
      /* not our event */
    }
  }
  return null;
}

/**
 * Execute an on-chain bonding-curve buy or sell and return decoded trade + reserves.
 */
export async function executeCurveTrade(input: {
  config: Config;
  curve: Address;
  token: Address;
  trader: Address;
  isBuy: boolean;
  /** ETH for buys, whole tokens for sells */
  amount: string;
}): Promise<CurveTradeResult> {
  const { config, curve, token, trader, isBuy, amount } = input;
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error("Enter a valid amount");
  }

  let txHash: Hash;

  if (isBuy) {
    const value = parseEther(amount);
    // Estimate tokens out from current reserves for minTokens slippage
    const [vEth, vTok] = await Promise.all([
      readContract(config, {
        address: curve,
        abi: BONDING_CURVE_ABI,
        functionName: "virtualEthReserves",
      }) as Promise<bigint>,
      readContract(config, {
        address: curve,
        abi: BONDING_CURVE_ABI,
        functionName: "virtualTokenReserves",
      }) as Promise<bigint>,
    ]);
    const feeBps = FEE_BPS;
    const afterFee = value - (value * feeBps) / 10_000n;
    const k = vEth * vTok;
    const newEth = vEth + afterFee;
    const newTok = k / newEth;
    const tokensOut = vTok - newTok;
    const minTokens = (tokensOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;

    txHash = await writeContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "buy",
      args: [minTokens > 0n ? minTokens : 0n],
      value,
    });
  } else {
    const tokenAmount = parseUnits(amount, DECIMALS);
    const balance = (await readContract(config, {
      address: token,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [trader],
    })) as bigint;

    if (balance === 0n) {
      throw new Error(
        "You have 0 tokens in this wallet — switch to Buy and purchase first. Sell only works after you hold tokens."
      );
    }
    if (balance < tokenAmount) {
      throw new Error(
        `Insufficient tokens — wallet has ${formatEther(balance)}, you tried to sell ${amount}`
      );
    }

    const allowance = (await readContract(config, {
      address: token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [trader, curve],
    })) as bigint;

    if (allowance < tokenAmount) {
      const approveHash = await writeContract(config, {
        address: token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [curve, tokenAmount],
      });
      await waitForTransactionReceipt(config, { hash: approveHash });
    }

    const [vEth, vTok] = await Promise.all([
      readContract(config, {
        address: curve,
        abi: BONDING_CURVE_ABI,
        functionName: "virtualEthReserves",
      }) as Promise<bigint>,
      readContract(config, {
        address: curve,
        abi: BONDING_CURVE_ABI,
        functionName: "virtualTokenReserves",
      }) as Promise<bigint>,
    ]);
    const k = vEth * vTok;
    const newTok = vTok + tokenAmount;
    const newEth = k / newTok;
    const ethOut = vEth - newEth;
    const feeBps = FEE_BPS;
    const afterFee = ethOut - (ethOut * feeBps) / 10_000n;
    const minEth = (afterFee * (10_000n - SLIPPAGE_BPS)) / 10_000n;

    txHash = await writeContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "sell",
      args: [tokenAmount, minEth > 0n ? minEth : 0n],
    });
  }

  const receipt = await waitForTransactionReceipt(config, { hash: txHash });
  if (receipt.status !== "success") {
    throw new Error("Trade transaction reverted");
  }

  const decoded = parseTradeFromReceipt(receipt.logs, trader);
  const state = await readCurveState(config, curve);

  return {
    txHash,
    isBuy,
    ethAmount: decoded?.ethAmount ?? (isBuy ? amt : state.price * amt),
    tokenAmount: decoded?.tokenAmount ?? (isBuy ? 0 : amt),
    price: decoded?.price ?? state.price,
    ...state,
  };
}
