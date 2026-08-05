import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase/server";

export type AlertSubStatus = "pending" | "active" | "cancelled";

export type AlertSubscription = {
  id: string;
  wallet: string;
  telegram?: string;
  discord?: string;
  email?: string;
  txHash: string;
  paidEth: number;
  status: AlertSubStatus;
  createdAt: string;
  notes?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const ALERTS_FILE = path.join(DATA_DIR, "alert-subs.json");

async function readFileSubs(): Promise<AlertSubscription[]> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(ALERTS_FILE, "utf8");
    return JSON.parse(raw) as AlertSubscription[];
  } catch {
    return [];
  }
}

async function writeFileSubs(subs: AlertSubscription[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ALERTS_FILE, JSON.stringify(subs, null, 2));
}

type AlertRow = {
  id: string;
  wallet: string;
  telegram: string | null;
  discord: string | null;
  email: string | null;
  tx_hash: string;
  paid_eth: number;
  status: string;
  created_at: string;
  notes: string | null;
};

function rowToSub(row: AlertRow): AlertSubscription {
  return {
    id: row.id,
    wallet: row.wallet,
    telegram: row.telegram ?? undefined,
    discord: row.discord ?? undefined,
    email: row.email ?? undefined,
    txHash: row.tx_hash,
    paidEth: row.paid_eth,
    status: (row.status as AlertSubStatus) || "pending",
    createdAt: row.created_at,
    notes: row.notes ?? undefined,
  };
}

export async function addAlertSubscription(
  input: Omit<AlertSubscription, "id" | "createdAt" | "status"> & {
    status?: AlertSubStatus;
  }
): Promise<AlertSubscription> {
  const sub: AlertSubscription = {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    wallet: input.wallet.toLowerCase(),
    telegram: input.telegram?.trim() || undefined,
    discord: input.discord?.trim() || undefined,
    email: input.email?.trim() || undefined,
    txHash: input.txHash,
    paidEth: input.paidEth,
    status: input.status ?? "pending",
    createdAt: new Date().toISOString(),
    notes: input.notes,
  };

  if (isSupabaseConfigured()) {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("pumprobin_alert_subs").insert({
      id: sub.id,
      wallet: sub.wallet,
      telegram: sub.telegram ?? null,
      discord: sub.discord ?? null,
      email: sub.email ?? null,
      tx_hash: sub.txHash,
      paid_eth: sub.paidEth,
      status: sub.status,
      created_at: sub.createdAt,
      notes: sub.notes ?? null,
    });
    if (error) {
      console.error("[alerts] Supabase insert failed:", error);
      throw new Error(error.message);
    }
    return sub;
  }

  const list = await readFileSubs();
  list.unshift(sub);
  await writeFileSubs(list);
  return sub;
}

export async function listAlertSubscriptions(wallet?: string): Promise<AlertSubscription[]> {
  if (isSupabaseConfigured()) {
    const sb = getSupabaseAdmin();
    let q = sb
      .from("pumprobin_alert_subs")
      .select("*")
      .order("created_at", { ascending: false });
    if (wallet) q = q.eq("wallet", wallet.toLowerCase());
    const { data, error } = await q;
    if (error) {
      console.error("[alerts] Supabase list failed:", error);
      throw new Error(error.message);
    }
    return ((data as AlertRow[]) ?? []).map(rowToSub);
  }

  const list = await readFileSubs();
  if (!wallet) return list;
  const w = wallet.toLowerCase();
  return list.filter((s) => s.wallet === w);
}
