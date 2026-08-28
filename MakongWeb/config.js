/**
 * Makong Network — site configuration
 * Edit the values below to customize the site. Nothing else in /js needs to change
 * for basic rebranding, price changes, or link updates.
 */
window.MAKONG_CONFIG = {
  site: {
    name: "Makong Network",
    tagline: "Cambodia's #1 Minecraft Community",
    taglineKh: "ម៉ាខុង នេតវឺក — ម្ចាស់ផ្ទះម៉ាញ់ក្រាហ្វសំរាប់ជនជាតិខ្មែរ",
    url: "https://makong.net",
  },

  // Java + Bedrock connection info shown on the homepage
  server: {
    javaIp: "play.makong.net",
    javaPort: 25565,
    bedrockIp: "play.makong.net",
    bedrockPort: 19132,
    version: "1.21.x (Java & Bedrock via Geyser)",
    // Used by main.js to query a live status API (mcsrvstat.us — free, no key, CORS enabled).
    statusApiJava: "https://api.mcsrvstat.us/3/play.makong.net:25565",
  },

  links: {
    discord: "https://discord.gg/makong",
    telegram: "https://t.me/MakongNetwork",
    telegramBot: "https://t.me/MakongStoreBot",
    facebook: "https://facebook.com/MakongNetwork",
    tebex: "https://makong.tebex.io/",
  },

  // KHQR / Bakong merchant info — REQUIRED for real payments.
  // See MakongWeb/README.md → "Connecting real KHQR payments" for what to fill in here
  // once you have a Bakong merchant account. Until then the store runs in demo mode.
  khqr: {
    demoMode: true,
    merchantName: "MAKONG NETWORK",
    merchantCity: "Phnom Penh",
    // exchange rate used only to *display* an approximate USD price next to KHR, not for payment math
    usdToKhr: 4100,
  },

  store: {
    ranks: [
      {
        id: "rank-vip",
        name: "VIP",
        priceKhr: 20000,
        badge: "",
        perks: ["/kit vip daily", "Colored chat tag", "2 extra homes", "VIP-only cosmetics"],
      },
      {
        id: "rank-mvp",
        name: "MVP",
        priceKhr: 45000,
        badge: "Popular",
        perks: ["Everything in VIP", "/fly in hub", "5 extra homes", "Priority queue", "MVP particle trail"],
      },
      {
        id: "rank-elite",
        name: "ELITE",
        priceKhr: 85000,
        badge: "",
        perks: ["Everything in MVP", "/nick + /hat", "10 extra homes", "Elite-only kit & pet"],
      },
      {
        id: "rank-legend",
        name: "LEGEND",
        priceKhr: 165000,
        badge: "Best Value",
        perks: ["Everything in ELITE", "Unlimited homes", "Custom join message", "Legend-only cosmetic set"],
      },
    ],
    coins: [
      { id: "coins-500", name: "500 Coins", priceKhr: 8000, perks: ["500 Makong Coins"] },
      { id: "coins-1200", name: "1,200 Coins", priceKhr: 18000, perks: ["1,200 Makong Coins", "+50 bonus"] },
      { id: "coins-2500", name: "2,500 Coins", priceKhr: 35000, perks: ["2,500 Makong Coins", "+200 bonus"] },
      { id: "coins-6000", name: "6,000 Coins", priceKhr: 75000, perks: ["6,000 Makong Coins", "+750 bonus"] },
    ],
  },
};
