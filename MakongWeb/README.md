# Makong Network Website

A self-contained Node.js + Express website for the **Makong Network** Minecraft server: home page with live server status, a webstore (Ranks/Keys/Other, split across five gamemodes) with KHQR checkout and Telegram order approval, and two ways to manage store items (a web admin panel and a Telegram bot).

This lives in its own folder (`MakongWeb/`) with its own `package.json`.

## 1. Install & run

```bash
cd MakongWeb
npm install
cp .env.example .env   # then fill in the values (see below)
npm start               # or: npm run dev (auto-restart with nodemon)
```

The site runs at `http://localhost:3000` by default (`PORT` in `.env`).

`data/items.json` and `data/orders.json` are **not** tracked in git — they're
live data the running site writes to (the admin panel/Telegram bot edit the
catalogue, checkout writes real orders), so a `git pull` on a deploy must
never touch them. `data/items.json` doesn't need to be created by hand: if
it's missing, the server seeds it from `data/items.example.json` the moment
it starts (see `lib/store.js`), so a fresh checkout or a redeploy to a new
box never comes up with an empty store. After that first seed, manage the
catalogue through the admin panel or Telegram bot, not by hand-editing the
JSON. `data/orders.json` has no seed file — a missing one just starts empty,
which is correct for order history.

## 2. What you need to fill in

Everything below lives in **`MakongWeb/.env`** (secrets) and **`MakongWeb/config/site.config.json`** (public, non-secret settings).

### `config/site.config.json`
| Field | What it is |
|---|---|
| `logo` / `logoIcon` | Path to your full logo and your icon/favicon crop. |
| `discordLink` | Your Discord invite link (used by the Home page Discord button). |
| `khqrImage` | Path to the KHQR image Cambodia customers scan to pay. Drop your own PNG in at `public/images/site/khqr.png` and point this at it. |
| `tebexUrl` | Your Tebex store URL — Global shoppers are sent here instead of checking out on-site. |
| `javaIp` / `javaPort` | Your Java server address. |
| `bedrockIp` / `bedrockPort` | Your Bedrock server address (used for the mobile "tap to join" button and for status checks if the Java ping fails). |
| `welcomeMessage`, `tagline` | Shown on the Home page. |
| `serverFeatures` | The three cards under "Welcome" on the Home page — edit `icon`/`title`/`desc` for each. |

