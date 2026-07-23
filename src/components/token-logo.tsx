"use client";

import { cn } from "@/lib/utils";

type TokenLogoProps = {
  src?: string | null;
  alt: string;
  symbol?: string;
  className?: string;
};

/** Prefer raw <img> for IPFS/Pinata — Next Image optimizer often breaks remote IPFS URLs. */
export function TokenLogo({ src, alt, symbol, className }: TokenLogoProps) {
  const fallback = (symbol || alt || "?").slice(0, 3).toUpperCase();

  if (!src) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-rh-raised text-xs text-rh-dim",
          className
        )}
      >
        {fallback}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn("h-full w-full object-cover", className)}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(e) => {
        const el = e.currentTarget;
        el.style.display = "none";
        const parent = el.parentElement;
        if (parent && !parent.querySelector("[data-logo-fallback]")) {
          const span = document.createElement("span");
          span.dataset.logoFallback = "1";
          span.className =
            "flex h-full w-full items-center justify-center text-xs text-rh-dim";
          span.textContent = fallback;
          parent.appendChild(span);
        }
      }}
    />
  );
}
