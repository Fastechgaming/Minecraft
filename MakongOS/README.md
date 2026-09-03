# MakongOS

A feature-packed Discord bot + web dashboard for a Minecraft community — the bot and its dashboard ship as **one application, one process, one deploy**. Music playback is the one exception: it's powered by [Lavalink](https://github.com/lavalink-devs/Lavalink), a small Java sidecar process that runs alongside the app under the same PM2 setup (see the Music section below) — everything else stays in the single Node process.

```
npm install
npm run build
npm start
```

## What's inside

- **AI Anti-Scam & Assistant** (Gemini) — Vision-based scanning of uploaded images to auto-detect crypto scams, fake Nitro giveaways, and phishing screenshots, with configurable auto-punish and role/channel whitelists; plus a conversational assistant with a knowledge base, per-user memory, staff escalation, and free `/imagine` image generation via Pollinations.
- **Moderation** — `/warn`, `/timeout`, `/kick`, `/ban`, auto-incrementing `/case` management, automod (invites, bad words, spam bursts, ghost pings), and cron-expiring `/temprole`.
- **Music** — a queue-based player backed by Lavalink, with Spotify/YouTube search, a live Now Playing embed with playback buttons, and audio filters (Bassboost, Nightcore, 8D, Vaporwave, Tremolo).
- **Tickets & Modmail** — multi-panel tickets with custom modal forms, staff claiming, idle reminders, HTML transcripts, and DM-based modmail threads.
- **Join-to-Create Voice Hub** — auto-generated temporary voice channels with an owner control panel (lock, hide, rename, limit, kick).
- **Dual Leveling** — text + voice XP with customizable canvas rank cards and a server leaderboard.
- **Economy** — bank, shop, daily/work/rob, and gambling minigames (Blackjack, Coinflip, Slots).
- **Giveaways & Reaction Roles** — button giveaways with role requirements and rerolls, plus dropdown self-assign role panels.
- **Utilities** — user-installable `/userinfo`, `/avatar`, `/bot`, `/rank` (usable anywhere on Discord, not just in a server), server info, Twitch/YouTube live alerts, and additive server backup/restore.
- **Web dashboard** (Next.js App Router, dark themed) — Discord OAuth2 login, per-guild permission-gated settings for every module above, a command manager, audit logs, and a bot-owner-only admin panel with system health and premium voucher codes.
- **One custom Node server** (`src/server.ts`) boots the Next.js request handler and the Discord client side by side, sharing the same Prisma client and an in-process settings cache — a dashboard change is picked up by the bot on its very next message, no restart required.
- **PostgreSQL + Prisma** for all persistence (`prisma/schema.prisma`).

## Architecture

```
src/
├── server.ts          # boots Next.js + the Discord client together
├── bot/                # client bootstrap, command/event framework, module registry
│   └── modules/        # one FeatureModule per system: moderation, ai, music, tickets, leveling, economy, voicehub, giveaways, reactionroles, utility, core
├── ai/                  # Gemini chat + vision scan, knowledge retrieval, memory, staff escalation, Pollinations image gen
├── moderation/          # case management, automod, ghost-ping tracking
├── music/                # Lavalink manager wiring, Now Playing embed/components, filter presets
├── economy/              # bank/daily/work/rob/shop service + gambling logic
├── tickets/               # ticket channel service + HTML transcript builder
├── giveaways/              # scheduling, winner selection, reroll
├── leveling/                # XP curve, rank card renderer (@napi-rs/canvas)
├── social/                    # Twitch/YouTube live & upload polling
├── utility/                    # server backup/restore snapshotting
├── database/                    # Prisma client singleton + guild settings cache
├── services/                     # logger, permissions, cooldowns, audit log
├── lib/                           # dashboard-only auth/session/guild-access helpers
├── types/                          # shared command/module contracts
├── app/                             # Next.js dashboard: pages + REST API route handlers
└── components/                       # dashboard UI
```

