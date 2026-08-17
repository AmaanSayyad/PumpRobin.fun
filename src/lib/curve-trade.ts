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
import {
  BONDING_CURVE_ABI,
  CONTRACTS,
  ERC20_ABI,
  PUMP_ROBIN_FEE_SHARE_ABI,
  PUMP_ROBIN_HOOK_ABI,
  PUMP_ROBIN_TOKEN_ABI,
} from "@/lib/contracts";
import { CHAIN_CONFIG } from "@/lib/chain";
import { executeUniswapSwap } from "@/lib/uniswap-trade";

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
  poolId: string | null;
  realEthReserves: number;
  realTokenReserves: number;
  virtualEthReserves: number;
  virtualTokenReserves: number;
};

async function readCurveState(config: Config, curve: Address) {
  const [
    graduated,
    poolIdRaw,
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
      functionName: "poolId",
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
    poolId: graduated ? (poolIdRaw as string) : null,
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
    poolId: state.poolId,
    realEthReserves: state.realEthReserves,
    realTokenReserves: state.realTokenReserves,
    virtualEthReserves: state.virtualEthReserves,
    virtualTokenReserves: state.virtualTokenReserves,
    price: decoded?.price ?? state.price,
  };
}

/** Every launch now accrues claimable ETH fees on the curve and the hook. */
export async function curveSupportsFeeRouter(): Promise<boolean> {
  return true;
}

export type PendingFees = {
  /** Claimable by the creator, across the curve and the pool. */
  creatorEth: number;
  /** Waiting to auto-forward to the platform. */
  platformEth: number;
  claimThresholdEth: number;
  creatorClaimable: boolean;
  /** Set when the 1% is split between wallets rather than paid to one. */
  feeShare?: Address;
};

/**
 * Launches are plain ERC-20s — the 2% is taken on the ETH leg by the curve and
 * the v4 hook, never on transfer.
 */
export async function tokenHasTransferTax(
  config: Config,
  token: Address
): Promise<boolean> {
  try {
    return Boolean(
      await readContract(config, {
        address: token,
        abi: PUMP_ROBIN_TOKEN_ABI,
        functionName: "hasTransferTax",
      })
    );
  } catch {
    return false;
  }
}

/**
 * Creator fees live in two places over a coin's life: the bonding curve before
 * graduation and the hook after it. Both are ETH, so they simply add up.
 */
export async function readPendingFees(
  config: Config,
  curve: Address,
  _tokenPriceEth = 0,
  token?: Address,
  claimer?: Address
): Promise<PendingFees> {
  let creatorEth = 0;
  let platformEth = 0;
  let claimThresholdEth = Number(CHAIN_CONFIG.feeClaimThresholdEth);
  let feeShare: Address | undefined;

  try {
    const [creatorWei, platformWei, , thresholdWei] = (await readContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "getPendingFees",
    })) as readonly [bigint, bigint, bigint, bigint];
    creatorEth += Number(formatEther(creatorWei));
    platformEth += Number(formatEther(platformWei));
    claimThresholdEth = Number(formatEther(thresholdWei));
  } catch {
    /* pre-migration curve */
  }

  if (CONTRACTS.hook && token) {
    try {
      const [creatorWei, platformWei] = await Promise.all([
        readContract(config, {
          address: CONTRACTS.hook,
          abi: PUMP_ROBIN_HOOK_ABI,
          functionName: "pendingCreatorFees",
          args: [token],
        }),
        readContract(config, {
          address: CONTRACTS.hook,
          abi: PUMP_ROBIN_HOOK_ABI,
          functionName: "pendingPlatformFees",
          args: [token],
        }),
      ]);
      creatorEth += Number(formatEther(creatorWei as bigint));
      platformEth += Number(formatEther(platformWei as bigint));
    } catch {
      /* not registered on this hook */
    }
  }

  // When the creator split their 1%, the splitter holds it and the caller can
  // only take their own share.
  try {
    const recipient = (await readContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "creatorFeeRecipient",
    })) as Address;
    const creatorAddress = (await readContract(config, {
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "creator",
    })) as Address;
    if (recipient.toLowerCase() !== creatorAddress.toLowerCase()) {
      feeShare = recipient;
      if (claimer) {
        const due = (await readContract(config, {
          address: recipient,
          abi: PUMP_ROBIN_FEE_SHARE_ABI,
          functionName: "pendingOf",
          args: [claimer],
        })) as bigint;
        creatorEth += Number(formatEther(due));
      }
    }
  } catch {
    /* no splitter */
  }

  return {
    creatorEth,
    platformEth,
    claimThresholdEth,
    creatorClaimable: creatorEth > 0,
    feeShare,
  };
}

/**
 * Claims from whichever contract is actually holding the creator's ETH: the
 * splitter if there is one, otherwise the curve and the hook in turn.
 */
export async function claimCreatorFees(input: {
  config: Config;
  curve: Address;
  token?: Address;
  feeShare?: Address;
}): Promise<Hash> {
  const submit = async (
    address: Address,
    abi: typeof PUMP_ROBIN_FEE_SHARE_ABI | typeof PUMP_ROBIN_HOOK_ABI | typeof BONDING_CURVE_ABI,
    functionName: string,
    args?: readonly unknown[]
  ): Promise<Hash> => {
    const hash = await writeContract(input.config, {
      address,
      abi,
      functionName,
      args,
    } as Parameters<typeof writeContract>[1]);
    const receipt = await waitForTransactionReceipt(input.config, { hash });
    if (receipt.status !== "success") throw new Error("Claim transaction reverted");
    return hash;
  };

  if (input.feeShare) {
    return submit(input.feeShare, PUMP_ROBIN_FEE_SHARE_ABI, "claim");
  }
  if (CONTRACTS.hook && input.token) {
    try {
      return await submit(CONTRACTS.hook, PUMP_ROBIN_HOOK_ABI, "claimCreatorFees", [
        input.token,
      ]);
    } catch (err) {
      // Nothing waiting in the pool yet — fall through to the curve.
      if (err instanceof Error && err.message === "Claim transaction reverted") throw err;
    }
  }
  return submit(input.curve, BONDING_CURVE_ABI, "claimCreatorFees");
}

/**
 * After graduation the coin lives in a Uniswap v4 pool, so trades go through
 * the normal router. The hook takes the 2% there — no curve call involved.
 */
export async function executeGraduatedCurveTrade(input: {
  config: Config;
  curve: Address;
  token: Address;
  trader: Address;
  isBuy: boolean;
  amount: string;
}): Promise<CurveTradeResult> {
  const amt = Number(input.amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");

  if (!input.isBuy) {
    const balance = (await readContract(input.config, {
      address: input.token,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [input.trader],
    })) as bigint;
    if (balance === ZERO) {
      throw new Error(
        "You have 0 tokens in this wallet — switch to Buy and purchase first."
      );
    }
    if (balance < parseUnits(input.amount, DECIMALS)) {
      throw new Error(
        `Insufficient tokens — wallet has ${formatEther(balance)}, you tried to sell ${input.amount}`
      );
    }
  }

  const txHash = (await executeUniswapSwap({
    config: input.config,
    swapper: input.trader,
    tokenAddress: input.token,
    isBuy: input.isBuy,
    amount: input.amount,
  })) as Hash;

  const state = await readCurveState(input.config, input.curve);
  return {
    txHash,
    isBuy: input.isBuy,
    ethAmount: input.isBuy ? amt : 0,
    tokenAmount: input.isBuy ? 0 : amt,
    ...state,
  };
}
