import { createPublicClient, formatEther, http, type Address } from "viem";
import { BONDING_CURVE_ABI } from "@/lib/contracts";
import { robinhoodChain } from "@/lib/chain";

const rpc =
  process.env.RH_RPC_URL ||
  process.env.NEXT_PUBLIC_RH_RPC_URL ||
  "https://rpc.mainnet.chain.robinhood.com";

export function getRobinhoodPublicClient() {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(rpc),
  });
}

/** Live bonding-curve reserves from chain (fixes stale registry after createAndBuy). */
export async function readBondingCurveOnChain(curve: Address) {
  const client = getRobinhoodPublicClient();
  const [
    graduated,
    uniswapPool,
    realEth,
    realTokens,
    virtualEth,
    virtualTokens,
    priceWei,
  ] = await Promise.all([
    client.readContract({
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "graduated",
    }),
    client.readContract({
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "uniswapPool",
    }),
    client.readContract({
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "realEthReserves",
    }),
    client.readContract({
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "realTokenReserves",
    }),
    client.readContract({
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "virtualEthReserves",
    }),
    client.readContract({
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "virtualTokenReserves",
    }),
    client.readContract({
      address: curve,
      abi: BONDING_CURVE_ABI,
      functionName: "getPrice",
    }),
  ]);

  const pool =
    uniswapPool &&
    (uniswapPool as string).toLowerCase() !==
      "0x0000000000000000000000000000000000000000"
      ? (uniswapPool as string).toLowerCase()
      : null;

  return {
    graduated: Boolean(graduated),
    uniswapPool: pool,
    realEthReserves: Number(formatEther(realEth as bigint)),
    realTokenReserves: Number(formatEther(realTokens as bigint)),
    virtualEthReserves: Number(formatEther(virtualEth as bigint)),
    virtualTokenReserves: Number(formatEther(virtualTokens as bigint)),
    price: Number(formatEther(priceWei as bigint)),
  };
}