New feature idea? Add one module under `src/bot/modules/`, register it in `src/bot/registry.ts`, and (optionally) a settings page under `src/app/dashboard/[guildId]/`. Nothing else needs to change.

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` — from the [Discord Developer Portal](https://discord.com/developers/applications). Add `http://localhost:3000/api/auth/callback/discord` as an OAuth2 redirect. Enable the **Message Content**, **Server Members**, and **Presence** privileged intents.
   - `NEXTAUTH_SECRET` — any long random string (`openssl rand -base64 32`).
   - `DATABASE_URL` — a PostgreSQL connection string.
   - `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/apikey), to power anti-scam scanning and the AI assistant.
   - `BOT_OWNER_IDS` — comma-separated Discord user IDs that always get full dashboard access, including the bot-owner-only admin panel.
   - `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` / `YOUTUBE_API_KEY` — optional, only needed for live/upload social alerts.
2. `npm install`
3. `npx prisma migrate deploy` (or `npm run db:migrate:dev` in development)
4. `npm run build && npm start` (or `npm run dev` for local development). Slash commands auto-sync to every guild the bot is in on startup — no separate deploy step needed.

## Music: Lavalink setup, and getting past YouTube's anti-bot checks

Music runs through [Lavalink](https://github.com/lavalink-devs/Lavalink) — a Java server that handles the Discord voice connection and does the actual audio decoding, with the bot only sending it commands (search, play, pause, filters) over a local WebSocket/REST connection. It runs as its own PM2 process (`lavalink`, defined in `ecosystem.config.js`) alongside the `makongos` app, both on the same machine. YouTube support comes from Lavalink's [`youtube-plugin`](https://github.com/lavalink-devs/youtube-source), declared in `lavalink/application.yml` and downloaded automatically by Lavalink itself on first start (no manual plugin install).

**One-time setup on the server:**

1. Install a Java 17+ runtime if it's not already present: `sudo apt update && sudo apt install -y openjdk-17-jre-headless`.
2. Set `LAVALINK_PASSWORD` in `.env` to a long random string (it just needs to match between the bot and `lavalink/application.yml`, which reads it from the same `.env`).
3. Run `./scripts/setup-lavalink.sh` — downloads `lavalink/Lavalink.jar` if it's not already there.
4. Start it: `pm2 start ecosystem.config.js --only lavalink` (a normal `pm2 start ecosystem.config.js` / `./deploy.sh` also starts it going forward, since it's just another app in that same config file).

At this point `/play` already works for most sources (SoundCloud, Bandcamp, direct links, etc). YouTube is the exception: Lavalink's `youtube-plugin` needs Google account credentials (real OAuth, not a scraped cookie) to get past YouTube's proof-of-origin checks on datacenter IPs — without it, YouTube searches/streams will fail or return login-required errors. To enable it:

1. Set `plugins.youtube.oauth.enabled: true` — already wired up to read `YOUTUBE_OAUTH_ENABLED` from `.env`, so just set `YOUTUBE_OAUTH_ENABLED=true` there.
2. Restart Lavalink (`pm2 restart lavalink --update-env`) and immediately check its logs: `pm2 logs lavalink`. On first start with OAuth enabled and no refresh token yet, it prints a `https://www.google.com/device` link and a short code.
3. Open that link on any device (a throwaway Google account is safer than a personal one — use one that isn't otherwise tied to anything important), enter the code, and approve access.
4. Lavalink logs the resulting refresh token once linking completes — copy it into `.env` as `YOUTUBE_REFRESH_TOKEN=<that value>`, then `pm2 restart lavalink --update-env` one more time so it's used on every future start instead of re-prompting.

That refresh token doesn't expire the way scraped cookies do, so this is a one-time setup rather than something to redo periodically.

## Docker

```
docker compose up --build
```

Runs PostgreSQL and the app together; migrations run automatically on container start. This compose file doesn't include Lavalink, so `/play` won't work until you also run a Lavalink server the app can reach and point `LAVALINK_HOST`/`LAVALINK_PORT`/`LAVALINK_PASSWORD` at it — see the Music section above.

## PM2

```
npm run build
./scripts/setup-lavalink.sh   # one-time: downloads Lavalink.jar — see the Music section
pm2 start ecosystem.config.js
```

This starts both PM2 apps: `makongos` (the bot + dashboard) and `lavalink` (the music server).

## Updating an existing bare-metal/VPS install

`npm start` only runs the already-compiled `dist/server.js` — pulling new source or changing dependencies does **not** rebuild it automatically. Running `git pull` (or `npm install`) without a fresh `npm run build` leaves the bot executing stale, possibly-deleted code against a `node_modules` tree it no longer matches — this has caused confusing "Cannot find module" and reverted-bug-fix crash loops before. Always use:

```
./deploy.sh
```

which does `git pull && npm install && rm -rf dist .next && npm run build`, then restarts PM2. Do this after **every** update — never just `git pull` and restart.

## Notes

- All secrets live in environment variables and are never sent to the browser.
- Music depends on the `lavalink` PM2 process being up (see the Music section above) — if it's down, `/play` will fail to connect and the bot logs an error on startup telling you to check it.
- Server backup restore is intentionally **additive only** — it recreates roles/channels missing from a snapshot by name, and never deletes, renames, or overwrites current server structure.
- Every feature toggle, moderation rule, AI behavior setting, ticket category, shop item, and knowledge base entry is configurable from the dashboard — no code changes required for day-to-day administration.
- The Pollinations `/imagine` command runs prompts through a keyword-based NSFW safety filter before generating.
