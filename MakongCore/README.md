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

Once configured (`module/website.yml`: `enabled: true`, a real `url`, and a `secret` matching the website's `MAKONGCORE_SECRET`):
- This server shows up on the website's `/admin/servers` page and can be sent any console command from there on demand, or automatically when a Telegram store order is Accepted for this server's gamemode.
- `/mateam ping <server-id>` reaches any other connected server (another MakongCore instance, or a Velocity proxy running the companion bridge plugin, if one exists on your network), relayed through the website.
- `server_id` defaults to `config.yml`'s `network.server_id` if left blank in `module/website.yml`, so a network already using MySQL "network mode" doesn't need a second id to keep track of.

This has no dependency on and does not affect MaTier, Teams, or account linking - it's purely a command/ping channel to and from the website.

## configuration
- `config.yml` controls storage, team limits, validation, PvP, scoring, chat, allies, cleanup, cross-server behavior and weekly rewards.
- `messages.yml` controls player-facing messages.
- `gui.yml` controls GUI titles, sizes, slots, materials, names, lore, filler panes and navigation.
- Run `/mateam reload` after changing configuration.

Modules:
- module/team.yml - team gameplay configuration
- module/matier.yml - player MaTier configuration
- module/discord.yml - Discord/Telegram linking, verification and staff commands
- module/autorestart.yml - scheduled restarts
- module/website.yml - Makong Network website bridge (see below)
- gui.yml - GUI configuration
- messages.yml - messages
- config.yml - core/database/network configuration

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
