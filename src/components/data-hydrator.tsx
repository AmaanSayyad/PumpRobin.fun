"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

/** Hydrates the app store from the real platform registry once on mount. */
export function DataHydrator({ children }: { children: React.ReactNode }) {
  const refreshTokens = useAppStore((s) => s.refreshTokens);
  const hydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) {
      void refreshTokens();
    }
  }, [hydrated, refreshTokens]);

  return <>{children}</>;
}
