"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { robinhoodChain, robinhoodTestnet } from "./chain";

export const config = getDefaultConfig({
  appName: "PumpRobin.fun",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  chains: [robinhoodChain, robinhoodTestnet],
  ssr: true,
});
