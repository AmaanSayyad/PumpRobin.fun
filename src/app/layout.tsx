import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SmoothScroll } from "@/components/smooth-scroll";
import { DataHydrator } from "@/components/data-hydrator";
import { TechnoPlayer } from "@/components/techno-player";

export const metadata: Metadata = {
  metadataBase: new URL("https://pumprobin.fun"),
  title: "PumpRobin.fun — Token launchpad on Robinhood Chain",
  description:
    "Launch, trade, and graduate memecoins on Robinhood Chain. Bonding curve mechanics with instant price discovery.",
  openGraph: {
    title: "PumpRobin.fun",
    description: "Memes, onchain — on Robinhood Chain",
    images: ["/brand/pumprobin-logo.png"],
  },
  icons: {
    icon: "/brand/pumprobin-logo-128.png",
    apple: "/brand/pumprobin-logo-256.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">
        <Providers>
          <DataHydrator>
            <SmoothScroll>
              <Navbar />
              <main className="pt-16">{children}</main>
              <Footer />
              <TechnoPlayer />
            </SmoothScroll>
          </DataHydrator>
        </Providers>
      </body>
    </html>
  );
}
