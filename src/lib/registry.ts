import { promises as fs } from "fs";
import path from "path";
import type { PlatformState, TokenRecord, TradeRecord, LaunchMetadata } from "./data";
import {
  DEFAULT_SUPPLY,
  virtualTokensForSupply,
  virtualEthForSupply,
} from "./curve";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase/server";

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "platform.json");

function emptyState(): PlatformState {
  const now = new Date().toISOString();
  return {
    tokens: [],
    trades: [],
    autoLaunchEnabled: false,
    lastAutoLaunch: null,
    createdAt: now,
    updatedAt: now,
  };
}

/* ─── File fallback (local / no Supabase) ─── */

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STATE_FILE);
  } catch {
    await fs.writeFile(STATE_FILE, JSON.stringify(emptyState(), null, 2));
  }
}

async function readFileState(): Promise<PlatformState> {
  await ensureFile();
  const raw = await fs.readFile(STATE_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as PlatformState;
    return {
      ...emptyState(),
      ...parsed,
      tokens: parsed.tokens ?? [],
      trades: parsed.trades ?? [],
    };
  } catch {
    return emptyState();
  }
}

async function writeFileState(state: PlatformState): Promise<void> {
  await ensureFile();
  const next = { ...state, updatedAt: new Date().toISOString() };
  await fs.writeFile(STATE_FILE, JSON.stringify(next, null, 2));
}

/* ─── Supabase mappers ─── */

type TokenRow = {
  address: string;
  bonding_curve: string;
  name: string;
  symbol: string;
  image_uri: string;
  description: string;
  creator: string;
  created_at: string;
  virtual_eth_reserves: number;
  virtual_token_reserves: number;
  real_eth_reserves: number;
  real_token_reserves: number;
  graduated: boolean;
  source: "registry" | "onchain";
  tx_hash: string | null;
  metadata: LaunchMetadata | null;
};

type TradeRow = {
  id: string;
  token_address: string;
  trader: string;
  is_buy: boolean;
  eth_amount: number;
  token_amount: number;
  price: number;
  fee_eth: number;
  timestamp: string;
};

