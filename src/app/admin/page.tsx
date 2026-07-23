"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { RhButton } from "@/components/ui/rh-button";
import { BrandMark } from "@/components/brand-mark";
import { formatEth, formatNumber, timeAgo } from "@/lib/utils";
import { RefreshCw, LogOut } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AdminData {
  autoLaunchEnabled: boolean;
  autoLaunchInterval: number;
  lastAutoLaunch: string | null;
  nextAutoLaunch: string | null;
  systemHealth: "healthy" | "degraded" | "down";
  hourlyStats: Array<{ hour: string; launches: number; volume: number; trades: number }>;
  stats?: {
    totalTokens: number;
    volume24h: number;
    activeTraders: number;
    feesCollected: number;
    graduatedTokens: number;
    totalTrades: number;
    avgGraduationTime: number | null;
  };
}

export default function AdminPage() {
  const { stats, tokens, refreshTokens } = useAppStore();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);

  const checkSession = useCallback(async () => {
    const res = await fetch("/api/admin/session");
    const data = await res.json();
    setConfigured(data.configured !== false);
    setAuthed(Boolean(data.authenticated));
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const data = await res.json();
      setAdminData(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (authed) void loadStats();
  }, [authed, loadStats]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      setPassword("");
      setAuthed(true);
    } catch {
      setError("Network error");
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
    setAdminData(null);
  };

  const toggleAutoLaunch = async () => {
    const res = await fetch("/api/admin/auto-launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !adminData?.autoLaunchEnabled }),
    });
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    const data = await res.json();
    setAdminData((prev) => (prev ? { ...prev, ...data } : prev));
  };

  if (authed === null) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-rh-muted">
        <RefreshCw className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-5">
        <form onSubmit={login} className="w-full max-w-sm text-center">
          <div className="mb-4 flex justify-center">
            <BrandMark
              href={false}
              size={36}
              textClassName="text-sm text-rh-muted"
            />
          </div>
          <h1 className="rh-display text-4xl mb-3">Admin</h1>
          <p className="text-rh-muted text-sm mb-8">
            {configured
              ? "Enter the admin password to continue."
              : "Set ADMIN_PASSWORD in .env.local first."}
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            disabled={!configured}
            className="w-full px-4 py-3.5 bg-rh-surface border border-rh-raised rounded-full text-center text-white placeholder:text-rh-dim focus:outline-none focus:border-rh-lime mb-4"
          />
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <RhButton type="submit" className="w-full" disabled={!configured || loggingIn || !password}>
            {loggingIn ? "Checking…" : "Continue"}
          </RhButton>
        </form>
      </div>
    );
  }

  const s = adminData?.stats ?? stats;

  return (
    <div className="rh-container py-10 pb-24">
      <div className="flex items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="rh-display text-4xl mb-1">Admin</h1>
          <p className="text-rh-muted text-sm">Platform operations · PumpRobin.fun</p>
        </div>
        <div className="flex items-center gap-2">
          <RhButton
            variant="ghost"
            size="sm"
            onClick={() => {
              void refreshTokens();
              void loadStats();
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </RhButton>
          <RhButton variant="outline" size="sm" onClick={logout}>
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </RhButton>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rh-raised mb-10">
        {[
          { label: "Tokens", value: String(s.totalTokens) },
          { label: "24h volume", value: `${formatEth(s.volume24h)} ETH` },
          { label: "Traders 24h", value: String(s.activeTraders) },
          { label: "Fees", value: `${formatEth(s.feesCollected)} ETH` },
        ].map((item) => (
          <div key={item.label} className="bg-black p-6">
            <p className="text-xs text-rh-muted uppercase tracking-wider mb-2">{item.label}</p>
            <p className="rh-display text-3xl">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-10">
        <div className="bg-rh-surface border border-rh-raised p-6">
          <h3 className="font-medium mb-2">Auto-launch</h3>
          <p className="text-sm text-rh-muted mb-6">
            Create a token every {adminData?.autoLaunchInterval ?? 5} minutes. Future work —
            requires factory deploy + cron.
          </p>
          <div className="space-y-2 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-rh-muted">Status</span>
              <span>{adminData?.autoLaunchEnabled ? "Enabled" : "Disabled"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-rh-muted">Last run</span>
              <span>
                {adminData?.lastAutoLaunch
                  ? timeAgo(new Date(adminData.lastAutoLaunch))
                  : "Never"}
              </span>
            </div>
          </div>
          <RhButton
            variant={adminData?.autoLaunchEnabled ? "outline" : "primary"}
            size="sm"
            className="w-full"
            onClick={toggleAutoLaunch}
          >
            {adminData?.autoLaunchEnabled ? "Disable" : "Enable"}
          </RhButton>
        </div>

        <div className="lg:col-span-2 bg-rh-surface border border-rh-raised p-6">
          <h3 className="font-medium mb-4">Hourly activity (24h)</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={adminData?.hourlyStats || []}>
                <XAxis dataKey="hour" tick={{ fill: "#4d4a46", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#4d4a46", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#000000",
                    border: "1px solid #322f2f",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="volume" stroke="#ccff00" fill="#ccff0022" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-rh-surface border border-rh-raised overflow-hidden">
        <div className="px-6 py-4 border-b border-rh-raised">
          <h3 className="font-medium">Recent launches</h3>
        </div>
        {tokens.length === 0 ? (
          <p className="p-8 text-sm text-rh-muted text-center">No tokens launched yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-rh-dim uppercase tracking-wider border-b border-rh-raised">
                <th className="text-left py-3 px-6">Token</th>
                <th className="text-right py-3 px-6">MCap</th>
                <th className="text-right py-3 px-6">Progress</th>
                <th className="text-right py-3 px-6">Created</th>
              </tr>
            </thead>
            <tbody>
              {tokens.slice(0, 20).map((t) => (
                <tr key={t.address} className="border-b border-rh-raised/60">
                  <td className="py-3 px-6">
                    {t.name} <span className="text-rh-muted">${t.symbol}</span>
                  </td>
                  <td className="py-3 px-6 text-right tabular-nums">{formatEth(t.marketCap)} ETH</td>
                  <td className="py-3 px-6 text-right text-rh-lime">{t.progress.toFixed(0)}%</td>
                  <td className="py-3 px-6 text-right text-rh-muted">{timeAgo(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-rh-dim mt-8 text-center">
        Graduated {s.graduatedTokens} · Trades {formatNumber(s.totalTrades, 0)} · Avg graduation{" "}
        {s.avgGraduationTime == null ? "—" : `${s.avgGraduationTime}h`}
      </p>
    </div>
  );
}
