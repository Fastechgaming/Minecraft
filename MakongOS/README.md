# MakongOS

A feature-packed Discord bot + web dashboard for a Minecraft community — the bot and its dashboard ship as **one application, one process, one deploy**. There is nothing else to host separately (music included — no external Lavalink server required).

```
npm install
npm run build
npm start
```

## What's inside

- **AI Anti-Scam & Assistant** (Gemini) — Vision-based scanning of uploaded images to auto-detect crypto scams, fake Nitro giveaways, and phishing screenshots, with configurable auto-punish and role/channel whitelists; plus a conversational assistant with a knowledge base, per-user memory, staff escalation, and free `/imagine` image generation via Pollinations.
- **Moderation** — `/warn`, `/timeout`, `/kick`, `/ban`, auto-incrementing `/case` management, automod (invites, bad words, spam bursts, ghost pings), and cron-expiring `/temprole`.
- **Music** — a queue-based player (discord.js voice + yt-dlp, not Lavalink) with Spotify/YouTube search, a live Now Playing embed with playback buttons, and audio filters (Bassboost, Nightcore, 8D, Vaporwave, Tremolo).
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
├── music/                # queue manager, ffmpeg-filtered player, filter presets
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

## Music: how streaming works, and getting past YouTube throttling

Music streaming runs through [yt-dlp](https://github.com/yt-dlp/yt-dlp), downloaded automatically as a single binary to `.vendor/yt-dlp` the first time the bot starts (and refreshed every 14 days) — no separate install step, and it stays inside the one-process architecture. yt-dlp is used specifically because it's patched within days whenever YouTube changes its anti-bot measures, unlike most JS-only YouTube libraries.

Basic connectivity to YouTube (search, page loads) usually works fine even from a VPS, but YouTube can still throttle or block the actual *streaming* request from unauthenticated datacenter IPs — this shows up as `/play` failing with "Stream fetch timed out" even though the server can clearly reach youtube.com. If that happens, give it a real logged-in session:

1. Open YouTube in a normal browser (a throwaway/alt Google account is safer than your main one) and make sure you're signed in.
2. Open DevTools → Network tab, reload the page, click any request to `youtube.com`, and copy the full value of the `Cookie` request header.
3. Paste it into `.env` as `YOUTUBE_COOKIE=<that value>`.
4. Redeploy (`./deploy.sh`) — the bot logs `yt-dlp ready with YOUTUBE_COOKIE` on startup once it's picked up.

That cookie will eventually expire (typically weeks to months) — if `/play` starts timing out again after working fine for a while, re-grab a fresh one the same way.

## Docker

```
docker compose up --build
```

Runs PostgreSQL and the app together; migrations run automatically on container start.

## PM2

```
npm run build
pm2 start ecosystem.config.js
```

## Updating an existing bare-metal/VPS install

`npm start` only runs the already-compiled `dist/server.js` — pulling new source or changing dependencies does **not** rebuild it automatically. Running `git pull` (or `npm install`) without a fresh `npm run build` leaves the bot executing stale, possibly-deleted code against a `node_modules` tree it no longer matches — this has caused confusing "Cannot find module" and reverted-bug-fix crash loops before. Always use:

```
./deploy.sh
```

which does `git pull && npm install && rm -rf dist .next && npm run build`, then restarts PM2. Do this after **every** update — never just `git pull` and restart.

## Notes

- All secrets live in environment variables and are never sent to the browser.
- Music runs entirely inside this one process via `@discordjs/voice` + `yt-dlp` + `ffmpeg-static` — there is no separate Lavalink node to host, configure, or keep online.
- Server backup restore is intentionally **additive only** — it recreates roles/channels missing from a snapshot by name, and never deletes, renames, or overwrites current server structure.
- Every feature toggle, moderation rule, AI behavior setting, ticket category, shop item, and knowledge base entry is configurable from the dashboard — no code changes required for day-to-day administration.
- The Pollinations `/imagine` command runs prompts through a keyword-based NSFW safety filter before generating.
