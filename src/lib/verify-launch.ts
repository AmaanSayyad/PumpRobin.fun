import {
  decodeEventLog,
  parseEther,
  type Address,
  type Hash,
} from "viem";
import { CHAIN_CONFIG, UNISWAP_V3 } from "@/lib/chain";
import { CONTRACTS, PUMP_ROBIN_FACTORY_ABI } from "@/lib/contracts";
import { getRobinhoodPublicClient } from "@/lib/onchain-curve";

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const ZERO = "0x0000000000000000000000000000000000000000";

export class LaunchVerifyError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function isTxHash(value: unknown): value is Hash {
  return typeof value === "string" && TX_HASH_RE.test(value);
}

export type VerifiedFactoryLaunch = {
  token: Address;
  bondingCurve: Address;
  creator: Address;
  name: string;
  symbol: string;
  imageUri: string;
  txHash: Hash;
  payer: Address;
};

/** Confirm a PumpRobinFactory.createToken tx paid the creation fee + LP seed. */
export async function verifyFactoryCreateTx(
  txHash: string
): Promise<VerifiedFactoryLaunch> {
  if (!CONTRACTS.factory) {
    throw new LaunchVerifyError("Factory is not configured", 503);
  }
  if (!isTxHash(txHash)) {
    throw new LaunchVerifyError(
      "txHash must be a confirmed 32-byte factory createToken hash"
    );
  }

  const client = getRobinhoodPublicClient();
  const hash = txHash as Hash;
  let receipt;
  let tx;
  try {
    [receipt, tx] = await Promise.all([
      client.getTransactionReceipt({ hash }),
      client.getTransaction({ hash }),
    ]);
  } catch {
    throw new LaunchVerifyError(
      "Transaction not found — wait for confirmation and retry",
      404
    );
  }

  if (receipt.status !== "success") {
    throw new LaunchVerifyError("Launch transaction reverted");
  }

  const factory = CONTRACTS.factory.toLowerCase();
  if (receipt.to?.toLowerCase() !== factory) {
    throw new LaunchVerifyError(
      "Transaction was not sent to the PumpRobin factory"
    );
  }

  const minValue =
    parseEther(CHAIN_CONFIG.creationFee) +
    parseEther(CHAIN_CONFIG.minInstantSeedEth);
  if (tx.value < minValue) {
    throw new LaunchVerifyError(
      `Transaction must pay ${CHAIN_CONFIG.creationFee} ETH creation fee plus at least ${CHAIN_CONFIG.minInstantSeedEth} ETH LP seed`
    );
  }

  let created: Omit<VerifiedFactoryLaunch, "txHash" | "payer"> | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== factory) continue;
    try {
      const decoded = decodeEventLog({
        abi: PUMP_ROBIN_FACTORY_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "TokenCreated") continue;
      const args = decoded.args as {
        token: Address;
        bondingCurve: Address;
        creator: Address;
        name: string;
        symbol: string;
        imageUri: string;
      };
      created = {
        token: args.token,
        bondingCurve: args.bondingCurve,
        creator: args.creator,
        name: args.name,
        symbol: args.symbol,
        imageUri: args.imageUri,
      };
      break;
    } catch {
      /* not TokenCreated */
    }
  }

  if (!created) {
    throw new LaunchVerifyError(
      "No TokenCreated event from the factory in this transaction"
    );
  }

  const curve = await client.readContract({
    address: CONTRACTS.factory,
    abi: PUMP_ROBIN_FACTORY_ABI,
    functionName: "tokenToCurve",
    args: [created.token],
  });
  if (
    typeof curve !== "string" ||
    curve.toLowerCase() === ZERO ||
    curve.toLowerCase() !== created.bondingCurve.toLowerCase()
  ) {
    throw new LaunchVerifyError("Factory does not recognize this token");
  }

  return {
    ...created,
    txHash: hash,
    payer: tx.from,
  };
}

const TRADE_INDEX_TARGETS = new Set(
  [
    CONTRACTS.factory,
    CONTRACTS.fotSeller,
    UNISWAP_V3.swapRouter02,
    UNISWAP_V3.universalRouter,
    UNISWAP_V3.positionManager,
  ]
    .filter(Boolean)
    .map((a) => a!.toLowerCase())
);

/** Confirm a tx exists on-chain before indexing a trade. */
export async function verifyIndexableTradeTx(input: {
  txHash: string;
  bondingCurve?: string | null;
}): Promise<Hash> {
  if (!isTxHash(input.txHash)) {
    throw new LaunchVerifyError("txHash is required to index a trade");
  }

  const client = getRobinhoodPublicClient();
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: input.txHash });
  } catch {
    throw new LaunchVerifyError(
      "Trade transaction not found — wait for confirmation and retry",
      404
    );
  }
  if (receipt.status !== "success") {
    throw new LaunchVerifyError("Trade transaction reverted");
  }

  const to = receipt.to?.toLowerCase();
  const curve = input.bondingCurve?.toLowerCase();
  const allowed =
    (to && TRADE_INDEX_TARGETS.has(to)) ||
    (to && curve && to === curve) ||
    receipt.logs.some(
      (log) =>
        log.address.toLowerCase() === curve ||
        (CONTRACTS.factory &&
          log.address.toLowerCase() === CONTRACTS.factory.toLowerCase())
    );

  if (!allowed) {
    throw new LaunchVerifyError(
      "Transaction is not a PumpRobin factory, curve, or Uniswap trade"
    );
  }

  return input.txHash;
}