function rowToToken(row: TokenRow): TokenRecord {
  return {
    address: row.address,
    bondingCurve: row.bonding_curve,
    name: row.name,
    symbol: row.symbol,
    imageUri: row.image_uri,
    description: row.description,
    creator: row.creator,
    createdAt: row.created_at,
    virtualEthReserves: row.virtual_eth_reserves,
    virtualTokenReserves: row.virtual_token_reserves,
    realEthReserves: row.real_eth_reserves,
    realTokenReserves: row.real_token_reserves,
    graduated: row.graduated,
    source: row.source,
    txHash: row.tx_hash ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

function tokenToRow(token: TokenRecord): TokenRow {
  return {
    address: token.address,
    bonding_curve: token.bondingCurve,
    name: token.name,
    symbol: token.symbol,
    image_uri: token.imageUri,
    description: token.description,
    creator: token.creator,
    created_at: token.createdAt,
    virtual_eth_reserves: token.virtualEthReserves,
    virtual_token_reserves: token.virtualTokenReserves,
    real_eth_reserves: token.realEthReserves,
    real_token_reserves: token.realTokenReserves,
    graduated: token.graduated,
    source: token.source,
    tx_hash: token.txHash ?? null,
    metadata: token.metadata ?? {},
  };
}

function rowToTrade(row: TradeRow): TradeRecord {
  return {
    id: row.id,
    tokenAddress: row.token_address,
    trader: row.trader,
    isBuy: row.is_buy,
    ethAmount: row.eth_amount,
    tokenAmount: row.token_amount,
    price: row.price,
    feeEth: row.fee_eth,
    timestamp: row.timestamp,
  };
}

function tradeToRow(trade: TradeRecord): TradeRow {
  return {
    id: trade.id,
    token_address: trade.tokenAddress,
    trader: trade.trader,
    is_buy: trade.isBuy,
    eth_amount: trade.ethAmount,
    token_amount: trade.tokenAmount,
    price: trade.price,
    fee_eth: trade.feeEth,
    timestamp: trade.timestamp,
  };
}

async function readSupabaseState(): Promise<PlatformState> {
  const sb = getSupabaseAdmin();
  const [tokensRes, tradesRes, platformRes] = await Promise.all([
    sb.from("pumprobin_tokens").select("*").order("created_at", { ascending: false }),
    sb.from("pumprobin_trades").select("*").order("timestamp", { ascending: false }),
    sb.from("pumprobin_platform").select("*").eq("id", 1).maybeSingle(),
  ]);

  if (tokensRes.error) throw tokensRes.error;
  if (tradesRes.error) throw tradesRes.error;

  const platform = platformRes.data;
  return {
    tokens: (tokensRes.data as TokenRow[]).map(rowToToken),
    trades: (tradesRes.data as TradeRow[]).map(rowToTrade),
    autoLaunchEnabled: Boolean(platform?.auto_launch_enabled),
    lastAutoLaunch: platform?.last_auto_launch ?? null,
    createdAt: platform?.created_at ?? emptyState().createdAt,
    updatedAt: platform?.updated_at ?? emptyState().updatedAt,
  };
}

/* ─── Public API (same signatures as before) ─── */

export async function readPlatformState(): Promise<PlatformState> {
  if (isSupabaseConfigured()) {
    try {
      return await readSupabaseState();
    } catch (err) {
      console.error("[registry] Supabase read failed, falling back to file:", err);
      return readFileState();
    }
  }
  return readFileState();
}

export async function writePlatformState(state: PlatformState): Promise<void> {
  if (!isSupabaseConfigured()) {
    await writeFileState(state);
    return;
  }

  // Prefer granular helpers (addToken/addTrade/updateTokenCurve). Full rewrite is for file mode.
  await writeFileState(state);
}

export function newTokenRecord(input: {
  name: string;
  symbol: string;
  imageUri: string;
  description: string;
  creator: string;
  address?: string;
  bondingCurve?: string;
  source?: "registry" | "onchain";
  txHash?: string;
  metadata?: LaunchMetadata;
}): TokenRecord {
  const id = Date.now().toString(16);
  const supply = Math.max(1, Math.min(1e15, input.metadata?.supply ?? DEFAULT_SUPPLY));
  const virtualEth = virtualEthForSupply(supply);
  const virtualTokens = virtualTokensForSupply(supply);
  const metadata: LaunchMetadata = {
    ...(input.metadata ?? {}),
    supply,
    decimals: input.metadata?.decimals ?? 18,
  };
  return {
    address: (input.address ?? (`0x${id.padStart(40, "0")}`)).toLowerCase(),
    bondingCurve: (
      input.bondingCurve ??
      (`0x${(BigInt(`0x${id}`) + BigInt(1)).toString(16).padStart(40, "0")}`)
    ).toLowerCase(),
    name: input.name,
    symbol: input.symbol.toUpperCase(),
    imageUri:
      input.imageUri ||
      process.env.NEXT_PUBLIC_PLATFORM_LOGO_IPFS ||
      "/brand/pumprobin-logo.png",
    description: input.description,
    creator: input.creator.toLowerCase(),
    createdAt: new Date().toISOString(),
    virtualEthReserves: virtualEth,
    virtualTokenReserves: virtualTokens,
    realEthReserves: 0,
    realTokenReserves: virtualTokens,
    graduated: false,
    source: input.source ?? "registry",
    txHash: input.txHash,
    metadata,
  };
}

export async function addToken(
  input: Parameters<typeof newTokenRecord>[0]
): Promise<TokenRecord> {
  const token = newTokenRecord(input);

  if (isSupabaseConfigured()) {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("pumprobin_tokens").insert(tokenToRow(token));
    if (error) {
      console.error("[registry] Supabase insert token failed:", error);
      throw new Error(error.message);
    }
    return token;
  }

  const state = await readFileState();
  state.tokens.unshift(token);
  await writeFileState(state);
  return token;
}

export async function addTrade(trade: TradeRecord): Promise<PlatformState> {
  if (isSupabaseConfigured()) {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("pumprobin_trades").insert(tradeToRow(trade));
    if (error) {
      console.error("[registry] Supabase insert trade failed:", error);
      throw new Error(error.message);
    }
    return readSupabaseState();
  }

  const state = await readFileState();
  state.trades.unshift(trade);
  await writeFileState(state);
  return state;
}

export async function updateTokenCurve(
  address: string,
  patch: Partial<
    Pick<
      TokenRecord,
      | "virtualEthReserves"
      | "virtualTokenReserves"
      | "realEthReserves"
      | "realTokenReserves"
      | "graduated"
    >
  >
): Promise<TokenRecord | null> {
  if (isSupabaseConfigured()) {
    const sb = getSupabaseAdmin();
    const rowPatch: Record<string, unknown> = {};
    if (patch.virtualEthReserves !== undefined)
      rowPatch.virtual_eth_reserves = patch.virtualEthReserves;
    if (patch.virtualTokenReserves !== undefined)
      rowPatch.virtual_token_reserves = patch.virtualTokenReserves;
    if (patch.realEthReserves !== undefined) rowPatch.real_eth_reserves = patch.realEthReserves;
    if (patch.realTokenReserves !== undefined)
      rowPatch.real_token_reserves = patch.realTokenReserves;
    if (patch.graduated !== undefined) rowPatch.graduated = patch.graduated;

    const { data, error } = await sb
      .from("pumprobin_tokens")
      .update(rowPatch)
      .eq("address", address.toLowerCase())
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[registry] Supabase update token failed:", error);
      throw new Error(error.message);
    }
    return data ? rowToToken(data as TokenRow) : null;
  }

  const state = await readFileState();
  const idx = state.tokens.findIndex(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
  if (idx < 0) return null;
  state.tokens[idx] = { ...state.tokens[idx], ...patch };
  await writeFileState(state);
  return state.tokens[idx];
}

export async function setAutoLaunch(enabled: boolean): Promise<PlatformState> {
  if (isSupabaseConfigured()) {
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("pumprobin_platform")
      .update({
        auto_launch_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) {
      console.error("[registry] Supabase setAutoLaunch failed:", error);
      throw new Error(error.message);
    }
    return readSupabaseState();
  }

  const state = await readFileState();
  state.autoLaunchEnabled = enabled;
  await writeFileState(state);
  return state;
}
