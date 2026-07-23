"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RhButton } from "@/components/ui/rh-button";
import { BrandMark } from "@/components/brand-mark";
import { WalletButton } from "@/components/wallet-button";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/trade", label: "Trade" },
  { href: "/tokens", label: "Tokens" },
  { href: "/launch", label: "Launch" },
  { href: "/earn", label: "Earn" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/docs", label: "Docs" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-black">
      <div className="rh-container flex h-16 items-center justify-between gap-2 sm:gap-4">
        <BrandMark
          size={28}
          className="min-w-0"
          textClassName="hidden text-[15px] text-white min-[420px]:inline"
        />

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <WalletButton className="max-w-[10.5rem] sm:max-w-none" />
          <RhButton href="/launch" size="sm" className="hidden shrink-0 sm:inline-flex">
            Launch
          </RhButton>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Menu"}
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-1.5 text-white"
          >
            {open ? (
              <X className="h-5 w-5" strokeWidth={1.5} />
            ) : (
              <>
                <span className="block h-[2px] w-5 rounded-full bg-white" />
                <span className="block h-[2px] w-5 rounded-full bg-white" />
              </>
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-rh-on-lime/15 bg-rh-lime text-rh-on-lime">
          <nav className="rh-container py-4 flex flex-col">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "py-3.5 text-[17px] font-medium border-b border-rh-on-lime/10 last:border-0",
                  pathname === item.href ? "text-rh-on-lime" : "text-rh-on-lime/90"
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-5 sm:hidden">
              <WalletButton tone="light" />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
