# MakongStore

Connects the Makong Network website ([`../MakongWeb/`](../MakongWeb/)) to your
Minecraft servers: a **Paper plugin** (one instance per backend server -
Arcade, EcoSMP, BoxPvP, PlotCity, HyperClash, ...) and a **Velocity plugin**
(one instance on your proxy, if you run one).

This first version keeps things deliberately small:

1. Each plugin **connects** to the website (outbound only - no inbound port
   needed on the Minecraft side, so this works the same whether every server
   is on one box or scattered across different hosts).
2. Connected servers show up on the website's **`/admin/servers`** page and
   can **respond to each other** - `/makong ping <server-id>` from any of
   them, relayed through the website.
3. The website can **send a console command** to any connected server - from
   the admin Servers page directly, or automatically when you press
   **Accept** on a Telegram order for that server's gamemode.

There's no player/rank/coins sync in this version - that's a separate, older,
optional API (`MakongWeb/lib/makongstore.js`) documented in the main
website's README, section 7B. This project only covers the command bridge.

## How it works

```
  Paper plugin (arcade)  ──┐
  Paper plugin (ecosmp)  ──┼──HTTPS──▶  MakongWeb  (/api/plugin/*)
  Paper plugin (boxpvp)  ──┤             │
  Velocity plugin (proxy)──┘             └─▶ /admin/servers, Telegram Accept

  Every arrow points INTO the website. The website never opens a connection
  to Minecraft - each plugin polls it every few seconds instead.
```

- `POST /api/plugin/connect` - a plugin registers itself once at startup
  (`serverId`, `kind`: `paper` or `velocity`).
- `GET /api/plugin/poll?serverId=...` - called on a repeating timer
  (`poll-interval-seconds` in config, default 5s). Doubles as the heartbeat
  that keeps a server showing "online", and hands back:
  - `commands` - console commands queued for this server to run right now
  - `pings` - ping requests from other connected servers to answer
  - `pongs` - answers to pings this server sent earlier
  - `servers` - the full current roster, for anyone who wants it
- `POST /api/plugin/ack` - reports back after running a queued command.
- `POST /api/plugin/ping` / `POST /api/plugin/pong` - the ping/pong pair
  behind `/makong ping <server-id>`.

All of it is authenticated by one shared secret (`MAKONGSTORE_SECRET` on the
website, `website.secret` in each plugin's config), sent as the
`X-Makong-Secret` header. See `MakongWeb/lib/pluginBridge.js` and
`MakongWeb/routes/plugin.js` for the server side.

## Project layout

```
MakongStore/
  pom.xml                   Maven parent (aggregates the three modules below)
  makongstore-common/       Platform-agnostic HTTP client + JSON (no Bukkit/Velocity imports)
    .../common/Json.java            Tiny dependency-free JSON reader/writer
    .../common/WebsiteBridge.java   Talks to /api/plugin/* - shared as-is by both plugins
  makongstore-paper/        The Paper plugin
    .../paper/MakongStorePlugin.java
    .../paper/MakongCommand.java
    resources/plugin.yml
    resources/config.yml
  makongstore-velocity/     The Velocity plugin
    .../velocity/MakongStoreVelocityPlugin.java
    .../velocity/MakongCommand.java
```

`makongstore-common` deliberately doesn't use Gson or any other JSON library:
neither Paper nor Velocity is guaranteed to expose one to plugins on every
version, so `Json.java` is a small (~150 line) hand-written reader/writer for
exactly the flat request/response shapes this protocol uses. It's unit-tested
against real captured payloads from the website - see the parent repo's
session history if you want to re-run that.

## Building

Requires JDK 17+ and Maven. From this directory:

```bash
mvn clean package
```

This produces:
- `makongstore-paper/target/MakongStore-Paper.jar`
- `makongstore-velocity/target/MakongStore-Velocity.jar`

Both jars are shaded (they bundle `makongstore-common`) but do **not** bundle
`paper-api` / `velocity-api` - those are provided by the server/proxy at
runtime, as normal for a Bukkit/Velocity plugin.

If `mvn package` can't resolve `paper-api` or `velocity-api`, your network is
probably blocking `repo.papermc.io` - that's the only external repository
this project needs beyond Maven Central. Try again from a machine/network
that can reach it (this is a very common corporate-proxy issue, nothing
specific to this project).

The Velocity API version pinned in `makongstore-velocity/pom.xml`
(`velocity.api.version`) is a snapshot; if it's no longer available, browse
<https://repo.papermc.io/#browse/browse:maven-public:com%2Fvelocitypowered%2Fvelocity-api>
for the current one and bump the property.

## Installing

**Paper (each backend server):**
1. Drop `MakongStore-Paper.jar` into that server's `plugins/` folder and start
   it once to generate `plugins/MakongStore/config.yml`.
2. Edit that config:
   ```yaml
   website:
     url: "https://makongmc.com"      # your website's real SITE_URL
     secret: "..."                    # must match MAKONGSTORE_SECRET in MakongWeb/.env
   server-id: "arcade"                 # match one of the website's gamemode ids
   poll-interval-seconds: 5
   ```
3. Restart. Console should log `Connected to the Makong Network website as
   'arcade'.` within a few seconds. It'll also show up on `/admin/servers`.

Repeat for every backend server, each with its own `server-id` matching that
server's gamemode (`arcade`, `ecosmp`, `boxpvp`, `plotcity`, `hyperclash`) so
purchases for that gamemode are delivered there automatically on Accept.

**Velocity (the proxy, optional):**
1. Drop `MakongStore-Velocity.jar` into `plugins/` and start it once to
   generate `plugins/makongstore/config.properties`.
2. Edit it the same way (`website.url`, `website.secret`, `server-id` -
   usually just leave this as `proxy`).
3. Restart.

Neither plugin does anything (and logs a warning instead of trying) until
`website.secret` is actually set to something other than the default
`change-me` placeholder - so it's safe to install ahead of time and turn on
later.

## Using it

- **`/makong status`** - is this server connected, and as what id.
- **`/makong ping <server-id>`** - pings another connected server (Paper or
  Velocity) and reports back once the pong arrives, usually well under a
  second. Requires the `makongstore.admin` permission (defaults to op on
  Paper; grant it via your permissions plugin on Velocity - the console is
  always allowed on both).
- **Website admin → Servers** (`/admin/servers`) - lists every connected
  server with its online/offline status, and a box to send it any console
  command on demand.
- **Telegram Accept** - if the order's gamemode server is currently
  connected, its delivery command runs automatically instead of only being
  shown for copy-paste; the Telegram message says which happened.

## Why commands, not a "give item" API

This first version only ever sends whatever command string the website
already builds from an item's configured **delivery command** (the same
`{player}`/`{quantity}` template used for the manual copy-paste flow) - it
doesn't know or care what that command actually does. That keeps the plugin
tiny and means it works with whatever permissions/economy/crate plugin you
already run, with zero MakongStore-specific configuration on the Minecraft
side beyond the website URL and secret. A more structured API (real
item/coin/rank objects instead of raw command strings) is exactly what the
older, separate `lib/makongstore.js` API is for, if you want to build that
out later.

## Velocity: what it can and can't run

Velocity has no access to backend-only plugins (LuckPerms, an economy plugin,
a crate plugin - all of that lives on the backend servers, not the proxy). A
command queued for the proxy's own `server-id` only makes sense if it's
something Velocity itself understands (`/send`, `/alert`, and the like). A
purchase's delivery command should always be queued against the backend
server's own `server-id` instead - which is exactly what happens
automatically via the gamemode match on Telegram Accept.
