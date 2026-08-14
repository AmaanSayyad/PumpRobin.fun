import { formatEther, type Address } from "viem";
import { ERC20_ABI } from "@/lib/contracts";
import { getRobinhoodPublicClient } from "@/lib/onchain-curve";

export const DEAD_ADDRESS =
  "0x000000000000000000000000000000000000dead" as const;

/** Tokens sent to the burn/dead address (instant launch excess supply). */
export async function readDeadTokenBalance(token: Address): Promise<number> {
  const client = getRobinhoodPublicClient();
  const bal = await client.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [DEAD_ADDRESS],
  });
  return Number(formatEther(bal as bigint));
}
