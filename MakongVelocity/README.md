# MakongVelocity

A small Velocity companion to the [MakongCore](../MakongCore) Paper plugin.
Entirely optional - the proxy runs fine without it, this just adds five
independent features that only make sense at the proxy level. All commands
below are registered as `/mcvlc` - deliberately its own, collision-free
name with no aliases. `makongcore`/`macore`/`mc` belong to the Paper
MakongCore plugin's own commands; a Velocity command registration
intercepts a player's input before it ever reaches the backend, so
aliasing this to any of those names would silently swallow the real
`/makongcore` command on every backend instead of letting it through.

1. **`/mcvlc clients`.** Lists this proxy and every backend **actually running
   MakongCore** (i.e. currently connected to the website bridge), actually
   pinging each one (not just trusting the bridge's last heartbeat) and
   showing its live player count - a quick "is everything connected
   properly" health check for your MakongCore network specifically. Requires
   the website bridge below - it's the only way this proxy can tell a
   MakongCore backend apart from some other server it happens to route to
   (auth, lobby-hub, build, test, ...).
2. **nLogin account-type forwarding.** If [nLogin](https://docs.nickuc.com/)
   is installed on this proxy in **proxy mode**, MakongVelocity reads its
   premium/cracked/Bedrock classification for each player as they finish
   authenticating and forwards it to whichever backend they connect to. That
   backend's MakongCore then trusts it directly for account linking instead
   of running its own best-effort Mojang API guess.
3. **`/mcvlc autorestart <seconds|stop>`** (or the shorter `/mcvlc ar now
   [interval]` / `/mcvlc ar stop`). Relays a restart-warning-then-restart
   command - or a cancellation of one already in progress - to every
   MakongCore backend currently connected to the Makong Network website
   bridge, all at once. Meant to be triggered by your panel's own
   scheduled-restart feature a little before the proxy's own restart, so
   backends finish restarting first - see "Restart broadcast" below.
4. **`/mcvlc reload <module>`.** Relays a single-module config reload to every
   connected backend at once - see "Restart broadcast" below for the full
   list of modules.
5. **Periodic announcements.** Broadcasts store/Discord (or anything else
   you add) plugs to every player on the network on independent repeating
   timers - see "Announcements" below.

nLogin forwarding and announcements are on by default and independent of
everything else. `/mcvlc clients`, `/mcvlc autorestart`/`/mcvlc ar` and `/mcvlc reload`
all need the website bridge configured, since that's this proxy's only way
to know which of its servers run MakongCore at all.

## Building

```
cd MakongVelocity
./gradlew build
```

The jar comes out at `build/libs/MakongVelocity-1.0.0.jar`. It's also built
automatically by this repo's GitHub Actions workflow
(`.github/workflows/build-makongcore.yml`) - see its Artifacts for a
ready-made jar without needing Java/Gradle locally at all.

Drop the jar into your Velocity proxy's `plugins/` folder and restart it. On
first run it writes `plugins/makongcore/config.properties` with every
setting off/blank - nothing about your proxy changes until you edit it.

## `/mcvlc clients`

Requires the website bridge (see below) - lists this proxy plus every
backend that's **currently connected to it with MakongCore**, matched
against your `velocity.toml` server names, and pings each one for real (a
status ping, the same thing that populates a server's MOTD/player-count in
the multiplayer list) rather than just trusting the bridge's last
heartbeat, alongside its live player count. Other servers your proxy
routes to that don't run MakongCore (an auth/lobby-hub, a build server, a
test server, etc.) are never listed - this is a MakongCore-specific view,
not a dump of everything in `velocity.toml`:

```
╔══════════════════════════════════════════════════════════════════╗
║                              CLIENTS                              ║
╚══════════════════════════════════════════════════════════════════╝
Summary
Connected: 3

Sections
✔ velocity
✔ boxpvp · /172.18.0.1:45616 · 29 players
✖ hyperclash · /172.18.0.1:45628 · 0 players
```

A ✖ means that server's MakongCore connected to the website bridge (so it
knows about it) but didn't answer a status ping within 5 seconds - it's
gone down, is still booting, or the port/firewall changed since it last
connected. If nothing is configured yet, this errors out asking you to set
up the website bridge first - see below.

Before building its answer, `/mcvlc clients` always forces one extra poll of
the website bridge itself rather than reading whatever this proxy's own
background poll last cached - so a backend that only just connected or
dropped is reflected immediately instead of waiting out the rest of
`website.poll_interval_seconds`.

## Announcements

On by default (`announcements.enabled=true` in `config.properties`) - no
website bridge or nLogin needed, this is purely local to the proxy and
reaches every player on the network regardless of which backend they're on.
On first run it writes `plugins/makongcore/announcements.yml` with a
ready-to-use store + Discord example:

