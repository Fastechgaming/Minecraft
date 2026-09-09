# MakongCore - Full Reference

This is a single-file reference for everything MakongCore does: every command,
every permission, every config file and key, every message, every GUI item,
and every placeholder. `README.md` covers the "why" and the version history;
this file is the "what" - meant to be read start to finish (or skimmed by
heading) rather than searched. Where something looked incomplete or
inconsistent while writing this, it's called out under **⚠ Note** so you can
see it too instead of it being silently papered over.

## Contents

1. [What this plugin is](#1-what-this-plugin-is)
2. [Commands](#2-commands)
3. [Permissions](#3-permissions)
4. [Config files - overview](#4-config-files---overview)
5. [`config.yml`](#5-configyml)
6. [`module/team.yml`](#6-moduleteamyml)
7. [`module/matier.yml`](#7-modulematieryml)
8. [`module/autorestart.yml`](#8-moduleautorestartyml)
9. [`module/verification.yml`](#9-moduleverificationyml)
10. [`messages.yml`](#10-messagesyml)
11. [`gui.yml`](#11-guiyml)
12. [PlaceholderAPI](#12-placeholderapi)
13. [Optional integrations](#13-optional-integrations)
14. [Auto config migration](#14-auto-config-migration)
15. [Website Bridge & Velocity companion](#15-website-bridge--velocity-companion)
16. [Known gaps found while writing this](#16-known-gaps-found-while-writing-this)

---

## 1. What this plugin is

A team ("clans") plugin for Paper/Purpur 1.21.x, plus a standalone player
ranking system called **MaTier**, plus optional cross-server features
(Website Bridge, a Velocity companion) and optional third-party integrations
(Floodgate, PlaceholderAPI). Storage is H2 (single server) or MySQL (shared
across a network). See `README.md` for the version-by-version changelog.

---

## 2. Commands

### `/team` (alias: `/teams`)

No permission node gates the base command - every player can use it.

| Usage | What it does |
|---|---|
| `/team` | Opens the team GUI (create/browse/manage). |
| `/team browse` | Opens the "browse teams" GUI directly. |
| `/team top` / `/team leaderboard` | Opens the Stars leaderboard GUI directly. |
| `/team help` | Text help. |
| `/team create <tag> <name>` | Create a team. With no arguments, starts an interactive chat prompt instead (`ChatListener.beginCreate`). Validates tag/name characters and length against `module/team.yml`'s `team.limits`. |
| `/team info [tag]` | Your team's info, or `<tag>`'s if given. |
| `/team join <tag>` | Joins immediately if you have a pending invite to that team; otherwise sends a join request (public teams only). |
| `/team invite <player>` | Admin/owner only. Invites a player not already in a team. |
| `/team kick <player>` | Admin/owner only. Can't kick the owner. |
| `/team promote <player>` | Owner only. Member → Admin. |
| `/team transfer <player>` | Owner only. Opens a confirmation GUI. |
| `/team disband` / `/team delete` | Owner only. Opens a confirmation GUI. |
| `/team chat` | Toggles team-chat mode for you (see `team.chat` in `module/team.yml`). |
| `/team ally <tag>` | Admin/owner only. Sends an alliance request. |

**⚠ Note:** `/team help`'s in-game text and `TeamCommand`'s tab-completion
both list every subcommand above; `messages.yml`'s own `help` string is
similar but not called from anywhere in `TeamCommand.java` - the hardcoded
text in the `onCommand` handler is what actually prints. See
[§16](#16-known-gaps-found-while-writing-this).

### `/mateam` - team admin only

Requires **`mateam.admin`** (default: `op`). Scoped to the team module only -
nothing here reaches MaTier or server-wide admin actions; those live under
`/makongcore` below (which can *also* reach every one of these same team
subcommands - see that section).

| Usage | What it does |
|---|---|
| `/mateam help` | Lists everything below. |
| `/mateam team <tag>` | Full stats for one team (ID, members, public/private, PvP, Stars, kills, deaths, ally count). |
| `/mateam disband <tag>` | Force-disbands a team, bypassing the owner-only rule. |
| `/mateam forcejoin <player> <tag>` | Adds a player to a team as a regular member, bypassing invites. |
| `/mateam forceleave <player>` | Removes a player from their team. Refuses if they're the owner (transfer or disband first). |
| `/mateam givestar <tag> <amount>` (aliases `addstars`, `givestars`) | Adds/subtracts team Stars, floored at 0. |
| `/mateam setstars <tag> <amount>` | Sets team Stars directly, floored at 0. |

### `/makongcore` (alias `/macore`) - global, every module

Requires **`makongcore.admin`** (default: `op`). This is the "everything"
command: server-wide admin actions live here directly, and it also reaches
every `/mateam` team subcommand above and every `/matier` admin subcommand
below by delegating straight into those same commands' code (so behavior is
identical either way you reach them - nothing is duplicated).

| Usage | What it does |
|---|---|
| `/makongcore help` | Lists everything below. |
| `/makongcore reload [module]` | No module: full reload (config, database reconnect, team data reload, all listeners). With a module name (`team`, `autorestart`, `matier`, `verification`, `gui`): reloads just that one. `team` and `autorestart` apply live in place; the other three currently still trigger a full reload internally (see [§16](#16-known-gaps-found-while-writing-this)). |
| `/makongcore info` | Team count, member count, Floodgate status, Website Bridge status. |
| `/makongcore list` | Lists every team (tag, name, member count). |
| `/makongcore ping <server-id>` | Pings another server through the Website Bridge. Requires the bridge to be configured (see [§15](#15-website-bridge--velocity-companion)). |
| `/makongcore autorestart <seconds\|stop>` | Broadcasts a countdown and restarts this server once it elapses, or (`stop`) cancels a pending one. Normally triggered remotely by MakongVelocity's `/mcvlc ar`/`/mcvlc autorestart`, not typed by hand. |
| `/makongcore team\|disband\|forcejoin\|forceleave\|addstars\|setstars ...` | Same as the identically-named `/mateam` subcommands above. |
| `/makongcore matier <...>` | Same as the identically-named `/matier` admin subcommand below (e.g. `/makongcore matier set <player> <amount>`). |
| `/makongcore malink <...>` | Same as the identically-named `/malink` subcommand below (e.g. `/makongcore malink bypass <player>`). |
| `/makongcore reset <mateam\|matier\|verification\|all> confirm` | **Irreversible.** Wipes that module's persisted data entirely - see the table below. The `confirm` argument is required; running it without one just prints a warning of exactly what would be destroyed and does nothing. |

`/makongcore reset`'s scopes:

| Scope | What gets destroyed |
|---|---|
| `mateam` | **Every team, period** - not just Stars. Deletes every row in `teams`, `team_members`, `team_allies`. Equivalent to force-disbanding every team that exists. |
| `matier` | **All MaTier data** - every player's Stars *and* every past season's tier/rank history (`matier_players` and `matier_history` both wiped). This is a bigger wipe than `/matier resetall`, which only zeroes Stars and leaves history intact. |
| `verification` | **Every account link** - the entire `account_links` table. Every previously-verified player becomes unverified again and, if `linking.required_for_cracked` applies to them, gets frozen and re-coded the next time they join. Doesn't touch the bypass list (see `/malink` below) or in-progress verification codes. |
| `all` | All three of the above, together. |

### `/malink` - account-linking admin (also reachable via `/makongcore malink <...>`)

Requires **`makongcore.admin`** (default: `op`) - the same node `/matier`'s
admin subcommands and `/makongcore` itself use.

| Usage | What it does |
|---|---|
| `/malink help` | Lists everything below. |
| `/malink status <player>` | Whether they've linked yet (and their Discord ID/Telegram chat/account type/linked-at time if so), their bypass state, and - if they're online on *this* server specifically - whether they're currently frozen and their pending code. |
| `/malink reset <player>` | Deletes that player's `account_links` row (single-player version of `/makongcore reset verification`). If they're online right now, immediately re-runs the same join-time detection/freeze logic `onJoin` would, instead of waiting for their next actual join. |
| `/malink bypass <player>` | Adds them to the persisted bypass list (`link_bypass` table) - they can play without ever linking, regardless of `linking.required_for_cracked` or their detected account type. Independent of `account_links`: a bypassed player is never required to link whether or not they ever actually do. |
| `/malink unbypass <player>` | Removes them from the bypass list. |
| `/malink bypasslist` | Lists every currently-bypassed player. |

### `/matier`

Base usage (profile/leaderboard) is open to everyone; the admin subcommands
require **`makongcore.admin`** (default: `op`) - the same node `/makongcore`
itself requires, see [§3](#3-permissions).

| Usage | Permission | What it does |
|---|---|---|
| `/matier` | none | Your own MaTier profile (tier, Stars, progress to next tier). |
| `/matier top` | none | The Stars leaderboard (top `matier.leaderboard.size`, default 10). |
| `/matier stats <player>` | `makongcore.admin` | Another player's profile. |
| `/matier set <player> <amount>` | `makongcore.admin` | Sets a player's Stars. |
| `/matier add <player> <amount>` | `makongcore.admin` | Adds Stars (negative to subtract). |
| `/matier remove <player> <amount>` | `makongcore.admin` | Subtracts Stars. |
| `/matier reset <player>` | `makongcore.admin` | Sets one player's Stars to 0. |
| `/matier resetall` | `makongcore.admin` | Sets *every* player's Stars to 0. |
| `/matier reload` | `makongcore.admin` | Runs the same full reload as `/makongcore reload` (not a MaTier-only reload). |

### `/verify` (alias `/link`)

No permission node. Starts optional Discord/Telegram linking for the player
who runs it (`AccountLinkService#optionalLink`) - see
[§9](#9-moduleverificationyml). Renamed from `/link` (added next release);
`/link` still works as an alias. Its title/subtitle/action bar/chat message
are configurable (`linking.verify_command.*`), and it has its own cooldown
(`linking.request_cooldown_seconds`, default 60s) - running it again within
that window re-shows the same still-valid code rather than generating a new
one.

---

## 3. Permissions

| Node | Default | Gates |
|---|---|---|
| `mateam.use` | `true` | Declared, but **not currently checked anywhere in the code** - `/team`'s own commands have no permission gate at all right now. See [§16](#16-known-gaps-found-while-writing-this). |
| `mateam.admin` | `op` | `/mateam` - every team admin subcommand in [§2](#2-commands). |
| `makongcore.admin` | `op` | `/makongcore` (`/macore`) itself, and `/matier`'s admin subcommands (`stats`/`set`/`add`/`remove`/`reset`/`resetall`/`reload`). |

**⚠ Note:** `/makongcore`'s own top-level gate is `makongcore.admin`, but
when it delegates to a team subcommand (e.g. `/makongcore disband <tag>`)
that delegates straight into `/mateam`'s own command code, which re-checks
`mateam.admin` independently. In practice this is invisible to a normal
server op (ops get both nodes via `default: op`), but a non-op admin granted
only `makongcore.admin` through a permissions plugin needs `mateam.admin`
too to reach the delegated team subcommands specifically - grant both if you
want one staff member to have full `/makongcore` access.
Before 1.2.20 `mateam.admin` wasn't declared in `plugin.yml` at all even
though the code already checked it; see [§16](#16-known-gaps-found-while-writing-this).

---

## 4. Config files - overview

| File | Covers |
|---|---|
| `config.yml` | Storage/database, network mode, Website Bridge, debug logging. |
| `module/team.yml` | Everything about `/team`: limits, PvP, allies, chat, Star scoring, annual Star reset, disband, PlaceholderAPI's no-team text. |
| `module/matier.yml` | The MaTier ranking system: tiers, kill/death rewards, anti-farming, inactivity decay, aura particles, and MaTier's own messages. |
| `module/autorestart.yml` | Scheduled + ad-hoc restarts, countdown messages. |
| `module/verification.yml` | Discord/Telegram bots, cracked-player verification, premium detection. |
| `messages.yml` | `/team`'s player-facing messages (see [§16](#16-known-gaps-found-while-writing-this) for how much of this is actually wired up). |
| `gui.yml` | Every GUI screen's sizes, titles, items, slots, materials, names and lore. |

All seven are self-healing: any key present in a newer MakongCore version's
shipped default but missing from your file gets spliced back in automatically
on startup and on `/makongcore reload` (comments included, nothing you've
customized is touched) - see [§14](#14-auto-config-migration). You should
never need to delete a config file to "pick up" a new option.

---

## 5. `config.yml`

| Key | Default | Notes |
|---|---|---|
| `storage.type` | `h2` | `h2` (single server, file-based) or `mysql` (shared across a network). |
| `storage.mysql.host` | `localhost` | |
| `storage.mysql.port` | `3306` | |
| `storage.mysql.database` | `makongcore` | |
| `storage.mysql.username` | `root` | |
| `storage.mysql.password` | `""` | |
| `storage.mysql.use_ssl` | `false` | |
| `storage.mysql.connection_timeout` | `10000` | Milliseconds. |
| `storage.mysql.max_pool_size` | `8` | HikariCP pool size. |
| `storage.mysql.min_idle` | `1` | |
| `network.enabled` | `false` | "Network mode" - keep `false` unless multiple servers share one MySQL database. |
| `network.server_id` | `smp` | This server's id in network mode; also the fallback for `website.server_id` below if that's left blank. |
| `website.enabled` | `false` | Turns the Website Bridge on. See [§15](#15-website-bridge--velocity-companion). |
| `website.url` | `https://makongmc.com` | Public URL of the Makong Network website. |
| `website.secret` | `change-me` | Must match the website's `MAKONGCORE_SECRET` exactly. |
| `website.server_id` | `""` (empty) | Shown on the website's `/admin/servers` page; falls back to `network.server_id` if left blank. |
| `website.poll_interval_seconds` | `3` | How often this server checks in with the website. |
| `debug` | `false` | Developer diagnostics - leave off unless troubleshooting. |

---

## 6. `module/team.yml`

| Key | Default | Notes |
|---|---|---|
| `team.enabled` | *(added 1.2.31)* `true` | Disables the ENTIRE Team module - `/team`, `/mateam`, the team GUI, team chat, team PvP, the annual Star reset, `%team_*%` placeholders. `/team` and `/mateam` still work as commands when `false`, they just reply that teams are disabled. Toggling this specifically (unlike other `team.yml` keys) triggers a full reload even via `/makongcore reload team`, since the team-only listeners need registering/unregistering to match. |
| `team.limits.max_team_size` | `36` | |
| `team.limits.min_name_length` / `max_name_length` | `3` / `15` | |
| `team.limits.min_tag_length` / `max_tag_length` | `2` / `5` | |
| `team.limits.max_description_length` | `32` | |
| `team.defaults.description` | `a new team!` | Given to a newly created team. |
| `team.invites.expire_seconds` | `3600` | |
| `team.pvp.enabled` | `true` | Whether teams can toggle PvP at all. |
| `team.pvp.default_status` | `false` | PvP state for a newly created team. When `false`, teammates cannot damage each other (friendly fire cancelled); when `true`, teammates can. Damage to/from anyone outside the team is never affected by this setting. Only the team owner can toggle it, from the team GUI's PvP button. |
| `team.pvp.toggle_cooldown_seconds` | `300` | Not currently enforced. |
| `team.allies.enabled` | `true` | |
| `team.allies.max_allies` | `10` | |
| `team.allies.allow_request_toggle` | `true` | |
| `team.chat.character_enabled` | `true` | Whether the `character` prefix (below) triggers team chat in normal chat. |
| `team.chat.character` | `#` | |
| `team.rename.cooldown_seconds` | `604800` | 7 days. |
| `team.annual_star_reset.enabled` | `true` | |
| `team.annual_star_reset.month` / `day` / `hour` / `minute` | `1` / `1` / `0` / `0` | New Year's Day at midnight. |
| `team.disband.auto_disband` | `false` | Auto-disband inactive teams. |
| `team.disband.inactive_days` | `15` | |
| `team.disband.check_interval_minutes` | `360` | |
| `team.scoring.enabled` | `true` | Whether member activity earns Stars at all. *(changed 1.2.35)* Stars are now awarded straight to the team in real time (MaTier-style, minus named tiers), not accumulated toward a weekly payout - see the 1.2.35 changelog entry in `README.md`. |
| `team.scoring.minimum_stars` | *(renamed 1.2.35, was `minimum_points`)* `0` | Floor applied to a single death's Star loss (see `events.death`/`death_spam` below) - unrelated to `/mateam givestar`/`setstars`, which floor at 0 directly. |
| `team.scoring.spam_threshold_seconds` | `60` | |
| `team.scoring.events.playtime_per_hour` | `1` | Stars per hour played. |
| `team.scoring.events.kill` | `1` | |
| `team.scoring.events.kill_spam` | `0` | Reduced reward once `spam_threshold_seconds` triggers. |
| `team.scoring.events.death` | `0` | |
| `team.scoring.events.death_spam` | `-1` | |
| `team.creation.min_tag_length` / `max_tag_length` / `min_name_length` / `max_name_length` | `2` / `5` / `3` / `15` | **Not read by any code** - `team.limits` above is what `/team create` actually validates against. See [§16](#16-known-gaps-found-while-writing-this). |
| `team.placeholders.no_team` | `<gray>No Team</gray>` | *(added 1.2.20)* What `%team_tag%` shows for a player with no team - see [§12](#12-placeholderapi). |

---

## 7. `module/matier.yml`

| Key | Default | Notes |
|---|---|---|
| `matier.enabled` | `true` | Turns the whole MaTier system (and `/matier`) on/off. |
| `matier.new_year_reset.enabled` | `true` | |
| `matier.new_year_reset.month` / `day` / `hour` / `minute` | `1` / `1` / `0` / `0` | Previous standings are archived first. |
| `matier.tiers.M9`...`M1` | `0, 150, 300, 450, 600, 750, 975, 1200, 1500` | Star thresholds. M9 is the starting tier. |
| `matier.m1.enabled` | `true` | |
| `matier.m1.minimum_stars` | `1500` | |
| `matier.m1.max_players` | `10` | M1 is capped to the top N players by rank, not just by Star count. |
| `matier.kill.base_stars` | `5` | Plus the effective tier-difference bonus. |
| `matier.kill.minimum_reward` / `maximum_reward` | `0` / `999999` | |
| `matier.death.base_loss` | `4` | Adjusted the same way as kill rewards. |
| `matier.death.minimum_loss` / `maximum_loss` | `0` / `999999` | |
| `matier.anti_farming.enabled` | `true` | |
| `matier.anti_farming.same_player_cooldown_seconds` | `60` | |
| `matier.anti_farming.reduced_reward_after_cooldown` | `0` | |
| `matier.anti_farming.repeat_kill_reward` | `0` | Reward for killing the *same* player again within the cooldown. |
| `matier.anti_farming.suicide_reward` / `suicide_loss` | `0` / `0` | |
| `matier.inactivity.enabled` | `true` | |
| `matier.inactivity.grace_days` | `7` | Days offline before any penalty starts. |
| `matier.inactivity.initial_penalty` | `50` | Stars lost at the grace threshold. |
| `matier.inactivity.daily_penalty` | `10` | Stars lost per additional inactive day. Logging back in resets the counter. |
| `matier.leaderboard.size` | `10` | Used by both `/matier top` and the leaderboard GUI's default page size. |
| `matier.messages.*` | (12 messages) | `prefix`, `profile`, `top_header`, `top_entry`, `tier_up`, `m1_achieved`, `kill`, `death`, `reset`, `no_player`, `admin_only`, `invalid_amount`, `reload`. Placeholders: `{player}`, `{tier}`, `{stars}`, `{next_tier}`, `{required}`, `{rank}`, `{year}` (see [§10](#10-messagesyml) for which message uses which). `{tier}`/`{next_tier}` (when it's an actual tier, not `MAX`) are already colored per `MaTierService.TIER_HEX` - don't wrap them in another color tag in the template or it'll fight the tier's own color. |
| `matier.aura.enabled` | `true` | Colored dust-particle aura for M3/M2/M1 - no potion effects. |
| `matier.aura.interval_ticks` | `3` | |
| `matier.aura.M3` / `M2` / `M1` | (see file) | Each has `standing`/`moving`/`elytra` states, each with `color` (hex), `count`, `size`, `radius`. |

---

## 8. `module/autorestart.yml`

| Key | Default | Notes |
|---|---|---|
| `settings.enabled` | `true` | The whole module. |
| `settings.restartCommands` | 4 entries | Commands run before a *scheduled* restart. Supports `[normal]`, `[time:N]` (N seconds before), `[proxy:N]`/`[proxydelay:N]`, and a `[DAYNAME]` tag - see the file's own header comment for exact syntax. |
| `settings.commandsAfterReboot` | 2 entries | Run once after this server boots. |
| `settings.restarts` | `['Daily;05;00']` | Format `Daily;HH;MM` or `DAY;HH;MM`; add more entries for multiple restarts per day. |
| `settings.messageAtIntervals` | `['30','10','5','4','3','2']` | Countdown seconds at which `messages.interval` broadcasts. |
| `messages.interval` | `<yellow>server restarting in <white>{time}</white>!</yellow>` | `{time}` is pre-formatted (e.g. `30s`, `2m`). |
| `messages.action-bar` | *(added 1.2.25)* `<yellow>Restarting in <white>{time}</white>!</yellow>` | Shown in every online player's action bar alongside `messages.interval`, at the same `settings.messageAtIntervals` countdowns. Leave blank (`''`) to skip it. |
| `messages.cancelled` | *(added 1.2.17)* `<yellow>The scheduled restart has been cancelled.</yellow>` | Broadcast by `/makongcore autorestart stop`. |
| `format.seconds`/`second`/`minutes`/`minute`/`hours`/`hour`/`days`/`day`/`splitter` | `s`/`s`/`m `/`m `/`h `/`h `/`D `/`D `/`and ` | Used to build `{time}`. |

This module also covers the **ad-hoc** restart (`/makongcore autorestart <seconds>`,
normally triggered remotely - see [§2](#2-commands)) - it reuses
`restartCommands`' `[normal]` entries and the same interval messages, just
counting down from a fixed number of seconds instead of to a wall-clock time.

---

## 9. `module/verification.yml`

Covers Discord linking, Telegram linking, and premium/cracked detection -
renamed from `module/discord.yml` in 1.2.16 since it was never Discord-only.

**⚠ Note:** Discord does not expose whether an account has a verified
phone number to bots, under any scope - not even via OAuth. It's the one
account-security signal Discord treats as fully private to the account
owner (unlike account age, guild join date, roles, badges, or MFA-enabled
status, all of which are visible). There is no config key for it here
because there is no way to check it.

| Key | Default | Notes |
|---|---|---|
| `discord.enabled` | `false` | Controls whether linking is required/available and whether `/verify` works on *this* server - independent of `discord.hub` below. Leave `true` on every server in a multi-server network sharing one bot, even non-hub ones. |
| `discord.hub` | `true` | Whether *this* server opens its own live JDA connection to Discord. Only matters when multiple servers share the same `bot_token`: set `true` on exactly one (the "hub") and `false` on the rest, so only one process ever receives/acknowledges Discord interactions. Without this, every connected server gets every button click/modal submit at once and races the others to reply, producing `10062 Unknown interaction` / `40060 already acknowledged` errors. A player on a non-hub server still gets a code via `/verify` and it's still recognized correctly when submitted through the hub - see [§9.1](#91-multiple-servers-sharing-one-discord-bot). On a single-server setup, leave this alone. |
| `discord.bot_token` | `PUT_DISCORD_BOT_TOKEN_HERE` | Keep private - never commit a real token. |
| `discord.invite` | `discord.gg/makong` | |
| `discord.guild.id` | `""` | |
| `discord.guild.required` | `true` | Require guild membership to verify. |
| `discord.guild.required_role_id` | `""` | |
| `discord.guild.eligibility_tiers` | 2 tiers (see below) | *(added 1.2.21)* A list of `{minimum_account_age_days, minimum_membership_days}` pairs - an account qualifies if it meets **at least one** tier's **both** minimums. Shipped defaults: (180-day-old account, 30-day membership) OR (365-day-old account, any membership length). Add/remove/edit tiers freely - at least one tier must exist or nobody can ever verify. |
| `discord.guild.minimum_account_age_days` / `minimum_membership_days` | `180` / `7` | **Dead as of 1.2.21** - superseded by `eligibility_tiers` above. Still present (and untouched) in an upgraded file, but no longer read by any code. |
| `discord.verification.channel_id` / `panel_message_id` | `""` / `""` | |
| `discord.roles.crack` / `java` / `bedrock` | `""` each | Roles assigned by account type. |
| `discord.commands.staff_role_ids` | `[]` | Role IDs allowed to use `/ban`/`/unban` - having ANY ONE is enough. **Empty means nobody can use these commands** (fails closed, not open). Independent of `discord.guild.eligibility_tiers`/`required_role_id` - staff don't need to satisfy the player-verification age/membership checks. |
| `discord.commands.staff_role_id` | `""` | Old, pre-list single-role key - still honored (merged into the effective role set) if set, for upgrades. Use `staff_role_ids` above for new setups. |
| `discord.commands.roles.trial_helper_role_ids` / `helper_role_ids` / `manager_role_ids` | `[]` each | *(added 1.2.28)* Three-tier permission model on top of `/ban`/`/unban`. A member's HIGHEST matching role decides what happens: **Manager** - both commands run immediately. **Helper** - `/ban` runs immediately, `/unban` is posted as a Manager-only Accept/Deny request. **Trial Helper** - both are always a request (`/ban` needs Helper-or-above, `/unban` needs Manager). Holding a role in `staff_role_ids`/`staff_role_id` above (with none of these three set) counts as Manager, so an existing setup keeps its old immediate-execute behavior unchanged. See [§9.2](#92-ban-unban-approval-requests). |
| `discord.commands.ban.enabled` / `unban.enabled` | `true` / `true` | Discord `/ban` and `/unban`, with LiteBans integration. |
| `discord.profile.tagline` | *(added 1.2.29)* `Play. Improve. Be Better.` | The quote line on `/profile`'s card - see [§9.3](#93-profile). |
| `telegram.enabled` | `false` | |
| `telegram.bot_token` | `PUT_TELEGRAM_BOT_TOKEN_HERE` | |
| `telegram.username` | `makongmcbot` | |
| `linking.required_for_cracked` | `true` | Only actually enforced when at least one of `discord.enabled`/`telegram.enabled` is true - see 1.2.15's changelog entry for the lockout bug this guards against. Set `false` yourself to make linking optional even with a bot enabled. |
| `linking.code_length` | `6` | |
| `linking.code_expire_minutes` | `10` | |
| `linking.request_cooldown_seconds` | `60` | *(added next release)* `/verify`'s own cooldown - running it again within this many seconds of the last request just re-shows the same still-valid code (expiry untouched) instead of rolling a new one. Only matters for `/verify`'s on-demand codes, not the required-verification freeze (a one-time code per freeze, not repeatable on demand). |
| `linking.one_minecraft_per_discord` / `one_discord_per_minecraft` | `true` / `true` | |
| `linking.one_minecraft_per_telegram` / `one_telegram_per_minecraft` | `true` / `true` | |
| `linking.premium_detection.enabled` | `true` | Falls back to a Mojang username lookup when MakongVelocity/nLogin forwarding isn't available - best-effort only, see the file's own comment. |
| `linking.premium_detection.unknown_as_cracked` | `true` | |
| `linking.reminder.interval_seconds` | `3` | *(added next release)* How often a frozen player's title/subtitle/action bar/chat message repeats - also the scheduler's own tick rate (`AccountLinkService#start()`), so this is the only place that interval is configured. |
| `linking.reminder.title` / `subtitle` / `actionbar` / `message` | see file | *(added next release)* The frozen-player nag, sent once immediately on freeze and then repeated every `interval_seconds` - a title/action bar fades on its own after a few seconds, so without repeating it it would only ever show once. Supports `{code}`, `{discord}` (= `discord.invite`), `{telegram}` (= `"@" + telegram.username`), and `&`-style color codes. |
| `linking.verify_command.title` / `subtitle` / `actionbar` / `message` | see file | *(added next release)* Shown when a player runs `/verify` (or `/link`) by choice - not frozen/required. Same `{code}`/`{discord}`/`{telegram}`/`&`-color support as `reminder.*` above, plus `{expires_minutes}` (= `code_expire_minutes`). |

### 9.1 Multiple servers sharing one Discord bot

A network can run MakongCore on several backend servers pointed at the same
`discord.bot_token`. Two problems come from that if left unaddressed, and
both are handled:

- **A player's pending code only exists in memory on whichever server
  generated it** (wherever `/verify` or the join-time freeze created it), but
  the Discord interaction that submits the code can land on a *different*
  server's connection (Discord dispatches to every connected session for
  the same token, not just one). `AccountLinkService#verifyDiscord`/
  `verifyTelegram` fall back to a shared `pending_links` database table
  when the code isn't recognized locally, so this resolves correctly no
  matter which server's connection Discord picked - and `tickPending()`
  re-checks `account_links` every reminder tick so a player frozen on one
  server still gets released once verified through another.
- **Every connected server still races every other one to *acknowledge*
  the same interaction** - the fallback above makes the *outcome* correct,
  but Discord's own "first reply wins, the rest get 10062/40060" behavior
  is unaffected by it, so a multi-server network with everyone connected
  keeps logging those errors even though verification is working. `discord.hub`
  (above) is the actual fix for that: set it `true` on exactly one server
  and `false` on the rest so only one process is ever connected to Discord
  in the first place, while `discord.enabled` stays `true` everywhere so
  `/verify` and the required-verification freeze keep working on every
  server regardless of which one holds the connection.

### 9.2 `/ban`/`/unban` approval requests

*(added 1.2.28)* With `discord.commands.roles` configured, a Trial Helper's
or Helper's `/ban`/`/unban` doesn't run immediately - it posts an embed in
the same channel with **Deny**/**Accept** buttons instead, and waits:

```
🔨 Player Banning
Player: Steve
Duration: 7 days
Reason: Hacking
Staff: @Admin
🟡 Status: Wait for Higher staff to decide
[Deny] [Accept]
```

Whoever has at least the required tier (a Helper-or-above for a Trial
Helper's `/ban`, a Manager for anything else needing approval) clicks
Accept or Deny. The same message is then edited in place - no new message,
no leftover buttons:

- **Accept** actually runs the command and shows the real outcome:
  `🟢 Status: Accepted by @Staff` on success, or `🔴 Status: Accepted by
  @Staff, but failed to apply - check console` if the underlying `/ban`/
  `/unban` (LiteBans) itself failed.
- **Deny** never touches the server at all: `🔴 Status: Denied by @Staff`.

A Manager's `/ban`/`/unban`, and a Helper's `/ban`, skip all of this and run
immediately - the reply embed goes straight to `🟢 Status: Ban applied
successfully` (or `🔴 Status: Failed to apply...` on failure), with no
buttons. Requests are held in memory only (`AccountLinkService#modRequests`)
- a request still pending across a plugin reload/restart is lost, same as
this file's other in-memory Discord state (see §9.1 above).

### 9.3 `/profile`

*(added 1.2.29)* `/profile [user]` posts a generated profile card (a PNG
embed image) for whichever Minecraft account that Discord user has linked -
open to everyone in the channel, not staff-gated. `user` is optional
*(added 1.2.34)* - omit it to look up yourself.

If the target isn't linked yet, the reply (publicly visible, not
ephemeral *(changed 1.2.34)*) points them at how to fix it: run `/verify`
in-game for a code, then either click **Verify Code** in
`discord.verification.channel_id` (falls back to "in this server" if
that's unset), or *(added 1.2.36)* run `/link`/`/verify` right there
instead - see [§9.4](#94-link-and-verify-discord-slash-commands).

The card is rendered entirely by `ProfileCard` (`java.awt`/`Graphics2D`, no
external dependency) - the network's own bundled pixel font
(`fonts/minecraft.ttf`, the same one MakongWeb's site uses) plus flat vector
icons drawn in code, so nothing here depends on the server having any
particular font or emoji support installed. It shows:

- **Player** name, an online/offline dot, and `#<rank>` by MaTier Stars (omitted entirely at 0 Stars - there's no meaningful rank at zero).
- The `discord.profile.tagline` quote (above).
- **MaTier** tier and **Star** count (`MaTierService`).
- **Team** name, or "No Team" (`TeamService#byPlayer`).
- **Account type** (Premium/Cracked/Bedrock/Unknown, from the account link).
- **Time Registered** and **Last Login** - both a relative duration (`274d 13h 55m` / `5h 20m ago`) and an absolute timestamp underneath.
- A skin render, fetched live from `nmsr.nickac.dev` (the same renderer NameMC's own site uses - falls back to no render, not an error, if that fetch fails). Cracked/Bedrock accounts always render the vanilla default Steve skin instead of attempting a lookup - their stored UUID is a local offline-mode one with no real skin behind it.

Team/MaTier/account-type/skin come from this server alone, same as
everything else in this file. **Online status and Time Registered/Last
Login are whole-network** - they come from nLogin's own data (`getCreationDate()`/
`getLastLogin()`) and Velocity's own connected-player list, which only the
connected MakongVelocity companion can see. `/profile` asks for it through
the same website-bridge relay `/makongcore ping` uses (see §9.1's shape,
now generalized to `WebsiteBridge.ProfileRequest`/`ProfileAnswer` - look for
`requestProfile`/`answerProfile` in `WebsiteBridge.java`, `MakongVelocity.java`,
and `WebsiteBridgeService.java`), with an 8-second timeout. Without a
connected Velocity companion (or with the website bridge unconfigured
entirely), those three fields just show "Unknown"/offline - the rest of the
card still renders normally.

### 9.4 `/link` and `/verify` (Discord slash commands)

*(added 1.2.36)* Two identical slash commands - `/verify` is just an alias
of `/link` - that do exactly what the verification channel's **Verify
Code** button does, for anyone who'd rather not go find that channel and
click it:

- Run with no arguments: opens the same modal the button opens (enter your
  6-digit code, hit submit).
- Run with `code:<your code>`: skips the modal entirely and verifies
  immediately, straight off the one command.

Both forms share the exact same verification logic the button's modal
uses (`AccountLinkService#verifyDiscord`) - same expiry check, same
account-age/membership eligibility gate (`discordAllowed`), same
already-linked-to-another-account check, same role assignment on success.
Nothing in `module/verification.yml` configures these two specifically;
they're always available whenever `discord.enabled` is `true` and the bot
is connected, same as the button.

Not staff-gated (any guild member can run either), guild-only like every
other command here.

---

## 10. `messages.yml`

All 30+ keys are flat (no nesting) and use MiniMessage formatting.
Player-facing categories: permission/usage errors (`no_permission`,
`player_only`, `unknown_subcommand`), team lifecycle (`team_created`,
`team_deleted`, `joined`, `left`, `kicked`, `promoted`, `demoted`,
`transferred`), invites/requests (`invited`, `invite_received`,
`invite_expired`, `join_request_sent`), alliances (`ally_request_sent`,
`ally_request_received`, `ally_limit`), validation (`invalid_tag`,
`invalid_name`, `duplicate_tag`, `duplicate_name`, `team_full`,
`team_not_found`), chat-input prompts (`input_cancelled`, `input_tag`,
`input_name`), and a `gui_create_color` / `leaderboard_stars` /
`leaderboard_kills` / `leaderboard_kdr` group for GUI/leaderboard text.

**⚠ Note:** see [§16](#16-known-gaps-found-while-writing-this) - most of
`TeamCommand`'s actual player-facing text is hardcoded in the Java rather
than read from this file, so editing most of these keys currently has no
effect. `<tag>`/`<player>`/`<team_name>`/`<team_tag>`/`<status>` placeholders
shown here describe the *intended* substitutions.

---

## 11. `gui.yml`

Controls every GUI screen. `filler` (a global filler-pane material/name) and
`sizes` (inventory row count per screen, in slots - must be a multiple of 9)
apply everywhere; `titles` and `items` are per-screen.

| Screen (`items.<name>`) | Placeholders available | What it is |
|---|---|---|
| `no_team` | none | The 4 buttons a teamless player sees: create/browse/top/invites. |
| `team` | `{team} {tag} {members} {max} {kills} {deaths} {kdr} {stars} {pvp}` | Main team management screen. |
| `color` | none | The 16-dye-color picker shown right after team creation. |
| `leaderboard` | `{page} {pages} {team} {tag} {members} {max} {metric} {value} {rank}` | *(changed 1.2.35, was Stars/Points/Kills/KDR)* Stars/Kills/KDR leaderboard, paginated. |
| `browse` | `{page} {pages} {team} {tag} {members} {max} {status} {stars}` | Every public team, paginated. |
| `team_info` | `{team} {tag} {members} {max} {kills} {deaths} {kdr} {stars} {status} {description}` | A specific team's public info card. |
| `invites` | `{team} {tag} {members} {max}` | Your pending invitations. |
| `settings` | `{team} {tag} {description} {status} {status_info} {color}` | Owner/admin settings (tag, description, public/private, color). |
| `member` | `{target} {role} {joined} {kills} {deaths} {playtime}` | One member's profile within the team screen. |
| `join_requests` | none applied¹ | Pending join requests (owner/admin view). |
| `allies` | `{team} {tag} {members}` | Allied teams list. |
| `confirm` | `{target}` | Generic yes/no confirmation (disband/leave/transfer/kick/ally-remove). |

Every item entry supports `slot`, `material`, `name`, `lore` (a list; `[]`
removes it), and - on a few items only (`leaderboard.filter`) - `modes` and
`click_lore` for the sort-mode cycler button.

**⚠ Note:** two lore lines end with a malformed closing tag,
`</yellow` (missing the closing `>`) - `leaderboard.entry` and
`browse.entry`, both "Click for team info."/"Click for info." lines. MiniMessage
is lenient about this specific case, but it's worth fixing if you're editing
those lines anyway.

¹ `items.join_requests.entry`'s `slot` is read from config (`GuiManager#guiBase`),
but its `material`/`name`/`lore` are currently hardcoded in Java instead
(always a player head, name always just the requester's own name, lore
always the same three fixed lines) - editing those three fields in
`gui.yml` has no effect right now. See [§16](#16-known-gaps-found-while-writing-this).

---

## 12. PlaceholderAPI

Optional - only registered if PlaceholderAPI is installed (see
[§13](#13-optional-integrations)).

| Placeholder | Shows |
|---|---|
| `%team_tag%` | The viewed player's team tag, colored in the team's own chosen color, or `team.placeholders.no_team` (`module/team.yml`, default `No Team`) if they have no team. |
| `%team_star%` | Their team's current Stars, or `0` with no team. |
| `%matier%` | Their current MaTier tier (`M9`-`M1`), colored per the tier's fixed color - see `MaTierService.TIER_HEX`, [§7](#7-modulematieryml). Not configurable, so it always matches `/matier`'s own output and the website's Ranking page. |
| `%matier_star%` | Their current MaTier Stars. |

---

## 13. Optional integrations

- **Floodgate** (Bedrock detection): no compile-time dependency, detected via
  reflection at runtime. If present, Bedrock players are detected through it;
  otherwise MakongCore runs fully functional Java-only.
- **PlaceholderAPI**: a real `compileOnly` dependency (required to extend
  `PlaceholderExpansion`), but genuinely optional at runtime -
  `MakongCore#registerPlaceholders` checks the plugin is actually installed
  before registering anything.
- **MakongVelocity** (separate plugin, this repo's `../MakongVelocity`):
  forwards nLogin's premium/cracked/Bedrock classification to this server
  over a plugin message, and relays `/mcvlc autorestart`/`/mcvlc ar`/`/mcvlc reload`
  network-wide through the Website Bridge. See that project's own README.
- **Makong Network website** (`../MakongWeb`): see [§15](#15-website-bridge--velocity-companion).

---

## 14. Auto config migration

Since 1.2.19, every config file listed in [§4](#4-config-files---overview)
is compared against its shipped default on every startup and `/mateam
reload`. Any key the default has that your file doesn't gets spliced in -
right where it sits in the shipped file, comments included - without
touching anything you've already changed. Check your server log for a line
like `config.yml: added missing config key(s): website` after updating to
see what showed up. Implementation: `ConfigUpdater.java`.

---

## 15. Website Bridge & Velocity companion

Optional. This server dials **out** to the Makong Network website on a
repeating timer (`website.poll_interval_seconds`) - nothing needs to be
opened on this server's side. Once `website.enabled: true` with a real `url`
and matching `secret`:

- This server appears on the website's `/admin/servers` page and can be sent
  console commands on demand (or automatically on a Telegram store order Accept).
- `/makongcore ping <server-id>` reaches any other connected server.
- This server's live Team/MaTier standings are reported every poll tick for
  the public `/ranking` page (read-only - the website never writes back).
- `/makongcore autorestart`/`/makongcore reload <module>` can be triggered
  network-wide from the [MakongVelocity](../MakongVelocity) proxy plugin's
  `/mcvlc ar`, `/mcvlc autorestart`, and `/mcvlc reload` commands.

See `../MakongVelocity/README.md` and `../MakongWeb/lib/pluginBridge.js` for
the other two sides of this.

---

## 16. Known gaps found while writing this

Things noticed while cross-checking the code against the config/docs, kept
here rather than silently fixed everywhere, so you can decide what (if
anything) you want changed:

1. **`mateam.use` is declared but unused.** `plugin.yml` documents it
   (default `true`) as if it gates `/team`, but `TeamCommand` never calls
   `hasPermission` at all - the base `/team` command is open to literally
   anyone regardless of this permission's value.
2. **`messages.yml` is mostly disconnected from `/team`'s actual output.**
   `TeamCommand.msg()` has a hardcoded `switch` covering only 6 of the 30+
   keys in `messages.yml` (and even those 6 use inline hardcoded text, not
   the file's own strings) - most of what's in `messages.yml` currently has
   no effect on what players see. Fixing this properly means rewriting
   `TeamCommand` to read every message from `messages.yml` - a real, if
   mechanical, refactor. Worth doing if you plan to actually customize these.
3. **`team.creation.*` in `module/team.yml` is entirely unused.** Confirmed
   by searching the whole codebase - `team.limits.*` is what `Settings.load()`
   actually reads and `/team create` validates against. Editing
   `team.creation`'s copies of the same four values does nothing.
4. **`mateam.admin` vs `makongcore.admin`.** Fixed in 1.2.20 (`mateam.admin`
   is now properly declared in `plugin.yml`), but the two still gate two
   *different* commands despite the similar names - see [§3](#3-permissions).
5. **Two GUI lore lines have an unclosed `</yellow` tag** - see the note at
   the end of [§11](#11-guiyml). Cosmetically harmless (MiniMessage tolerates
   it) but worth fixing if you're already editing those lines.
6. **`/makongcore reload matier|verification|gui` isn't actually lightweight
   yet** - it silently falls back to a full reload (database reconnect
   included) rather than a true single-module reload. Functionally correct,
   just not as fast as the module name implies; see 1.2.17's changelog entry.
7. **`items.join_requests.entry`'s `material`/`name`/`lore` in `gui.yml` are
   dead config** - only its `slot` is actually read; the item itself is
   built with hardcoded text in `GuiManager#openJoinRequests`. See the
   footnote at the end of [§11](#11-guiyml).

None of these are urgent - they're the kind of thing that's easy to miss
without reading the whole codebase in one sitting, which is exactly what
building this document involved doing.
