import { encodeAbiParameters, parseEther, type Address, type Hex } from "viem";
import { FEE_COLLECTOR } from "@/lib/chain";
import { CONTRACTS, ERC20_ABI } from "@/lib/contracts";
import { getRobinhoodPublicClient } from "@/lib/onchain-curve";
import solcInput from "./solc-standard-input.json";

const BLOCKSCOUT = "https://robinhoodchain.blockscout.com";
const COMPILER_VERSION = "v0.8.20+commit.a1b79de6";

/** Must match PumpRobinFactory constructor args. */
const INITIAL_VIRTUAL_ETH = parseEther("1.3");
const INITIAL_VIRTUAL_TOKENS = BigInt("1073000000000000000000000000");

const TOKEN_META_ABI = [
  {
    type: "function",
    name: "imageUri",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "description",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "creator",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "platformFeeRecipient",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "metadataURI",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "antiSnipeEndsAt",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxWalletAmount",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const CURVE_CTOR_ABI = [
  {
    type: "function",
    name: "token",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "creator",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "factory",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "platformFeeRecipient",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hook",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;

const FACTORY_LOOKUP_ABI = [
  {
    type: "function",
    name: "tokenToCurve",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;

export type VerifyResult = {
  address: string;
  contract: string;
  status: "verified" | "submitted" | "skipped" | "error";
  detail?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function strip0x(hex: string): string {
  return hex.startsWith("0x") ? hex.slice(2) : hex;
}

async function getSmartContract(address: string): Promise<{
  is_verified?: boolean;
  name?: string;
} | null> {
  const res = await fetch(
    `${BLOCKSCOUT}/api/v2/smart-contracts/${address.toLowerCase()}`,
    { headers: { Accept: "application/json" }, cache: "no-store" }
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as { is_verified?: boolean; name?: string };
}

async function waitIndexed(address: string, attempts = 8): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const sc = await getSmartContract(address);
    if (sc) return true;
    await sleep(4000);
  }
  return false;
}

async function submitStandardJson(opts: {
  address: string;
  contractName: string;
  constructorArgs: Hex;
}): Promise<{ ok: boolean; body: string }> {
  const form = new FormData();
  form.set("compiler_version", COMPILER_VERSION);
  form.set("contract_name", opts.contractName);
  form.set("license_type", "mit");
  form.set("autodetect_constructor_args", "false");
  form.set("constructor_args", strip0x(opts.constructorArgs));
  form.set(
    "files[standard-input.json]",
    new Blob([JSON.stringify(solcInput)], { type: "application/json" }),
    "standard-input.json"
  );

  const res = await fetch(
    `${BLOCKSCOUT}/api/v2/smart-contracts/${opts.address.toLowerCase()}/verification/via/standard-input`,
    { method: "POST", headers: { Accept: "application/json" }, body: form }
  );
  const body = await res.text();
  return { ok: res.ok, body };
}

async function verifyOne(opts: {
  address: string;
  contractName: string;
  constructorArgs: Hex;
}): Promise<VerifyResult> {
  const address = opts.address.toLowerCase();
  const indexed = await waitIndexed(address);
  if (!indexed) {
    return {
      address,
      contract: opts.contractName,
      status: "error",
      detail: "Blockscout has not indexed this contract yet",
    };
  }

  const existing = await getSmartContract(address);
  if (existing?.is_verified) {
    return {
      address,
      contract: opts.contractName,
      status: "verified",
      detail: "already verified",
    };
  }

  const submitted = await submitStandardJson(opts);
  if (
    submitted.body.includes("Already verified") ||
    submitted.body.includes("already verified")
  ) {
    return {
      address,
      contract: opts.contractName,
      status: "verified",
      detail: "already verified",
    };
  }

  if (!submitted.ok) {
    return {
      address,
      contract: opts.contractName,
      status: "error",
      detail: submitted.body.slice(0, 500),
    };
  }

  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    const sc = await getSmartContract(address);
    if (sc?.is_verified) {
      return { address, contract: opts.contractName, status: "verified" };
    }
  }

  return {
    address,
    contract: opts.contractName,
    status: "submitted",
    detail: submitted.body.slice(0, 500),
  };
}

async function readTokenCtor(token: Address) {
  const client = getRobinhoodPublicClient();
  const [
    name,
    symbol,
    imageUri,
    description,
    metadataURI,
    creator,
    platform,
    antiSnipeEndsAt,
    maxWalletAmount,
  ] = await Promise.all([
    client.readContract({ address: token, abi: ERC20_ABI, functionName: "name" }),
    client.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "symbol",
    }),
    client.readContract({
      address: token,
      abi: TOKEN_META_ABI,
      functionName: "imageUri",
    }),
    client.readContract({
      address: token,
      abi: TOKEN_META_ABI,
      functionName: "description",
    }),
    client.readContract({
      address: token,
      abi: TOKEN_META_ABI,
      functionName: "metadataURI",
    }),
    client.readContract({
      address: token,
      abi: TOKEN_META_ABI,
      functionName: "creator",
    }),
    client.readContract({
      address: token,
      abi: TOKEN_META_ABI,
      functionName: "platformFeeRecipient",
    }),
    client.readContract({
      address: token,
      abi: TOKEN_META_ABI,
      functionName: "antiSnipeEndsAt",
    }),
    client.readContract({
      address: token,
      abi: TOKEN_META_ABI,
      functionName: "maxWalletAmount",
    }),
  ]);

  return encodeAbiParameters(
    [
      { type: "string" },
      { type: "string" },
      { type: "string" },
      { type: "string" },
      { type: "string" },
      { type: "address" },
      { type: "address" },
      { type: "bool" },
      { type: "bool" },
    ],
    [
      name,
      symbol,
      imageUri,
      description,
      metadataURI,
      creator,
      platform,
      (antiSnipeEndsAt as bigint) > BigInt(0),
      (maxWalletAmount as bigint) > BigInt(0),
    ]
  );
}

async function readCurveCtor(curve: Address) {
  const client = getRobinhoodPublicClient();
  const [token, creator, factory, platformFeeRecipient, hook] = await Promise.all([
    client.readContract({
      address: curve,
      abi: CURVE_CTOR_ABI,
      functionName: "token",
    }),
    client.readContract({
      address: curve,
      abi: CURVE_CTOR_ABI,
      functionName: "creator",
    }),
    client.readContract({
      address: curve,
      abi: CURVE_CTOR_ABI,
      functionName: "factory",
    }),
    client.readContract({
      address: curve,
      abi: CURVE_CTOR_ABI,
      functionName: "platformFeeRecipient",
    }),
    client.readContract({
      address: curve,
      abi: CURVE_CTOR_ABI,
      functionName: "hook",
    }),
  ]);

  return encodeAbiParameters(
    [
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "uint256" },
      { type: "uint256" },
    ],
    [
      token,
      creator,
      factory,
      platformFeeRecipient || FEE_COLLECTOR,
      hook,
      INITIAL_VIRTUAL_ETH,
      INITIAL_VIRTUAL_TOKENS,
    ]
  );
}

const inflight = new Set<string>();

/** Verify a launched PumpRobin token + its bonding curve on Blockscout. */
export async function verifyLaunchedToken(
  tokenAddress: string
): Promise<VerifyResult[]> {
  const token = tokenAddress.toLowerCase() as Address;
  if (inflight.has(token)) {
    return [
      {
        address: token,
        contract: "PumpRobinToken",
        status: "skipped",
        detail: "verification already running",
      },
    ];
  }
  inflight.add(token);
  try {
    return await verifyLaunchedTokenInner(token);
  } finally {
    inflight.delete(token);
  }
}

async function verifyLaunchedTokenInner(
  token: Address
): Promise<VerifyResult[]> {
  const results: VerifyResult[] = [];
  const client = getRobinhoodPublicClient();
  const factory = CONTRACTS.factory;

  const tokenArgs = await readTokenCtor(token);
  results.push(
    await verifyOne({
      address: token,
      contractName: "PumpRobinToken",
      constructorArgs: tokenArgs,
    })
  );

  let curve: Address | undefined;
  if (factory) {
    try {
      curve = (await client.readContract({
        address: factory,
        abi: FACTORY_LOOKUP_ABI,
        functionName: "tokenToCurve",
        args: [token],
      })) as Address;
    } catch {
      curve = undefined;
    }
  }

  if (
    !curve ||
    curve === "0x0000000000000000000000000000000000000000"
  ) {
    results.push({
      address: "",
      contract: "BondingCurve",
      status: "skipped",
      detail: "No bonding curve on current factory",
    });
    return results;
  }

  const curveArgs = await readCurveCtor(curve);
  results.push(
    await verifyOne({
      address: curve,
      contractName: "BondingCurve",
      constructorArgs: curveArgs,
    })
  );

  return results;
}
