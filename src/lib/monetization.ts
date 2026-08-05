/**
 * PumpRobin monetization playbook — platform revenue beyond the base curve fee.
 * Featured boost is live in the launch flow; others are product roadmap.
 */
export const MONETIZATION_LIVE = [
  {
    id: "curve-fee",
    title: "Bonding-curve platform fee",
    body: "0.3% of every buy/sell on the curve (plus 1% to creators). Scales with volume.",
  },
  {
    id: "creation-fee",
    title: "Creation fee",
    body: "0.0005 ETH per launch — covers spam resistance and collector ops.",
  },
  {
    id: "feature-boost",
    title: "Explore feature boost",
    body: "Paid pin on Explore Featured for 7 days (~$100 in ETH). Highest-intent creator spend.",
  },
  {
    id: "alerts-sub",
    title: "Telegram / Discord alerts",
    body: "Paid subscription (~$50 / 30 days). Manual onboarding by ops into alert feeds.",
  },
] as const;

export const MONETIZATION_ROADMAP = [
  {
    id: "spotlight-24h",
    title: "24h homepage spotlight",
    body: "Premium slot above the fold on Explore / home — scarce inventory, higher price.",
  },
  {
    id: "banner-ads",
    title: "Explore banner / takeover",
    body: "Sold weekly to launches or partners (image + link). CPM or flat rate.",
  },
  {
    id: "verified-badge",
    title: "Verified / KYC badge",
    body: "Optional identity check for creators — trust signal traders pay attention to.",
  },
  {
    id: "promo-pack",
    title: "Launch promo pack",
    body: "Bundle: feature + social blast template + DEX Screener profile assist.",
  },
  {
    id: "api-access",
    title: "Trader / bot API tiers",
    body: "Rate-limited free API; paid keys for sniper bots, dashboards, and indexers.",
  },
  {
    id: "alerts",
    title: "Telegram / Discord alerts",
    body: "Live as paid subscription with manual fulfillment — see /alerts.",
  },
  {
    id: "grad-lp-share",
    title: "Post-grad LP fee share",
    body: "When Uniswap LP fees are claimable, take a platform cut of unlocked trading fees.",
  },
  {
    id: "points-boost",
    title: "Points / referral boosts",
    body: "Creators buy points multipliers; referrers earn a cut of creation + feature fees.",
  },
  {
    id: "agency",
    title: "Managed launch (white-glove)",
    body: "High-ticket: creative, timing, feature, and go-to-market for serious teams.",
  },
] as const;
