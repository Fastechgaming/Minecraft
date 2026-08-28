# Makong Network Website

A static website for **Makong Network**, a Cambodian Minecraft server. Home page with
live player count/server info, and a store for ranks/coins with region-based checkout:

- **🌍 Global** shoppers are sent to the existing Tebex store: `https://makong.tebex.io/`
- **🇰🇭 Cambodia** shoppers stay on-site and pay with **KHQR**, with delivery approved
  through **Telegram**.

No build step — plain HTML/CSS/JS. Open `index.html` directly or serve the folder with
any static host (GitHub Pages, Netlify, Vercel, nginx, etc).

**Design:** a forest/river nature theme (rolling canopy skylines, a river-wave divider,
drifting leaves, and hand-drawn nature icons — sprout, owl, bird, fish, dragonfly,
butterfly) with a light/dark toggle in the navbar. The toggle stores its choice in
`localStorage`; with no stored choice it follows the visitor's OS theme automatically.
All colors are CSS custom properties in `css/style.css` (`:root` = light, `[data-theme="dark"]`
= dark), so re-theming or adjusting the palette only means editing the variables at the
top of that file.

## Structure

```
MakongWeb/
├── index.html      Home page (server info, live player count)
├── store.html       Store (region select, ranks/coins, checkout)
├── config.js         All editable settings (server IP, links, prices)
├── css/style.css     Styling
├── js/main.js        Shared nav/footer/status logic (both pages)
└── js/store.js        Store + checkout flow (store.html only)
```

## Configuring your server

Edit **`config.js`**:

- `server.javaIp` / `server.javaPort` — shown on the homepage and used for the copy-IP
  button.
- `server.statusApiJava` — the live status endpoint. By default this uses the free,
  no-key, CORS-enabled [mcsrvstat.us](https://api.mcsrvstat.us/) API:
  `https://api.mcsrvstat.us/3/<ip>:<port>`. Update the IP/port in that URL to match
  your real server.
- `links.discord` / `links.telegram` / `links.facebook` — your community links.
- `links.tebex` — already set to `https://makong.tebex.io/` for the Global checkout
  redirect.
- `links.telegramBot` — the Telegram bot/admin chat buyers are sent to for delivery
  approval (defaults to `https://t.me/MakongStoreBot`).
- `store.ranks` / `store.coins` — your catalog. Each item needs `id`, `name`,
  `priceKhr`, `perks[]`, and optionally a `badge`.

## The Cambodia checkout flow (KHQR + Telegram)

1. Shopper picks **Cambodia** in the region modal on `store.html`.
2. They pick a rank/coin item and enter their in-game name + Telegram username.
3. A KHQR code is generated for the order (see **Demo mode** below).
4. After paying, they tap **"I've Paid"**, then **"Send to Telegram for Approval"** —
   this opens a Telegram deep link (`t.me/<bot>?start=<orderId>&text=...`) prefilled
   with their order ID, item, and IGN so an admin (or bot) can verify the payment
   screenshot and deliver the purchase in-game.

### ⚠️ Demo mode — connecting real KHQR payments

`config.js` ships with `khqr.demoMode = true`. The QR code rendered in the checkout
modal is a **placeholder** (`js/store.js` → `renderQr()`) — it encodes a JSON blob for
demonstration only, it is **not** a real payable KHQR/EMV code. To accept real payments:

1. Register a merchant account with **Bakong** (National Bank of Cambodia) or a partner
   PSP that issues KHQR strings (e.g. ABA, ACLEDA, Wing).
2. Stand up a small backend endpoint that, given an order (amount + reference), calls
   your PSP's API to generate a real KHQR string and a transaction reference/MD5.
3. In `js/store.js`, replace the `demoPayload` in `renderQr()` with the real KHQR
   string returned by your backend, and render that string with the existing
   `QRCode.toCanvas` call.
4. Replace the manual **"I've Paid"** button with polling against your backend's
   "check transaction status" endpoint (most Cambodian PSPs offer one) so delivery
   only proceeds once payment is confirmed server-side — the current build treats
   Telegram admin approval as the source of truth, which is fine for a small server
   but doesn't protect against a buyer clicking "I've Paid" without paying.
5. Point `links.telegramBot` at your real bot. A simple bot can watch for incoming
   `/start <orderId>` messages + a photo, then let an admin approve/deny (e.g. inline
   buttons) before running your in-game delivery command (RCON, a plugin webhook, etc).
   That part is server-side and out of scope for this static site.

## Live player count

`js/main.js` polls `server.statusApiJava` every 30 seconds and updates the status dot,
player count, and version text on the homepage. If your host is offline or the API is
unreachable, the UI falls back to an "Offline" / "Status unavailable" state instead of
breaking.

## Deploying

Any static host works. For GitHub Pages from this repo, for example, you could publish
the `MakongWeb/` folder as the Pages source (or copy its contents to a `docs/` folder /
separate `gh-pages` branch, depending on your Pages settings).
