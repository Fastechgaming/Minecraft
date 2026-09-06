# MakongCore

New-from-scratch team plugin for Paper/Purpur 1.21.x (targeted at 1.21.11).

## Design
- Java 21
- Paper API only; no NMS/CraftBukkit internals
- H2 or MySQL (MariaDB intentionally not supported)
- HikariCP connection pool
- Optional Floodgate integration via soft dependency
- Async database work with virtual threads
- Simple data-driven GUI architecture

## Build
Use Gradle 9+:

```bash
gradle clean build
```

The shaded jar is in `build/libs/`.

## Notes
This is the initial foundation build. The architecture intentionally keeps GUI presentation separate from team/business logic so additional menus and actions can be added without duplicating state-specific YAML.


## Floodgate / Bedrock
Floodgate is an optional runtime integration. MakongCore intentionally has no compile-time Floodgate dependency; when Floodgate is installed and enabled, MakongCore detects Bedrock players through the Floodgate API using reflection. This avoids old Floodgate/Geyser/Cumulus transitive dependencies during builds.

## Website Bridge
Optional integration with the Makong Network website's store (see `../MakongWeb/`). This server connects **outward** to the website on a repeating timer - nothing needs to be opened on this server's side, so it works whether the website and this server share a box or sit on entirely different hosts.

