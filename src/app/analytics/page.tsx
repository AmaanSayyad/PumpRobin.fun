"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAppStore } from "@/lib/store";
import { formatEth, formatNumber } from "@/lib/utils";
import { MediaFrame, SplitBlock } from "@/components/ui/media-frame";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface AnalyticsPayload {
  stats: {
    totalVolume: number;
    totalTrades: number;
    feesCollected: number;
    avgGraduationTime: number | null;
    totalTokens: number;
    activeTraders: number;
    graduatedTokens: number;
  };
  volumeSeries: Array<{ day: string; volume: number; tokens: number }>;
  graduationSeries: Array<{ day: string; graduated: number }>;
}

export default function AnalyticsPage() {
  const storeStats = useAppStore((s) => s.stats);
  const [data, setData] = useState<AnalyticsPayload | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const stats = data?.stats ?? storeStats;
  const volumeSeries = data?.volumeSeries ?? [];
  const graduationSeries = data?.graduationSeries ?? [];
  const gradRate =
    stats.totalTokens > 0
      ? (stats.graduatedTokens / stats.totalTokens) * 100
      : 0;

  return (
    <div className="bg-black">
      {/* Strategies insights video hero */}
      <section className="relative min-h-[50vh] sm:min-h-[58vh] flex items-end overflow-hidden">
        <div className="absolute inset-0 bg-black">
          <video
            className="absolute inset-0 hidden h-full w-full object-cover md:block"
            autoPlay
            muted
            loop
            playsInline
            poster="/brand/strategies/insights-poster.jpg"
          >
            <source src="/brand/strategies/insights-desktop.webm" type="video/webm" />
          </video>
          <video
            className="absolute inset-0 h-full w-full object-cover md:hidden"
            autoPlay
            muted
            loop
            playsInline
            poster="/brand/strategies/insights-poster.jpg"
          >
            <source src="/brand/strategies/insights-mobile.webm" type="video/webm" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/25" />
        </div>
        <div className="relative z-10 rh-container py-14 sm:py-16">
          <h1 className="rh-display text-4xl sm:text-5xl lg:text-6xl text-white mb-3">
            Analytics
          </h1>
          <p className="text-white/70 text-lg max-w-lg">
            Live metrics from real launches and trades on PumpRobin.fun.
          </p>
        </div>
      </section>

      <div className="rh-container py-12 sm:py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rh-raised mb-10">
          {[
            { label: "Total volume", value: `${formatEth(stats.totalVolume)} ETH` },
            { label: "Trades", value: formatNumber(stats.totalTrades, 0) },
            { label: "Fees", value: `${formatEth(stats.feesCollected)} ETH` },
            {
              label: "Avg graduation",
              value:
                stats.avgGraduationTime == null ? "—" : `${stats.avgGraduationTime}h`,
            },
          ].map((s) => (
            <div key={s.label} className="bg-black p-6">
              <p className="text-xs text-rh-muted uppercase tracking-wider mb-2">{s.label}</p>
              <p className="rh-display text-2xl sm:text-3xl">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-10">
          <div className="border border-rh-raised p-6">
            <h3 className="font-medium mb-4">14-day volume (ETH)</h3>
            <div className="h-56">
              {volumeSeries.every((d) => d.volume === 0) ? (
                <p className="text-sm text-rh-dim h-full flex items-center justify-center">
                  No volume yet
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeSeries}>
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "#4d4a46", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#4d4a46", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#000000",
                        border: "1px solid #2a2a2a",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="volume" fill="#ccff00" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="border border-rh-raised p-6">
            <h3 className="font-medium mb-4">Graduations (week)</h3>
            <div className="h-56">
              {graduationSeries.every((d) => d.graduated === 0) ? (
                <p className="text-sm text-rh-dim h-full flex items-center justify-center">
                  No graduations yet
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graduationSeries}>
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "#4d4a46", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#4d4a46", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#000000",
                        border: "1px solid #2a2a2a",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="graduated"
                      stroke="#ccff00"
                      strokeWidth={1.5}
                      dot={{ fill: "#ccff00", r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-px bg-rh-raised mb-16">
          {[
            { label: "Tokens launched", value: String(stats.totalTokens) },
            { label: "Active traders 24h", value: String(stats.activeTraders) },
            { label: "Graduation rate", value: `${gradRate.toFixed(1)}%` },
          ].map((m) => (
            <div key={m.label} className="bg-black p-6 text-center">
              <p className="rh-display text-3xl mb-1">{m.value}</p>
              <p className="text-xs text-rh-muted">{m.label}</p>
            </div>
          ))}
        </div>

        <SplitBlock
          copy={
            <>
              <h2 className="rh-display text-3xl sm:text-4xl mb-4">
                Built for the next generation of onchain traders
              </h2>
              <p className="text-rh-muted leading-relaxed max-w-md">
                Every chart on this page is fed by real launches and trades —
                volume, fees, and graduations as they happen on Robinhood Chain.
              </p>
            </>
          }
          media={
            <MediaFrame aspect="video">
              <Image
                src="/brand/strategies/team.jpg"
                alt=""
                fill
                className="object-cover"
                sizes="(max-width:1024px) 100vw, 50vw"
              />
            </MediaFrame>
          }
        />
      </div>
    </div>
  );
}
