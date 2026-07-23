"use client";

import { create } from "zustand";
import type { TokenData, PlatformStats, TradeData } from "./data";
import { EMPTY_STATS, deserializeTrade } from "./data";

interface AppStore {
  tokens: TokenData[];
  trades: TradeData[];
  stats: PlatformStats;
  loading: boolean;
  hydrated: boolean;
  setFromApi: (payload: {
    tokens: TokenData[];
    trades?: TradeData[];
    stats?: PlatformStats;
  }) => void;
  refreshTokens: () => Promise<void>;
  addToken: (token: TokenData) => void;
  upsertToken: (token: TokenData) => void;
  addTradeLocal: (trade: TradeData, token: TokenData) => void;
}

function revivetoken(t: TokenData): TokenData {
  return {
    ...t,
    createdAt: t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt),
  };
}

export const useAppStore = create<AppStore>((set, get) => ({
  tokens: [],
  trades: [],
  stats: EMPTY_STATS,
  loading: false,
  hydrated: false,

  setFromApi: ({ tokens, trades, stats }) => {
    set({
      tokens: tokens.map(revivetoken),
      trades: (trades ?? get().trades).map((t) =>
        t.timestamp instanceof Date ? t : deserializeTrade(t as never)
      ),
      stats: stats ?? get().stats,
      hydrated: true,
      loading: false,
    });
  },

  refreshTokens: async () => {
    set({ loading: true });
    try {
      const [tokensRes, statsRes] = await Promise.all([
        fetch("/api/tokens"),
        fetch("/api/platform/stats"),
      ]);
      const tokensJson = await tokensRes.json();
      const statsJson = await statsRes.json();
      get().setFromApi({
        tokens: tokensJson.tokens ?? [],
        trades: tokensJson.trades ?? [],
        stats: statsJson.stats ?? EMPTY_STATS,
      });
    } catch {
      set({ loading: false, hydrated: true });
    }
  },

  addToken: (token) =>
    set((state) => {
      const tokens = [revivetoken(token), ...state.tokens];
      return {
        tokens,
        stats: {
          ...state.stats,
          totalTokens: tokens.length,
        },
      };
    }),

  upsertToken: (token) =>
    set((state) => {
      const revived = revivetoken(token);
      const exists = state.tokens.findIndex(
        (t) => t.address.toLowerCase() === revived.address.toLowerCase()
      );
      const tokens =
        exists >= 0
          ? state.tokens.map((t, i) => (i === exists ? revived : t))
          : [revived, ...state.tokens];
      return { tokens };
    }),

  addTradeLocal: (trade, token) =>
    set((state) => {
      const trades = [trade, ...state.trades];
      const tokens = state.tokens.map((t) =>
        t.address.toLowerCase() === token.address.toLowerCase()
          ? revivetoken(token)
          : t
      );
      return { trades, tokens };
    }),
}));
