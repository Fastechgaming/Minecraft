# MakongOS

A production-grade Discord staff system for a Minecraft server community — the bot and its web dashboard ship as **one application, one process, one deploy**. There is nothing else to host separately.

```
npm install
npm run build
npm start
```

## What's inside

- **Discord bot** (discord.js v14) — moderation, anti-spam, tickets, music, games, XP/leveling, welcome/leave, self-role panels, Minecraft integration, and a Gemini-powered AI staff assistant.
- **Web dashboard** (Next.js App Router) — Discord OAuth2 login, per-guild permission-gated settings, command manager, knowledge base editor, moderation case history, automation rule builder, searchable audit logs, and system health.
- **One custom Node server** (`src/server.ts`) boots the Next.js request handler and the Discord client side by side, sharing the same Prisma client and an in-process settings cache — a dashboard change (e.g. flipping "AI enabled") is picked up by the bot on its very next message, no restart required.
- **PostgreSQL + Prisma** for all persistence (`prisma/schema.prisma`).

## Architecture

```
src/
├── server.ts        # boots Next.js + the Discord client together
├── bot/              # client bootstrap, command/event framework, module registry
│   └── modules/      # one FeatureModule per system: moderation, tickets, music, ai, ...
├── ai/                # decision engine, knowledge retrieval, memory, moderation pipeline
├── moderation/        # case service shared by commands + anti-spam + AI automod
├── tickets/           # ticket channel + transcript service
├── music/             # queue manager + player (provider-agnostic)
├── games/             # mini-game logic (tic-tac-toe, trivia, stats)
├── community/         # XP/leveling, daily/weekly rewards, placeholders
├── automation/         # WHEN/IF/THEN rule engine
├── minecraft/ (via providers/minecraft) # Java/Bedrock status queries
├── providers/         # swappable AI / music / Minecraft provider implementations
├── database/          # Prisma client singleton + guild settings cache
├── services/          # logger, permissions, cooldowns, audit log
├── lib/               # dashboard-only auth/session/guild-access helpers
├── types/             # shared command/module contracts
├── app/               # Next.js dashboard: pages + REST API route handlers
└── components/        # dashboard UI
```

New feature idea (e.g. giveaways)? Add one module under `src/bot/modules/`, register it in `src/bot/registry.ts`, and (optionally) a settings page under `src/app/dashboard/[guildId]/`. Nothing else needs to change.

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` — from the [Discord Developer Portal](https://discord.com/developers/applications). Add `http://localhost:3000/api/auth/callback/discord` as an OAuth2 redirect.
   - `NEXTAUTH_SECRET` — any long random string (`openssl rand -base64 32`).
   - `DATABASE_URL` — a PostgreSQL connection string.
   - `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/apikey), to power the AI staff assistant.
   - `BOT_OWNER_IDS` — comma-separated Discord user IDs that always get full dashboard access.
2. `npm install`
3. `npx prisma migrate deploy` (or `npm run db:migrate:dev` in development)
4. `npm run deploy:commands` to register slash commands with Discord
5. `npm run build && npm start` (or `npm run dev` for local development)

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

## Notes

- All secrets live in environment variables and are never sent to the browser.
- Every command, feature toggle, moderation threshold, AI behavior, ticket category, and automation rule is configurable from the dashboard — no code changes required for day-to-day administration.
- The AI assistant only takes automatic moderation action above a configurable high-confidence threshold; medium-confidence findings are routed to a staff alert channel instead.
