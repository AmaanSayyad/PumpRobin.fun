import {
  parseEther,
  parseUnits,
  formatUnits,
  isAddress,
  isHex,
  type Hex,
  type Address,
} from "viem";
import {
  getWalletClient,
  getPublicClient,
  switchChain,
  readContract,
  writeContract,
  waitForTransactionReceipt,
} from "@wagmi/core";
import type { Config } from "wagmi";
import { robinhoodChain, WETH_ADDRESS } from "@/lib/chain";
import { CONTRACTS, ERC20_ABI, FOT_UNISWAP_SELLER_ABI } from "@/lib/contracts";

export const NATIVE_ETH = "0x0000000000000000000000000000000000000000" as const;

type ClassicQuote = {
  routing: string;
  quote: {
    input: { token: string; amount: string };
    output: { token: string; amount: string; minimumAmount?: string };
    gasFeeUSD?: string;
    slippage?: number;
  };
  permitData?: Record<string, unknown> | null;
};

export type QuotePreview = {
  amountOut: string;
  amountOutFormatted: string;
  gasFeeUSD?: string;
  raw: ClassicQuote;
};

function validateSwapTx(swap: { data?: string; to?: string; from?: string; value?: string }) {
  if (!swap?.data || swap.data === "" || swap.data === "0x" || !isHex(swap.data)) {
    throw new Error("Empty swap data — quote may have expired. Try again.");
  }
  if (!swap.to || !isAddress(swap.to) || !swap.from || !isAddress(swap.from)) {
    throw new Error("Invalid swap addresses from Uniswap");
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/uniswap/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.detail || `Uniswap ${path} failed`);
  }
  return data as T;
}

async function sendOnRobinhood(
  config: Config,
  tx: { to: Address; data: Hex; value?: string }
): Promise<Hex> {
  await switchChain(config, { chainId: robinhoodChain.id });
  const walletClient = await getWalletClient(config, { chainId: robinhoodChain.id });
  if (!walletClient?.account) throw new Error("Wallet not connected");

  const hash = await walletClient.sendTransaction({
    account: walletClient.account,
    chain: robinhoodChain,
    to: tx.to,
    data: tx.data,
    value: BigInt(tx.value || "0"),
  });

  const publicClient = getPublicClient(config, { chainId: robinhoodChain.id });
  if (publicClient) {
    await publicClient.waitForTransactionReceipt({ hash });
  }
  return hash;
}

export async function getUniswapQuote(params: {
  swapper: Address;
  tokenAddress: Address;
  isBuy: boolean;
  amount: string;
  tokenDecimals?: number;
  platformCut?: boolean;
}): Promise<QuotePreview> {
  const decimals = params.tokenDecimals ?? 18;
  const amountWei = params.isBuy
    ? parseEther(params.amount).toString()
    : parseUnits(params.amount, decimals).toString();

  const tokenIn = params.isBuy ? NATIVE_ETH : params.tokenAddress;
  const tokenOut = params.isBuy ? params.tokenAddress : NATIVE_ETH;

  const raw = await postJson<ClassicQuote>("quote", {
    swapper: params.swapper,
    tokenIn,
    tokenOut,
    amount: amountWei,
    type: "EXACT_INPUT",
    slippageTolerance: params.platformCut ? 12.5 : 5,
    platformCut: Boolean(params.platformCut),
  });

  const outAmount = raw.quote?.output?.amount;
  if (!outAmount) throw new Error("No quote available for this pair yet");

  const outIsEth =
    raw.quote.output.token.toLowerCase() === NATIVE_ETH.toLowerCase() ||
    raw.quote.output.token.toLowerCase() === WETH_ADDRESS.toLowerCase();

  return {
    amountOut: outAmount,
    amountOutFormatted: formatUnits(BigInt(outAmount), outIsEth ? 18 : decimals),
    gasFeeUSD: raw.quote.gasFeeUSD,
    raw,
  };
}

/**
 * PumpRobin v3 sells cannot use the Trading API Permit2 path on Robinhood:
 * UR 2.1.1 quotes omit a signed permit, Permit2 allowance stays 0, and
 * MetaMask simulates AllowanceExpired ("Interaction failed").
 */
async function sellViaFotSeller(params: {
  config: Config;
  swapper: Address;
  tokenAddress: Address;
  amountWei: bigint;
  minEthOut: bigint;
}): Promise<Hex> {
  const seller = CONTRACTS.fotSeller;
  if (!seller) {
    throw new Error("Sell helper not configured — set NEXT_PUBLIC_FOT_SELLER_ADDRESS");
  }

  await switchChain(params.config, { chainId: robinhoodChain.id });

  const allowance = (await readContract(params.config, {
    address: params.tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [params.swapper, seller],
  })) as bigint;

  if (allowance < params.amountWei) {
    const approveHash = await writeContract(params.config, {
      address: params.tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [seller, params.amountWei],
    });
    await waitForTransactionReceipt(params.config, { hash: approveHash });
  }

  const hash = await writeContract(params.config, {
    address: seller,
    abi: FOT_UNISWAP_SELLER_ABI,
    functionName: "sellTokenForEth",
    args: [params.tokenAddress, params.amountWei, params.minEthOut],
  });
  await waitForTransactionReceipt(params.config, { hash });
  return hash;
}

export async function executeUniswapSwap(params: {
  config: Config;
  swapper: Address;
  tokenAddress: Address;
  isBuy: boolean;
  amount: string;
  tokenDecimals?: number;
  platformCut?: boolean;
}): Promise<Hex> {
  const decimals = params.tokenDecimals ?? 18;
  const amountWei = params.isBuy
    ? parseEther(params.amount).toString()
    : parseUnits(params.amount, decimals).toString();

  if (!params.isBuy && !params.platformCut) {
    let minEthOut = 0n;
    try {
      const quoted = await getUniswapQuote(params);
      minEthOut = (BigInt(quoted.amountOut) * 90n) / 100n;
    } catch {
      /* still sell; helper enforces amountOutMinimum = 0 on-chain */
    }
    return sellViaFotSeller({
      config: params.config,
      swapper: params.swapper,
      tokenAddress: params.tokenAddress,
      amountWei: BigInt(amountWei),
      minEthOut,
    });
  }

  if (!params.isBuy) {
    const approval = await postJson<{
      approval: {
        to: Address;
        data: Hex;
        value?: string;
      } | null;
    }>("check_approval", {
      walletAddress: params.swapper,
      token: params.tokenAddress,
      amount: amountWei,
    });

    if (approval.approval) {
      await sendOnRobinhood(params.config, approval.approval);
    }
  }

  const fresh = await getUniswapQuote(params);
  const swapData = await postJson<{
    swap: { to: Address; from: Address; data: Hex; value: string };
  }>("swap", fresh.raw);

  validateSwapTx(swapData.swap);
  return sendOnRobinhood(params.config, swapData.swap);
}
