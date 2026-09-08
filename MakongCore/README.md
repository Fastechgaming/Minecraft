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

## PlaceholderAPI
Optional - only registered if [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/) is installed (`softdepend`, so load order doesn't matter either way). Unlike Floodgate this is a real `compileOnly` dependency (a `PlaceholderExpansion` subclass has to exist at compile time), but it's still entirely soft at runtime - `MakongCore#registerPlaceholders` checks the plugin is actually present before registering anything, and both expansions are re-registered against the fresh `TeamService`/`MaTierService` on every `/makongcore reload`.

| Placeholder | Shows |
|---|---|
| `%team_tag%` | The viewed player's team tag, colored in the team's own chosen color, or `team.placeholders.no_team` from `module/team.yml` (default `No Team`) if they're not in a team. |
| `%team_star%` | Their team's current Stars, or `0` if they're not in a team. |
| `%matier%` | Their current MaTier tier (`M9`-`M1`). |
| `%matier_star%` | Their current MaTier Stars. |

Use these in any plugin that supports PlaceholderAPI - TAB, DeluxeMenus, a scoreboard/chat plugin, etc.

## Website Bridge
Optional integration with the Makong Network website's store (see `../MakongWeb/`). This server connects **outward** to the website on a repeating timer - nothing needs to be opened on this server's side, so it works whether the website and this server share a box or sit on entirely different hosts.

Once configured (`config.yml`'s `website:` section: `enabled: true`, a real `url`, and a `secret` matching the website's `MAKONGCORE_SECRET`):
- This server shows up on the website's `/admin/servers` page and can be sent any console command from there on demand, or automatically when a Telegram store order is Accepted for this server's gamemode.
- `/makongcore ping <server-id>` reaches any other connected server (another MakongCore instance, or the [MakongVelocity](../MakongVelocity) companion plugin, if one exists on your network), relayed through the website.
- `server_id` defaults to `config.yml`'s `network.server_id` if left blank in `website.server_id`, so a network already using MySQL "network mode" doesn't need a second id to keep track of.
- `website.poll_interval_seconds` (default `3`) also controls how quickly [MakongVelocity](../MakongVelocity)'s `/mcvlc clients` sees this server come online or drop - `/mcvlc clients` also forces an immediate poll of its own before answering, so it never waits out a full interval either way.
- This server's live Team and MaTier Star standings (top 50 of each) are reported to the website on every poll tick, so the public `/ranking` page can show real data instead of the admin-curated fallback. Each player's tier comes straight from `MaTierService.tierForRanked()`, so the M1 top-10-only cap is respected exactly. This is read-only reporting - the website never writes Team/MaTier data back to this server.
- `/makongcore autorestart <seconds|stop>` broadcasts a countdown (reusing `module/autorestart.yml`'s interval messages) and restarts this server once it elapses - a one-off outside the normal `settings.restarts` schedule - or cancels a pending one before it fires. Normally you won't type this yourself: [MakongVelocity](../MakongVelocity)'s `/mcvlc autorestart <seconds|stop>` (or `/mcvlc ar now [interval]` / `/mcvlc ar stop`) relays it through this same bridge to every connected backend at once.
- `/makongcore reload [module]` reloads everything (the same as plain `/makongcore reload` always did), or - given `team`, `autorestart`, `matier`, `verification` or `gui` - just that one module. `team` and `autorestart` apply live without touching the database or reloading team data from it; `matier`, `verification` and `gui` currently fall back to a full reload to apply safely, since they're tied to registered event listeners. [MakongVelocity](../MakongVelocity)'s `/mcvlc reload <module>` relays this to every connected backend at once.

This otherwise doesn't affect MaTier, Teams, or account linking - it's just a command/ping/rankings-reporting channel to and from the website.

## Velocity companion (MakongVelocity)
[MakongVelocity](../MakongVelocity) is a separate, optional Velocity plugin (its own Gradle project, built the same way) for two proxy-level features neither backend server can do on its own:
- Forwards [nLogin](https://docs.nickuc.com/)'s premium/cracked/Bedrock classification (nLogin running in proxy mode) to whichever backend a player connects to, over a `makong:accounttype` plugin message. `AccountLinkService` trusts this directly when present, skipping its own Mojang API guess entirely - see `linking.premium_detection` in `module/verification.yml` for the guess it falls back to when MakongVelocity isn't installed or nLogin forwarding is off.
- `/mcvlc autorestart <seconds|stop>` / `/mcvlc ar now [interval]` / `/mcvlc ar stop` and `/mcvlc reload <module>` fan the commands above out to every connected backend through the website bridge.

Nothing here changes if MakongVelocity is never installed - both are additive and off by default.

## configuration
- `config.yml` controls storage, team limits, validation, PvP, scoring, chat, allies, cleanup, cross-server behavior, weekly rewards and the Website Bridge (see below).
- `messages.yml` controls player-facing messages.
- `gui.yml` controls GUI titles, sizes, slots, materials, names, lore, filler panes and navigation.
- Run `/makongcore reload` after changing configuration.
- Updating MakongCore never leaves your existing `config.yml`/`messages.yml`/`gui.yml`/`module/*.yml` behind: on every startup (and `/makongcore reload`) it compares each file against the version's shipped defaults and splices in any key you don't have yet - exactly where it sits in the shipped default, comments included - without touching anything you've already customized. Nothing to do manually after updating; check your server log for `added missing config key(s)` if you want to see what showed up.

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
- Added `module/website.yml` and the optional Website Bridge (see above) - connects this server to the Makong Network website's `/admin/servers` page, enables sending it console commands on demand or on Telegram order Accept, and adds `/makongcore ping <server-id>` for cross-server pings relayed through the website.

## 1.2.12 changes
- The Website Bridge now also reports this server's Team and MaTier Star standings on every poll tick, so the website's public `/ranking` page can show live data (see above).

## 1.2.13 changes
- Added `/makongcore autorestart <seconds>` - a one-off broadcast-then-restart, normally triggered remotely by the new [MakongVelocity](../MakongVelocity) companion plugin's `/mcvlc autorestart` (see "Velocity companion" above).
- `AccountLinkService` now accepts an account-type classification forwarded by MakongVelocity (from nLogin running in proxy mode) over a `makong:accounttype` plugin message, trusting it ahead of its own Mojang API guess when present.

## 1.2.14 changes
- Fixed `storage.type: mysql` failing to start at all with `Database startup failed: ... Unsupported character encoding 'utf8mb4'`. The JDBC URL's `characterEncoding` option takes a *Java* charset name (`UTF-8`), not a MySQL one (`utf8mb4`) - the actual MySQL-side charset is now requested correctly via `connectionCollation=utf8mb4_unicode_ci` instead.

## 1.2.15 changes
- Fixed cracked players being frozen and asked to verify even with both `discord.enabled` and `telegram.enabled` set to `false`. `linking.required_for_cracked` (default `true`) is a separate switch from those two and was never actually checking whether a bot existed for the player to verify through - with both disabled this was a silent, permanent lockout with no way to complete verification. It's now ignored unless at least one of Discord/Telegram is enabled.

## 1.2.16 changes
- Moved the Website Bridge's settings (`enabled`, `url`, `secret`, `server_id`, `poll_interval_seconds`) from `module/website.yml` into `config.yml`'s new `website:` section - one less file to manage, and it now reloads with everything else `/makongcore reload` already covers. Existing `module/website.yml` files are no longer read; re-enter your `url`/`secret` in `config.yml`.
- Renamed `module/discord.yml` to `module/verification.yml` - the file has always covered Telegram linking and premium/cracked detection alongside Discord, not just Discord, and the old name undersold that. Its contents (including the `discord:`/`telegram:`/`linking:` sections) are unchanged.
- Lowered the default `website.poll_interval_seconds` from `5` to `3` (and the paired website-side staleness window from 20s to 12s) so a server coming online, going offline, or reconnecting is reflected sooner. Combined with [MakongVelocity](../MakongVelocity)'s `/mcvlc clients` now forcing a fresh poll before it answers (see that project's changelog), `/mcvlc clients` no longer waits out a stale scheduled-poll cache on top of the staleness window.

## 1.2.17 changes
- `/makongcore autorestart` now also accepts `stop`, cancelling a pending ad-hoc restart before it fires (broadcasts `messages.cancelled` from `module/autorestart.yml`). Doesn't touch the configured `settings.restarts` schedule.
- Added `/makongcore reload [module]` - reload just `team`, `autorestart`, `matier`, `verification` or `gui` instead of everything. `team` and `autorestart` reload live in place (no database reconnect, no team-data reload); the other three currently fall back to a full reload to apply safely, since unregistering/re-registering their event listeners in isolation isn't worth the added risk for what it'd save.
- Both are relayed network-wide by [MakongVelocity](../MakongVelocity)'s new `/mcvlc ar now [interval]` / `/mcvlc ar stop` and `/mcvlc reload <module>` - see that project's changelog.

## 1.2.18 changes
- Added optional [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/) support - `%team_tag%`, `%team_star%`, `%matier%`, `%matier_star%` (see "PlaceholderAPI" above). Only registered if PlaceholderAPI is installed; nothing changes otherwise.

## 1.2.19 changes
- `config.yml`, `messages.yml`, `gui.yml` and every `module/*.yml` now auto-add any key you're missing (a newer version's default that your existing file predates) on startup and `/makongcore reload`, instead of only ever writing the whole file once on first install. New `ConfigUpdater` splices missing keys back into their original position relative to your existing keys - anchored right before whichever of their original neighbors you still have - comments and all, and never touches a key, value, or comment you already have. It works on the file's raw text rather than through Bukkit's own YAML loader specifically so it doesn't strip your comments the way re-saving a `YamlConfiguration` normally would.

## 1.2.20 changes
- `%team_tag%` no longer just goes blank for a player with no team - it now shows the new `team.placeholders.no_team` setting in `module/team.yml` (default `<gray>No Team</gray>`), read live so a reload picks up a change without restarting.
- Fixed `/mateam` (`/makongcore`)'s admin commands checking a permission (`mateam.admin`) that `plugin.yml` never actually declared - a permissions plugin granting the one permission `plugin.yml` did document, `makongcore.admin`, wouldn't have covered them (an operator was unaffected either way, since ops pass any undeclared permission check by default). Both are now declared, each covering what it actually gates: `mateam.admin` for `/mateam`, `makongcore.admin` for `/matier`'s admin subcommands.
- Added `MakongCore/DOCUMENTATION.md` - a single-file reference covering every command, permission, config file/key, message, GUI item and placeholder, meant to be read start to finish rather than searched.

## 1.2.21 changes
- Discord verification eligibility is now tiered instead of one fixed account-age + membership-age rule: `discord.guild.eligibility_tiers` in `module/verification.yml` is a list of `{minimum_account_age_days, minimum_membership_days}` pairs, and an account qualifies if it meets **any one** tier's **both** minimums. Shipped defaults: a 180-day-old account with a 30-day membership, OR a 365-day-old account regardless of how recently it joined. Add, remove, or edit tiers freely. The old flat `minimum_account_age_days`/`minimum_membership_days` keys are no longer read (an upgraded file keeps them around, harmlessly unused, alongside the new list).
- A verified phone number was requested as a possible third tier, but Discord doesn't expose phone-verification status to bots under any scope - it's not something this plugin (or any bot) can check, so that tier isn't offered as an option. See `DOCUMENTATION.md`'s verification section for the full explanation.
- `/mateam` and `/makongcore` are no longer the same command under two names - `/mateam` is now team-admin only (`team`/`disband`/`forcejoin`/`forceleave`/`addpoints`/`setpoints`/`addstars`/`setstars`), while `/makongcore` (new alias `/macore`) is the global command: it keeps the server-wide subcommands (`reload`/`info`/`list`/`ping`/`autorestart`) and additionally reaches every `/mateam` subcommand *and* every `/matier` admin subcommand (via a new `/makongcore matier <...>` prefix) - so `/macore` alone can do everything across every module. Nothing is duplicated: `/makongcore` delegates straight into `/mateam`'s and `/matier`'s own command code rather than reimplementing it.
- Added `/makongcore reset <mateam|matier|verification|all> confirm` - an irreversible full wipe of a module's persisted data (every team, all MaTier Stars *and* history, or every account link, or all three). Requires typing `confirm`; without it, just prints exactly what would be destroyed and does nothing.
- Added `/malink` (also reachable as `/makongcore malink <...>`) - account-linking admin commands: `status <player>` shows whether they've linked yet (Discord ID/Telegram chat/account type/linked-at if so), their bypass state, and their frozen/pending-code state if online on this server; `reset <player>` unlinks one player and immediately re-checks them if they're online; `bypass`/`unbypass <player>` let a specific cracked player skip the linking requirement entirely (persisted in a new `link_bypass` table, independent of whether they ever actually link); `bypasslist` lists everyone currently bypassed.
- Added `discord.hub` to `module/verification.yml` - for a network running MakongCore on multiple servers that all share the same Discord `bot_token`, set this `true` on exactly one server and `false` on the rest so only one of them ever opens a live connection to Discord. Without it, every connected server receives every button click/modal submit at once and races the others to acknowledge it, logging `10062`/`40060` errors even though verification itself completes correctly either way (see 1.2.21's shared `pending_links` change). `discord.enabled` keeps controlling whether linking is required/available and whether `/verify` works, independent of `discord.hub` - leave it `true` on every server, hub or not.
- `/ban`/`/unban`'s staff permission is now its own, dedicated check instead of piggybacking on the player-verification eligibility tiers - a moderator no longer needs a 6-month-old Discord account just to use these commands. `discord.commands.staff_role_ids` replaces the old single `staff_role_id` with a list (any one role is enough, so multiple staff ranks can each be granted independently); the old key is still honored if you already had it set. Also fixed a real gap: with no staff role configured at all, these commands used to be open to *any* verified player - now they fail closed (nobody can use them) until you deliberately grant a role.
- Renamed `/link` to `/verify` (clearer name for what it actually does) - `/link` still works as an alias, so nothing breaks for anyone already using it.
- `/verify`'s title/subtitle/action bar/chat message are now configurable (`linking.verify_command.*` in `module/verification.yml`), same `{code}`/`{discord}`/`{telegram}`/`&`-color convention as the required-verification reminder. Also added a cooldown (`linking.request_cooldown_seconds`, default 60s): running `/verify` again within that window re-shows the same still-valid code instead of rolling a new one and resetting its expiry - only once the cooldown elapses does it generate a genuinely fresh code with a fresh `code_expire_minutes` window. Also fixed `/verify` being gated on `discord.enabled` alone - a Telegram-only server used to tell every player it was "disabled" even with Telegram linking available.
- MakongVelocity's proxy command is now `/mcvlc` only, with no aliases - it used to also answer to `/makongcore` and `/macore`, which meant typing those on a Velocity-networked server got intercepted by the proxy's own command instead of ever reaching the backend Paper server's real `/makongcore`. Those two names (and `/mc`) are backend-only now.

## 1.2.22 changes
- The team settings GUI's `tag`/`description`/`status`/`color` buttons moved back one slot each (11/13/15/17 → 10/12/14/16). Only applies to a fresh install - an existing `gui.yml` needs those four `items.settings.*.slot` values edited by hand, since the self-healing config only adds missing keys and never changes one you already have.
- The interactive team-creation chat flow (`/team create` with no arguments) now asks for the team name before the tag, not the tag before the name - matches how a player actually thinks about it. The direct one-line `/team create <tag> <name>` command is unchanged.

## 1.2.23 changes
- Team PvP is now actually enforced - previously `team.pvp` was purely cosmetic (persisted and shown in the GUI, but no combat listener ever read it). With PvP **off** (the default for a new team), teammates can no longer damage each other at all, direct or via projectile (arrows, tridents, thrown potions); with it **on**, they can. This only ever governs damage between two members of the *same* team - damage to or from anyone outside the team is untouched either way. Toggling it from the team GUI's PvP button is now restricted to the team owner (previously any member could flip it).

## 1.2.24 changes
- Fixed a `zip file closed` error logged during a plugin disable/reload (server restart, or `/makongcore reload verification`) whenever the Discord bot's WebSocket connection happened to be tearing down at the same time. `AccountLinkService.stop()` called `jda.shutdownNow()` and returned immediately without waiting for JDA's background threads to actually finish - if Paper then closed the plugin's classloader before they did, the next class one of them needed to lazy-load threw that error instead of shutting down cleanly. `stop()` now blocks (up to 5s) on `jda.awaitShutdown()` first.
