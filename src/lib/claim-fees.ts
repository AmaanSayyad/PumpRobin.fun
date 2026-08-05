import {
  type Config,
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import { formatEther, type Address, type Hash } from "viem";
import { BONDING_CURVE_ABI } from "@/lib/contracts";

export async function readPendingCreatorFees(
  config: Config,
  curve: Address
): Promise<number> {
  const wei = (await readContract(config, {
    address: curve,
    abi: BONDING_CURVE_ABI,
    functionName: "pendingCreatorFees",
  })) as bigint;
  return Number(formatEther(wei));
}

export async function claimCreatorFees(input: {
  config: Config;
  curve: Address;
}): Promise<{ txHash: Hash; amountEth: number }> {
  const before = await readPendingCreatorFees(input.config, input.curve);
  if (before <= 0) {
    throw new Error("No creator fees to claim yet");
  }

  const txHash = await writeContract(input.config, {
    address: input.curve,
    abi: BONDING_CURVE_ABI,
    functionName: "claimCreatorFees",
  });

  const receipt = await waitForTransactionReceipt(input.config, { hash: txHash });
  if (receipt.status !== "success") {
    throw new Error("Claim transaction reverted");
  }

  return { txHash, amountEth: before };
}