```yaml
announcements:
  store:
    link: https://www.makongmc.com
    interval: 180
    sound: ENTITY_PLAYER_LEVELUP
    message: |-
      &8────────────────
      &a🛒 &2&lMAKONG STORE
      &8────────────────
      &fSupport the server by purchasing
      &aranks, coins, keys &fand more!
      &f
      &a➟ &nwww.makongmc.com
      &8────────────────
    action-bar: ''

  discord:
    link: https://discord.gg/makong
    interval: 140
    sound: ENTITY_PLAYER_LEVELUP
    message: |-
      &8────────────────
      &b✉ &3&lDISCORD COMMUNITY
      &8────────────────
      &fStay updated with &bannouncements,
      &bgiveaways, events &fand more!
      &f
      &b➟ &ndiscord.gg/makong
      &8────────────────
    action-bar: ''
```

Add, remove, or rename entries under `announcements:` freely - `store` and
`discord` are just labels, every entry works the same way and runs on its
own independent repeating timer (its own `interval`, in seconds). A config
change only takes effect after a proxy restart (there's no reload command).

Per entry:
- `link` - optional. When set, clicking the broadcast message opens this
  URL. Leave `""` for an unclickable message.
- `interval` - seconds between broadcasts of this entry.
- `sound` - a Minecraft sound name. Both Bukkit-style (`ENTITY_PLAYER_LEVELUP`,
  as copied from a Paper plugin's config) and Adventure-style
  (`entity.player.levelup`) work. Leave `""` for no sound.
- `message` - broadcast to every player's chat, network-wide. Supports
  legacy `&` color codes (`&a`, `&l`, `&n`, `&8`, ...) exactly like Bukkit's
  `ChatColor.translateAlternateColorCodes`.
- `action-bar` - optional, shown in every player's action bar alongside the
  chat message. Leave `""` to skip it.

## nLogin account-type forwarding

Requires nLogin running in proxy mode on this same Velocity instance (not
per-backend). No dependency is bundled - MakongVelocity only compiles
against nLogin's own public API (`com.nickuc.login.api`), and talks to
whatever nLogin build is actually installed at runtime.

```properties
nlogin.forward_account_type=true
```

That's the only setting. When enabled, every backend running MakongCore
receives the classification on join automatically over a plugin messaging
channel (`makong:accounttype`) - nothing needs configuring on the backend
side, and a backend not running MakongCore (or an older version without
this) simply ignores it.

## Restart broadcast

Reuses the exact same website bridge protocol MakongCore itself uses (see
`../MakongWeb/lib/pluginBridge.js` and `../MakongCore/README.md`'s "Website
Bridge" section) purely to relay a command - it doesn't report rankings or
answer pings itself.

```properties
website.enabled=true
website.url=https://makongmc.com
website.secret=change-me
website.server_id=proxy
website.poll_interval_seconds=3
```

`website.secret` must match the website's `MAKONGCORE_SECRET` exactly, and
every backend you want reachable must have its own `config.yml`'s
`website:` section bridge configured and connected too (see MakongCore's
README) - this proxy only ever sees backends that are themselves already
talking to the website.

Once connected, `/mcvlc autorestart <seconds>` (or its shorter form,
`/mcvlc ar now [interval]` - `interval` defaults to 60 if omitted) sends
`makongcore autorestart <seconds>` to every currently-connected backend at
once and reports back per backend - `Sent ... to: a, b` for ones the
website accepted, `Failed: c` for any it refused (not currently connected)
or that the HTTP call itself failed for. Nothing is queued for a backend
that isn't online right now - it's reported as failed immediately instead
of sitting around waiting for a connection that may never come back. Each
backend that does get it broadcasts a countdown (reusing its own
`module/autorestart.yml` interval messages) and restarts itself once the
countdown reaches zero - see `/mateam autorestart` in MakongCore's README.

`/mcvlc autorestart stop` (or `/mcvlc ar stop`) cancels a pending ad-hoc restart
on every connected backend before it fires - useful if a countdown was
started by mistake or plans changed mid-countdown. It never touches each
backend's own configured `settings.restarts` schedule, only the one-off
countdown started by `autorestart`/`ar now`.

**Timing example.** Say your panel restarts the proxy every day at a fixed
time via its own scheduler. Add a second scheduled task a little earlier -
55 seconds before, say - that runs `/mcvlc autorestart 60` from the proxy's
console. Backends then start their own 60-second countdown 55 seconds before
the proxy restarts, finishing (and restarting) about 5 seconds ahead of
it - tune the "55" to fit your own setup; MakongVelocity has no opinion on
the offset, it only does the fan-out the instant it's asked to.

`/mcvlc ping <server-id>` reaches any other connected server the same way
MakongCore's own `/mateam ping <server-id>` does, relayed through the
website - handy for confirming this proxy and a given backend can both
reach the website bridge.

`/mcvlc reload <module>` sends `makongcore reload <module>` to every
connected backend, reloading just that one MakongCore module network-wide
instead of logging into each server individually. Valid modules: `team`,
`autorestart`, `matier`, `verification`, `gui` - see MakongCore's README
for what each covers and `/makongcore reload [module]` for the same thing run
locally on one server.

## Permissions

- `macorevlc.admin` - required to run `/mcvlc clients`, `/mcvlc ping`,
  `/mcvlc autorestart`/`/mcvlc ar` or `/mcvlc reload` as a player. The proxy console
  always has it, so a panel's scheduled console command needs no special
  grant. `/mcvlc` has no aliases - see the intro above for why.
