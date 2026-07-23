"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function isOverlayScrollTarget(node: HTMLElement) {
  return Boolean(
    node.closest(
      [
        "[data-rk]",
        '[role="dialog"]',
        "[data-radix-portal]",
        "[data-floating-ui-portal]",
      ].join(",")
    )
  );
}

function isWalletModalOpen() {
  return Boolean(
    document.querySelector(
      '[data-rk] [role="dialog"], [data-rk] [aria-modal="true"]'
    )
  );
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
      // Let RainbowKit / dialogs use native scroll instead of page Lenis
      prevent: isOverlayScrollTarget,
      allowNestedScroll: true,
    });

    lenis.on("scroll", ScrollTrigger.update);
    const onTick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    const syncModalScrollLock = () => {
      if (isWalletModalOpen()) {
        lenis.stop();
        document.documentElement.style.overflow = "hidden";
      } else {
        lenis.start();
        document.documentElement.style.overflow = "";
      }
    };

    const observer = new MutationObserver(syncModalScrollLock);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "style", "class"],
    });
    syncModalScrollLock();

    return () => {
      observer.disconnect();
      document.documentElement.style.overflow = "";
      lenis.destroy();
      gsap.ticker.remove(onTick);
    };
  }, []);

  return <>{children}</>;
}