Once configured (`config.yml`'s `website:` section: `enabled: true`, a real `url`, and a `secret` matching the website's `MAKONGCORE_SECRET`):
- This server shows up on the website's `/admin/servers` page and can be sent any console command from there on demand, or automatically when a Telegram store order is Accepted for this server's gamemode.
- `/mateam ping <server-id>` reaches any other connected server (another MakongCore instance, or the [MakongVelocity](../MakongVelocity) companion plugin, if one exists on your network), relayed through the website.
- `server_id` defaults to `config.yml`'s `network.server_id` if left blank in `website.server_id`, so a network already using MySQL "network mode" doesn't need a second id to keep track of.
- `website.poll_interval_seconds` (default `3`) also controls how quickly [MakongVelocity](../MakongVelocity)'s `/mc clients` sees this server come online or drop - `/mc clients` also forces an immediate poll of its own before answering, so it never waits out a full interval either way.
- This server's live Team and MaTier Star standings (top 50 of each) are reported to the website on every poll tick, so the public `/ranking` page can show real data instead of the admin-curated fallback. Each player's tier comes straight from `MaTierService.tierForRanked()`, so the M1 top-10-only cap is respected exactly. This is read-only reporting - the website never writes Team/MaTier data back to this server.
- `/mateam autorestart <seconds|stop>` broadcasts a countdown (reusing `module/autorestart.yml`'s interval messages) and restarts this server once it elapses - a one-off outside the normal `settings.restarts` schedule - or cancels a pending one before it fires. Normally you won't type this yourself: [MakongVelocity](../MakongVelocity)'s `/mc autorestart <seconds|stop>` (or `/mc ar now [interval]` / `/mc ar stop`) relays it through this same bridge to every connected backend at once.
- `/mateam reload [module]` reloads everything (the same as plain `/mateam reload` always did), or - given `team`, `autorestart`, `matier`, `verification` or `gui` - just that one module. `team` and `autorestart` apply live without touching the database or reloading team data from it; `matier`, `verification` and `gui` currently fall back to a full reload to apply safely, since they're tied to registered event listeners. [MakongVelocity](../MakongVelocity)'s `/mc reload <module>` relays this to every connected backend at once.

This otherwise doesn't affect MaTier, Teams, or account linking - it's just a command/ping/rankings-reporting channel to and from the website.

## Velocity companion (MakongVelocity)
[MakongVelocity](../MakongVelocity) is a separate, optional Velocity plugin (its own Gradle project, built the same way) for two proxy-level features neither backend server can do on its own:
- Forwards [nLogin](https://docs.nickuc.com/)'s premium/cracked/Bedrock classification (nLogin running in proxy mode) to whichever backend a player connects to, over a `makong:accounttype` plugin message. `AccountLinkService` trusts this directly when present, skipping its own Mojang API guess entirely - see `linking.premium_detection` in `module/verification.yml` for the guess it falls back to when MakongVelocity isn't installed or nLogin forwarding is off.
- `/mc autorestart <seconds|stop>` / `/mc ar now [interval]` / `/mc ar stop` and `/mc reload <module>` fan the commands above out to every connected backend through the website bridge.

Nothing here changes if MakongVelocity is never installed - both are additive and off by default.

## configuration
- `config.yml` controls storage, team limits, validation, PvP, scoring, chat, allies, cleanup, cross-server behavior, weekly rewards and the Website Bridge (see below).
- `messages.yml` controls player-facing messages.
- `gui.yml` controls GUI titles, sizes, slots, materials, names, lore, filler panes and navigation.
- Run `/mateam reload` after changing configuration.

Modules:
- module/team.yml - team gameplay configuration
- module/matier.yml - player MaTier configuration
- module/verification.yml - Discord/Telegram linking, premium/cracked verification and Discord staff commands
- module/autorestart.yml - scheduled restarts
- gui.yml - GUI configuration
- messages.yml - messages
- config.yml - core/database/network/website-bridge configuration

MaTier:
- /matier
- /matier top
- /matier stats <player>
- /matier set|add|remove <player> <stars>
- /matier reset <player>
- /matier resetall
- /matier reload


## 1.2.6 changes
- Added per-player team weekly statistics: Weekly Points, kills, deaths and playtime.
- Player scoring is configurable in module/team.yml.
- Weekly reset clears both team totals and each member's weekly statistics.
- Fixed the main team GUI filter to cycle through configurable modes: join_date, points, name.
- Added module/autorestart.yml with restartCommands, commandsAfterReboot, restart schedules, interval messages and time formats.

## 1.2.8 changes
- Added configurable `[AURA MaTier]` colored dust particle auras for M3, M2 and M1 with standing, moving and Elytra states.
- Added `module/discord.yml` for Discord/Telegram linking, guild requirements, roles and Discord staff commands.
- Added persistent Minecraft ↔ Discord/Telegram account links.
- Added `/link` for optional Discord linking.
- Added cracked-player verification gate with 6-digit codes, 10-minute validity, Discord modal verification and Telegram verification.
- Added Discord account age (default 180 days) and guild membership age (default 7 days) requirements.
- Added Discord `/ban` and `/unban` integration with LiteBans sender and sender UUID overrides.

## Linking detection note
- Bedrock is detected through Floodgate.
- Premium Java detection on an offline/cracked server uses the configured Mojang username lookup as a best-effort signal. A username existing on Mojang does not cryptographically prove that the joining player owns the premium account. For strict cracked-only enforcement, use an authentication plugin/proxy integration such as FastLogin/online authentication and feed that state into the linking requirement.

- 1.2.10: Discord /ban duration autocomplete presets: Forever, 3d, 5d, 7d, 1month; custom duration text remains supported.

## 1.2.11 changes
- Added `module/website.yml` and the optional Website Bridge (see above) - connects this server to the Makong Network website's `/admin/servers` page, enables sending it console commands on demand or on Telegram order Accept, and adds `/mateam ping <server-id>` for cross-server pings relayed through the website.

## 1.2.12 changes
- The Website Bridge now also reports this server's Team and MaTier Star standings on every poll tick, so the website's public `/ranking` page can show live data (see above).

## 1.2.13 changes
- Added `/mateam autorestart <seconds>` - a one-off broadcast-then-restart, normally triggered remotely by the new [MakongVelocity](../MakongVelocity) companion plugin's `/mc autorestart` (see "Velocity companion" above).
- `AccountLinkService` now accepts an account-type classification forwarded by MakongVelocity (from nLogin running in proxy mode) over a `makong:accounttype` plugin message, trusting it ahead of its own Mojang API guess when present.

## 1.2.14 changes
- Fixed `storage.type: mysql` failing to start at all with `Database startup failed: ... Unsupported character encoding 'utf8mb4'`. The JDBC URL's `characterEncoding` option takes a *Java* charset name (`UTF-8`), not a MySQL one (`utf8mb4`) - the actual MySQL-side charset is now requested correctly via `connectionCollation=utf8mb4_unicode_ci` instead.

## 1.2.15 changes
- Fixed cracked players being frozen and asked to verify even with both `discord.enabled` and `telegram.enabled` set to `false`. `linking.required_for_cracked` (default `true`) is a separate switch from those two and was never actually checking whether a bot existed for the player to verify through - with both disabled this was a silent, permanent lockout with no way to complete verification. It's now ignored unless at least one of Discord/Telegram is enabled.

## 1.2.16 changes
- Moved the Website Bridge's settings (`enabled`, `url`, `secret`, `server_id`, `poll_interval_seconds`) from `module/website.yml` into `config.yml`'s new `website:` section - one less file to manage, and it now reloads with everything else `/mateam reload` already covers. Existing `module/website.yml` files are no longer read; re-enter your `url`/`secret` in `config.yml`.
- Renamed `module/discord.yml` to `module/verification.yml` - the file has always covered Telegram linking and premium/cracked detection alongside Discord, not just Discord, and the old name undersold that. Its contents (including the `discord:`/`telegram:`/`linking:` sections) are unchanged.
- Lowered the default `website.poll_interval_seconds` from `5` to `3` (and the paired website-side staleness window from 20s to 12s) so a server coming online, going offline, or reconnecting is reflected sooner. Combined with [MakongVelocity](../MakongVelocity)'s `/mc clients` now forcing a fresh poll before it answers (see that project's changelog), `/mc clients` no longer waits out a stale scheduled-poll cache on top of the staleness window.

## 1.2.17 changes
- `/mateam autorestart` now also accepts `stop`, cancelling a pending ad-hoc restart before it fires (broadcasts `messages.cancelled` from `module/autorestart.yml`). Doesn't touch the configured `settings.restarts` schedule.
- Added `/mateam reload [module]` - reload just `team`, `autorestart`, `matier`, `verification` or `gui` instead of everything. `team` and `autorestart` reload live in place (no database reconnect, no team-data reload); the other three currently fall back to a full reload to apply safely, since unregistering/re-registering their event listeners in isolation isn't worth the added risk for what it'd save.
- Both are relayed network-wide by [MakongVelocity](../MakongVelocity)'s new `/mc ar now [interval]` / `/mc ar stop` and `/mc reload <module>` - see that project's changelog.
