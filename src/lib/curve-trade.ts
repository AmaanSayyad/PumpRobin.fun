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
import { BONDING_CURVE_ABI, CONTRACTS, ERC20_ABI, FOT_UNISWAP_SELLER_ABI, PUMP_ROBIN_TOKEN_ABI } from "@/lib/contracts";
import { CHAIN_CONFIG } from "@/lib/chain";

const DECIMALS = 18;
/** 2% slippage cushion on estimated out (minTokens / minEth) */
const SLIPPAGE_BPS = BigInt(200);
const FEE_BPS = BigInt(CHAIN_CONFIG.tradeFeeBps);
const BPS_DENOM = BigInt(10_000);
const ZERO = BigInt(0);

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
      const args = decoded.args as unknown as {
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
    const afterFee = value - (value * feeBps) / BPS_DENOM;
    const k = vEth * vTok;
    const newEth = vEth + afterFee;
    const newTok = k / newEth;
    const tokensOut = vTok - newTok;
    const minTokens = (tokensOut * (BPS_DENOM - SLIPPAGE_BPS)) / BPS_DENOM;

    txHash = await writeContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "buy",
      args: [minTokens > ZERO ? minTokens : ZERO],
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

    if (balance === ZERO) {
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
    const afterFee = ethOut - (ethOut * feeBps) / BPS_DENOM;
    const minEth = (afterFee * (BPS_DENOM - SLIPPAGE_BPS)) / BPS_DENOM;

    txHash = await writeContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "sell",
      args: [tokenAmount, minEth > ZERO ? minEth : ZERO],
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
    graduated: state.graduated,
    uniswapPool: state.uniswapPool,
    realEthReserves: state.realEthReserves,
    realTokenReserves: state.realTokenReserves,
    virtualEthReserves: state.virtualEthReserves,
    virtualTokenReserves: state.virtualTokenReserves,
    price: decoded?.price ?? state.price,
  };
}

/** Whether this curve supports accumulated fees (v5+) */
export async function curveSupportsFeeRouter(
  config: Config,
  curve: Address
): Promise<boolean> {
  try {
    await readContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "pendingCreatorTokenFees",
    });
    return true;
  } catch {
    return false;
  }
}

export type PendingFees = {
  creatorEth: number;
  platformEth: number;
  creatorTokens: number;
  platformTokens: number;
  claimThresholdEth: number;
  creatorClaimable: boolean;
};

export async function tokenHasTransferTax(
  config: Config,
  token: Address
): Promise<boolean> {
  try {
    const bps = await readContract(config, {
      address: token,
      abi: PUMP_ROBIN_TOKEN_ABI,
      functionName: "FEE_BPS",
    });
    return Number(bps) > 0;
  } catch {
    return false;
  }
}

export async function readPendingFees(
  config: Config,
  curve: Address,
  tokenPriceEth = 0
): Promise<PendingFees> {
  const [creatorEth, platformEth, creatorTokens, platformTokens, threshold] =
    (await readContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "getPendingFees",
    })) as [bigint, bigint, bigint, bigint, bigint];

  const creatorEthNum = Number(formatEther(creatorEth));
  const platformEthNum = Number(formatEther(platformEth));
  const creatorTokensNum = Number(formatEther(creatorTokens));
  const platformTokensNum = Number(formatEther(platformTokens));
  const claimThresholdEth = Number(formatEther(threshold));
  const creatorTokenEth = creatorTokensNum * tokenPriceEth;
  const platformTokenEth = platformTokensNum * tokenPriceEth;

  return {
    creatorEth: creatorEthNum,
    platformEth: platformEthNum,
    creatorTokens: creatorTokensNum,
    platformTokens: platformTokensNum,
    claimThresholdEth,
    creatorClaimable:
      creatorEthNum + creatorTokenEth >= claimThresholdEth,
  };
}

export async function claimCreatorFees(input: {
  config: Config;
  curve: Address;
}): Promise<Hash> {
  const hash = await writeContract(input.config, {
    address: input.curve,
    abi: BONDING_CURVE_ABI,
    functionName: "claimCreatorFees",
  });
  const receipt = await waitForTransactionReceipt(input.config, { hash });
  if (receipt.status !== "success") {
    throw new Error("Claim transaction reverted");
  }
  return hash;
}

/**
 * Graduated-token trades via bonding curve (Uniswap under the hood + 2% fee).
 */
export async function executeGraduatedCurveTrade(input: {
  config: Config;
  curve: Address;
  token: Address;
  trader: Address;
  isBuy: boolean;
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
    txHash = await writeContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "buyOnUniswap",
      args: [ZERO],
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

    if (balance === ZERO) {
      throw new Error(
        "You have 0 tokens in this wallet — switch to Buy and purchase first."
      );
    }
    if (balance < tokenAmount) {
      throw new Error(
        `Insufficient tokens — wallet has ${formatEther(balance)}, you tried to sell ${amount}`
      );
    }

    // FoT tokens: bonding-curve sellOnUniswap pulls then swaps the full amount,
    // which reverts STF after the 2% tax. Route through FoTUniswapSeller instead.
    const seller = CONTRACTS.fotSeller;
    if (!seller) {
      throw new Error("Sell helper not configured — set NEXT_PUBLIC_FOT_SELLER_ADDRESS");
    }

    const allowance = (await readContract(config, {
      address: token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [trader, seller],
    })) as bigint;

    if (allowance < tokenAmount) {
      const approveHash = await writeContract(config, {
        address: token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [seller, tokenAmount],
      });
      await waitForTransactionReceipt(config, { hash: approveHash });
    }

    txHash = await writeContract(config, {
      address: seller,
      abi: FOT_UNISWAP_SELLER_ABI,
      functionName: "sellTokenForEth",
      args: [token, tokenAmount, ZERO],
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
    ethAmount: decoded?.ethAmount ?? amt,
    tokenAmount: decoded?.tokenAmount ?? (isBuy ? 0 : amt),
    graduated: state.graduated,
    uniswapPool: state.uniswapPool,
    realEthReserves: state.realEthReserves,
    realTokenReserves: state.realTokenReserves,
    virtualEthReserves: state.virtualEthReserves,
    virtualTokenReserves: state.virtualTokenReserves,
    price: decoded?.price ?? state.price,
  };
}