### `.env` (copy from `.env.example`)
| Variable | Where to get it |
|---|---|
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Pick your own — used to log into `/admin`. |
| `SESSION_SECRET` | Any long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `TELEGRAM_BOT_TOKEN` | Create a bot via [@BotFather](https://t.me/BotFather) on Telegram. |
| `TELEGRAM_ADMIN_CHAT_ID` | Your personal numeric Telegram ID — message [@userinfobot](https://t.me/userinfobot) to get it. Purchase alerts and the `/additem` etc. admin commands are locked to this ID only. |
| `TELEGRAM_SUPPORT_USERNAME` | Your public support `@username` shown on the purchase-success screen. |
| `MAKONGSTORE_SECRET` | Optional — any long random string, matched in every MakongStore plugin's `config.yml`. Turns on the Servers admin page, live command delivery on Accept, and cross-server ping — see "Connecting the Minecraft plugins". |
| `MAKONGSTORE_URL` | Optional, separate from the above — only if you're also running the older single-plugin player-verify HTTP API. |
| `TEBEX_WEBSTORE_TOKEN` | Optional — Tebex Creator Panel → Webstore → Integrations → Headless API. Adds a "Pay via Tebex" (card/wallet) button on checkout, see "Purchase flow". Leave empty to skip it. |

## 3. Managing store items (3 ways — pick whichever is easiest for you)

The store is split into five **gamemodes** — Arcade, EcoSMP, BoxPvP, PlotCity,
HyperClash (edit the list in `lib/store.js`'s `GAMEMODES`). Every gamemode
sells **Ranks**; EcoSMP and BoxPvP also sell **Keys** and **Other**. Every
item belongs to exactly one gamemode (`item.gamemode`) and one category
(`item.category`) — both ways of managing items below ask for both.

1. **Web admin panel** (recommended, easiest): go to `http://your-domain/admin`, log in, and add/edit/delete items with a normal form — upload an image straight from your computer, write the description, set the price. No file editing needed.
2. **Telegram bot**: message your bot `/additem` and it'll walk you through it step by step (gamemode → category → name → price → description → info text → video link → send a photo for the image). Also supports `/listitems`, `/edititem <id> <field> <value>`, `/edititem <id> image` (then send a photo), and `/delitem <id>`. Only works for the Telegram account set as `TELEGRAM_ADMIN_CHAT_ID`.
An item can also be marked `"comingSoon": true` in `data/items.json` — it then
shows in the store as a greyed-out **Coming Soon** card that can't be bought
(the server rejects it too, not just the button).

3. **Directly edit `MakongWeb/data/items.json`** — it's a plain JSON file with `ranks`, `keys`, and `other` arrays, each item carrying a `gamemode` field. Useful for bulk edits.

All three write to the same file, so mix and match freely.

A rank's price is only ever compared against other ranks in the **same
gamemode** — EcoSMP's VIP and BoxPvP's VIP are unrelated ranks that happen to
share a name, so a rank id is `rank-<gamemode>-<slug>` (e.g. `rank-ecosmp-vip`),
not just `rank-<slug>`.

## 4. Managing rankings (`/ranking` — Top Player / Top Team)

The `/ranking` page shows two leaderboards side by side on desktop (**Top
Player** on the left, **Top Team** on the right) and stacked on mobile
(Player on top, Team below), both ranked by **Star** — the only stat this
page shows.

A player's Star count also decides their rank **tier** (M9 down to M1),
shown next to their name. Teams just show their Star total, with no tier —
the tier ladder is a player-only concept. The thresholds (edit
`tierFor()` in `public/js/ranking.js` and the matching copy in
`views/rankings.ejs` if you ever change them):

| Tier | Stars |
|---|---|
| M9 | 0 |
| M8 | 100 |
| M7 | 200 |
| M6 | 300 |
| M5 | 400 |
| M4 | 500 |
| M3 | 650 |
| M2 | 800 |
| M1 | 1,000+ |

There's no live stats feed from the Minecraft server for this (MakongStore
doesn't track Star), so it's an **admin-curated** leaderboard, same idea as
store items: go to `http://your-domain/admin/rankings`, log in, and
add/edit/delete teams and players with a form — name, an optional emoji icon
(falls back to the name's first letter), and their Star count. Or edit
`MakongWeb/data/rankings.json` directly — it's a plain JSON file with `teams`
and `players` arrays.

## 5. Purchase flow

Opening `/store` first asks the shopper to pick a region:

* **🇰🇭 Cambodia** stays on this site — KHQR payment, Telegram-approved
  delivery, everything described below. This choice is remembered for the
  rest of the browser tab (`sessionStorage`), so it isn't asked again on
  every visit within the same session.
* **🌍 Global** immediately redirects to `tebexUrl` in `config/site.config.json`
  — nothing else on this page runs for that shopper.

The store then asks for a Minecraft name **before** it shows any Buy button, so every
order already knows who it is for. Once verified, the page shows a "Logged in
as" bar with the player's rank and coins, and rank cards change state: ranks
above the one they hold read **Upgrade Now**, the one they hold is a greyed
**Your current Rank**, and anything below is a red **This is a lower rank**.
Pressing Buy opens a confirmation with the item art, the in-server name, the
edition and the price before an order is created.


Payment is **manual review** — no bank API is involved, so nothing is slow or
can time out. The customer pays your KHQR and uploads a receipt; you approve it
from Telegram with one tap.

1. Customer picks a **gamemode** tab, then a **Ranks / Keys / Other** tab, then clicks **Buy Now** (on the card, or inside the "!" info popup) → confirmation dialog → enters their Minecraft username → picks **Java** or **Bedrock**.
   - Bedrock names are normalised the way Geyser/Floodgate does it: a single leading `.` is added and spaces become `_`. So `Play er`, `.Play er` and `Play_er` all become `.Play_er` — never `..Play er`. The form shows the exact result live as **"In server name: …"**.
   - **Keys** items let the customer pick a **quantity** (1-20) right in the confirmation dialog — the price scales with it, recomputed server-side from `item.price × quantity`, never trusting the browser's total.
2. **Continue** → they land on **Complete your Purchase** (`/checkout`): a summary of what they're buying, your KHQR to scan, and a drop zone for their payment screenshot.
3. **SUBMIT** → they get a **Submit successful** page telling them to wait for the owner to confirm, with a support link and a **Back to home** button.
4. You receive a Telegram message with the receipt photo, the gamemode, the item, the price, and the in-server name, plus **✅ Accept** and **❌ Reject** buttons.
   - **Reject** → the order is marked rejected. Nothing else happens.
   - **Accept** → the bot replies with the gamemode, item, amount, player name, and that item's **delivery command** with `{player}` already filled in (e.g. `lp user .Play_er parent add ecosmp_vip`), in a tap-to-copy code block. If that item's gamemode server is currently connected via a MakongStore plugin (section 7), the command is also **run automatically** and the message says so; otherwise paste it into your server console yourself, same as always.

Each item's delivery command is configured per item — set it in the web admin
form ("Delivery command") or via `/edititem <id> deliveryCommand <command>` in
Telegram. Use `{player}` where the in-server name should go, and for a Keys
item `{quantity}` for how many they bought (e.g.
`crates give {player} common {quantity}`). Leave it blank if you'd rather
handle that item entirely by hand, with no command shown.

Payment screenshots are stored in `MakongWeb/data/proofs/` and are **not** served
publicly — they only go to your Telegram.

### Optional: pay via Tebex (card / Tebex Wallet), without leaving this site

By default the whole flow above is KHQR + manual review. If you also want
customers to pay by **card or Tebex Wallet** without ever leaving this
website (unlike the 🌍 Global region above, which sends shoppers to browse
and buy on Tebex's own storefront), set `TEBEX_WEBSTORE_TOKEN` in `.env`
(from the Tebex Creator Panel: **Webstore → Integrations → Headless API**).

This uses Tebex's **Headless API**: your own store UI stays exactly as it is,
and the customer is only sent to Tebex for its hosted checkout page, then
brought straight back. It's opt-in per item — a rank/key/other item only
gets a **Pay via Tebex** button on `/checkout` once you set its **Tebex
package ID** in the admin item form (found on the package's page in your
Tebex webstore: **Packages → edit a package → the ID in its URL**). Items
without one keep showing KHQR only.

The redirect back from Tebex is never trusted by itself — the site always
re-confirms the payment with a server-to-server call to Tebex before
marking the order **Accepted** and posting the delivery command to your
Telegram, exactly like a manually-approved KHQR order.

Leave `TEBEX_WEBSTORE_TOKEN` empty and nothing changes — no button appears
anywhere, KHQR stays the only payment method.

## 6. The player account

The name a player verifies before checkout is stored in a signed, httpOnly
cookie (`makong_player`, handled by `routes/account.js`), so:

* the store remembers who you are between visits;
* changing the name has a **60-second cooldown**, purely so nobody can hammer
  the verify endpoint.

When the MakongStore plugin's player-verify API is connected, verifying also
**checks the name really exists** on the Minecraft server and brings back the
player's UUID, live coin balance and rank(s). See "Connecting the Minecraft
plugins" below.

## 7. Connecting the Minecraft plugins (MakongStore)

`../MakongStore/` in this repo is a multi-module Gradle project with the
actual plugins that bridge this website to your Minecraft servers — a
**Paper plugin** (one instance per backend server: Arcade, EcoSMP, BoxPvP,
PlotCity, HyperClash…) and a **Velocity plugin** (one instance on your
proxy), both built the same way (`./gradlew build` in `../MakongStore/`,
using the bundled wrapper) and documented in its own README. The website
works fine with none, some, or all of them running.

There are two independent things a MakongStore plugin can do:

**A) The multi-server command bridge** (`lib/pluginBridge.js` + `routes/plugin.js`,
`/admin/servers`) — each plugin instance *connects outward* to this website
(no inbound port needed on the Minecraft side, so it works even across
different machines/hosts) and:
- shows up on the **Servers** page in `/admin` while it's connected, with its
  own server id (e.g. `arcade`, `ecosmp`, `proxy`);
- can be sent an arbitrary console command straight from that page — the
  literal "send a command from the store" feature;
- automatically runs a purchased item's delivery command the moment you press
  **Accept** in Telegram, *if* that item's gamemode server is currently
  connected — falling back to the usual manual copy-paste command when it
  isn't;
- can ping any other connected server (`/makong ping <server-id>` in-game or
  on the proxy console) — this is the "servers respond to each other" piece,
  relayed through the website so it works whether or not the servers share a
  Velocity proxy.

Turn this on by setting **`MAKONGSTORE_SECRET`** in `.env` (any long random
string) and the same value in every plugin's `config.yml` — that one shared
secret is all that's needed; there's no per-server URL to configure on the
website side since the plugins dial out to it.

**B) The older player-verify API** (`lib/makongstore.js`) — a single plugin
HTTP server the website calls into for live coins/rank/name-verify data and
mini-game payouts. This is a separate, optional piece not required for (A):

| | Plugin connected | Plugin absent |
|---|---|---|
| Verifying a name | Checked against the server; unknown names are refused | Accepted as typed |
| Coins shown | The player's real in-game balance | What the website has paid them |
| Rank in the store | Live, so upgrades are priced against it | Hidden; every rank shows "Buy Now" |
| Mini-game payouts | Credited in game, keyed on the round id | Recorded in `data/gamestats.json` only |
| Store delivery | `POST /purchase/deliver` (queues for offline players) | The command bridge above, or manual Telegram, as before |

Set `MAKONGSTORE_URL` (that plugin server's address) alongside
`MAKONGSTORE_SECRET` in `.env` to turn this on too — same shared secret, sent
as a header on every request, must match the plugin's `config.yml` exactly.
The website server prints which mode(s) it started in. If it isn't on
localhost or a private network, put the plugin's port behind a tunnel/VPN,
since the secret travels in the clear.

## 8. Server status & the Home page IP button

- Server status (online/offline + player count) is fetched server-side via `minecraft-server-util`, checking **Java and Bedrock at the same time** (whichever answers first "wins") — cached for 10 seconds so a burst of visitors doesn't hammer your server.
- **If it shows offline while the server is actually online:** this is almost always the *website's* host blocking the outbound connection, not the Minecraft server. Check the server console/logs for a line like `[minecraft-status] java(...): ... | bedrock(...): ...` — it prints the real error for both checks every time. `"offline or unreachable"` after a full timeout usually means the machine running this website can't reach that port at all (many cheap web hosts only allow outbound 80/443, and outbound UDP for Bedrock in particular is often blocked). To fix it: host the website somewhere that allows outbound TCP to your `javaPort` and outbound UDP to your `bedrockPort`, or double-check those two values in `config/site.config.json` actually match your real server ports.
- The **Server IP** button behaves differently by device, per your request:
  - **Desktop/laptop:** click → copies the Java IP:port to the clipboard.
  - **Mobile:** tap → copies the IP too, *and* tries to open the Minecraft Bedrock app directly to your server via a `minecraft://` deep link (only works if the visitor has Minecraft Bedrock installed; there's no equivalent official deep link for Java Edition, which is why desktop uses copy).

## 9. Theme & assets

The site ships with a **dark theme by default** and a light theme; visitors switch with the ☀️/🌙 button in the nav (the KH/EN language button sits beside it) and the choice is remembered in their browser. Both themes are defined as CSS custom properties at the top of `public/css/style.css` (`:root` = dark, `:root[data-theme="light"]` = light), so re-colouring either one is a matter of editing those two blocks.

The look is a bright, cute, hand-drawn-cartoon "Angkor Wat temple" UI (`public/css/style.css`). The nav is a stone-brick wall with vines hanging off the bottom edge (`public/images/site/vine-drape.svg`); nav links and the main hero buttons (Discord/Server IP/Store) are wood-plank pills with a circular colored icon badge, a wood-grain texture, and a moss sprig growing off one corner. Store/feature cards are golden parchment/stone tablets with a beveled edge (light highlight + soft dark shadow); item cards have four ✨ stars twinkling around their artwork instead of the corner sprig. Every button and card has a playful scale/wiggle animation on hover. A carved temple-frieze border strip (`public/images/site/khmer-pattern.svg`) runs between the nav/hero and above the footer on every page, section headings are flanked by small leaf glyphs, and a few little sway-animated flowers (`public/images/site/flower.svg`) dot the hero. The hero itself keeps a warm sunset gradient with a jungle canopy/palm silhouette (`public/images/site/forest-silhouette.svg`) along the bottom, hanging vine/frond decorations in the top corners (`public/images/site/leaf-corner.svg`), a soft glow behind the logo, and a few animated "firefly" particles for atmosphere. The real logo is dropped in at `public/images/site/logo-full.png` (full wordmark, used big on the Home hero) and `public/images/site/logo-icon.png` (temple-only crop, used in the nav badge and favicon) — both cropped from your banner with a transparent background. To swap in a new logo later, replace those two files (same filenames) or point `logo` / `logoIcon` in `config/site.config.json` at new paths. The rank badges (`public/images/items/rank-*.png`) are your own artwork, cropped square and resized to 512px; swap those files to change them. Item cards have four ✨ stars twinkling around the artwork — they are drawn in CSS (`.item-card .sparkle`), not an image, so they glow the same gold in both themes.

The "Chill Community / No Raiding / Live Cambodia Map" badges on the Home page come from the `serverFeatures` array in `config/site.config.json` — edit, add, or remove entries there (each has `icon`, `title`, `desc`, and an optional `link`) to change what's shown, no code changes needed.

The layout is responsive: a hamburger nav under ~760px, a stacked hero on mobile, and a grid that reflows from multi-column (desktop) down to single-column (phones) throughout the store.

## 10. Languages (English / ខ្មែរ / 中文 / Tiếng Việt)

Every page has a language button (next to the ☀️/🌙 toggle) that opens a
dropdown with all four languages. English is the default; the choice is
remembered in the browser and applies to the whole site, including the games.
Prices show the riel equivalent alongside the dollar amount only when Khmer is
selected (**1 USD = 4,000 ៛**) — Chinese and Vietnamese show the dollar figure
like English does. The amount actually charged is always the dollar figure on
the KHQR either way.

All the text lives in one file, `public/js/i18n.js`, as four dictionaries
(`en`, `km`, `zh`, `vi`) keyed by the same strings. To fix a translation, edit
that language's entry; to add new text, add the key to **all four**. Markup
opts in with `data-i18n="key"` (or `data-i18n-html`, `data-i18n-placeholder`,
`data-i18n-title`, `data-i18n-aria`), and anything rendered from JavaScript
calls `t("key", { vars })` and re-renders on the `i18n:change` event. The
website's CI checks all four dictionaries define exactly the same set of
keys, so a typo'd or missing key fails the build instead of silently falling
back to English at runtime.

Per the brief, Minecraft and technical vocabulary stays in English across
every translation — Server, Rank, Keys, Java, Bedrock, Creeper, Zombie, Combo,
KHQR, Telegram, Discord, block names and so on — because translating those
reads strangely to a player who already knows the game in English. Khmer
glyphs come from Kantumruy Pro and Chinese from Noto Sans SC (both loaded
alongside the other Google Fonts); Vietnamese needs no extra font since Baloo
2 and Noto Sans already cover its Latin Extended diacritics. The small-caps
styling (uppercase + letter-spacing) is switched off under `html[lang="km"]`
and `html[lang="zh"]` — Khmer because letter-spacing pulls its vowels away
from their consonants, Chinese because it has no concept of case at all so
the effect just looks wrong. Vietnamese keeps the English treatment since
it's a Latin script like French or German.

## 11. Running in production

**See `DEPLOY.md` for the full walkthrough** — Node 22, `.env`, a systemd unit
and a Cloudflare Tunnel that puts the site on your domain with HTTPS without
opening a port. Short version of the two things people get wrong:

* GitHub Pages and Cloudflare Workers/Pages **cannot host this** — it is a
  Node server that needs raw TCP/UDP (Minecraft status pings), a filesystem and a
  long-running process. Cloudflare *Tunnel* is the Cloudflare product that fits.
* Run it on the same machine as Minecraft if you can, and the player-verify
  MakongStore plugin (section 7B) then sits on `127.0.0.1` and never touches
  the internet. The multi-server command bridge (7A) doesn't need this at all
  — plugins connect outward to the website's public URL, so backend servers
  can live on entirely different machines/hosts.

Whatever you host on, two rules: never commit `.env` (it's already
git-ignored), and back up `data/` — it is the entire "database". `DEPLOY.md`
has a one-line cron job for that.

## 12. Project structure

```
MakongWeb/
  server.js               Express app entrypoint
  config/site.config.json Public site settings (server IP, dates, links, KHQR image…)
  data/items.json         Store items (ranks/keys/other, per gamemode) + their delivery commands
  data/orders.json        Orders and their status
  data/rankings.json      Ranking page's Top Team / Top Player leaderboards
  data/proofs/            Uploaded payment screenshots (git-ignored, never served publicly)
  lib/store.js            Tiny JSON-file data layer
  lib/rankings.js         Tiny JSON-file data layer for the ranking page
  lib/makongstore.js      Client for the MakongStore plugin's player-verify API (section 7B)
  lib/pluginBridge.js     Multi-server command/ping bridge the plugins connect to (section 7A)
  lib/tebex.js            Client for Tebex's Headless API (optional card/wallet checkout)
  deploy/                 systemd unit, Cloudflare Tunnel config, update script
  DEPLOY.md               How to put the site online
  lib/minecraft.js        Java+Bedrock status ping
  lib/commandTemplate.js  Turns "lp user {player} parent add vip" into a real command
  routes/api.js           Public JSON API (config, status, items, rankings, checkout, proof upload)
  routes/plugin.js        MakongStore plugin bridge API (connect/poll/ack/ping) - see lib/pluginBridge.js
  routes/account.js       The player account cookie used by the store
  routes/admin.js         Password-protected admin panel (item CRUD, rankings CRUD, image upload, servers)
  telegram/bot.js         Telegram bot: order review (Accept/Reject) + /additem etc.
  views/                  EJS templates for the admin panel
  public/                 index / store / checkout / success / ranking / map pages, css, js, images
    js/playername.js      Shared Java/Bedrock name rules (used by BOTH browser and server)
    js/i18n.js            English + Khmer dictionaries and the language switch
    js/account.js         Shared sign-in used by the store
    js/ranking.js          Ranking page: fetches, sorts, and renders the leaderboards
```
