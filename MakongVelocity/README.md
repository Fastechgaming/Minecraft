# MakongVelocity

A small Velocity companion to the [MakongCore](../MakongCore) Paper plugin.
Entirely optional - the proxy runs fine without it, this just adds three
independent features that only make sense at the proxy level:

1. **`/mc clients`.** Lists this proxy and every backend server configured in
   `velocity.toml`, actually pinging each one (not just checking it's
   configured) and showing its live player count - a quick "is everything
   connected properly" health check. Needs nothing configured - always
   available, no website bridge or nLogin required.
2. **nLogin account-type forwarding.** If [nLogin](https://docs.nickuc.com/)
   is installed on this proxy in **proxy mode**, MakongVelocity reads its
   premium/cracked/Bedrock classification for each player as they finish
   authenticating and forwards it to whichever backend they connect to. That
   backend's MakongCore then trusts it directly for account linking instead
   of running its own best-effort Mojang API guess.
3. **`/mc autorestart <seconds>`.** Relays a restart-warning-then-restart
   command to every MakongCore backend currently connected to the Makong
   Network website bridge, all at once. Meant to be triggered by your panel's
   own scheduled-restart feature a little before the proxy's own restart, so
   backends finish restarting first - see "Restart broadcast" below.

None of these three depend on each other - you can build and run this with
only the website bridge configured, only nLogin forwarding enabled, both, or
neither (`/mc clients` still works on its own either way).

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
first run it writes `plugins/makongvelocity/config.properties` with every
setting off/blank - nothing about your proxy changes until you edit it.

## `/mc clients`

No configuration needed - lists this proxy and **every server in
`velocity.toml`**, pinging each one for real (a status ping, the same thing
that populates a server's MOTD/player-count in the multiplayer list) rather
than just checking it's configured, alongside its live player count. This is
Velocity's own routing list, not a MakongCore-specific one - if your proxy
also routes to an auth/lobby-hub, a build server, a test server, etc., those
show up too, since a status ping can't tell what plugins a server runs.

If the website bridge is configured (see below), each row is also
cross-referenced against its live roster, so you can tell at a glance which
of these are actually MakongCore backends versus other servers on your
network that just happen to be reachable:

```
╔══════════════════════════════════════════════════════════════════╗
║                              CLIENTS                              ║
╚══════════════════════════════════════════════════════════════════╝
Summary
Connected: 4
MakongCore: 2/3 (only these are tagged - the rest are other servers on your network with no MakongCore/website bridge)

Sections
✔ velocity
✔ boxpvp · /172.18.0.1:45616 · 29 players · MakongCore
✔ plotcity · /172.18.0.1:58808 · 4 players
✖ hyperclash · /172.18.0.1:45628 · 0 players · MakongCore
```

A ✖ means that server didn't answer within 5 seconds - it's configured in
`velocity.toml` but not actually reachable right now (down, still booting,
firewalled, wrong port, etc.). Player counts come from Velocity's own
routing, not the ping itself. Without the website bridge configured, every
row shows plain (no `· MakongCore` tag on any of them) since this proxy has
no way to know which backends run it.

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
website.poll_interval_seconds=5
```

`website.secret` must match the website's `MAKONGCORE_SECRET` exactly, and
every backend you want reachable must have its own `module/website.yml`
bridge configured and connected too (see MakongCore's README) - this proxy
only ever sees backends that are themselves already talking to the website.

Once connected, `/mc autorestart <seconds>` queues
`makongcore autorestart <seconds>` on every currently-connected backend at
once. Each one broadcasts a countdown (reusing its own
`module/autorestart.yml` interval messages) and restarts itself once the
countdown reaches zero - see `/mateam autorestart` in MakongCore's README.

**Timing example.** Say your panel restarts the proxy every day at a fixed
time via its own scheduler. Add a second scheduled task a little earlier -
55 seconds before, say - that runs `/mc autorestart 60` from the proxy's
console. Backends then start their own 60-second countdown 55 seconds before
the proxy restarts, finishing (and restarting) about 5 seconds ahead of
it - tune the "55" to fit your own setup; MakongVelocity has no opinion on
the offset, it only does the fan-out the instant it's asked to.

`/mc ping <server-id>` reaches any other connected server the same way
MakongCore's own `/mateam ping <server-id>` does, relayed through the
website - handy for confirming this proxy and a given backend can both
reach the website bridge.

## Permissions

- `makongvelocity.admin` - required to run `/mc clients`, `/mc ping` or
  `/mc autorestart` as a player. The proxy console always has it, so a
  panel's scheduled console command needs no special grant.
