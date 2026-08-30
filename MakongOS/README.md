# MakongOS

An AI-first Discord assistant for a Minecraft community — the bot and its web dashboard ship as **one application, one process, one deploy**. There is nothing else to host separately.

```
npm install
npm run build
npm start
```

## What's inside

- **AI Staff Assistant** (Gemini) — the centerpiece: natural chat, a response-decision engine (so it doesn't spam every message), a per-guild knowledge base, per-user memory, image understanding + generation, and a staff-escalation flow with inline **Answer** / **Add to Knowledge** buttons when the AI can't confidently help.
- **Tickets** — panel + category based support tickets with staff roles, claim/close, transcripts, and per-user open-ticket limits.
- **Economy & Social** — coins/bank, `/daily`, `/beg`, `/gamble`, transfers, and reputation.
- **Suggestions** — member suggestions with reaction voting and staff approve/reject.
- **Giveaways** — reaction-based giveaways with scheduled auto-end and rerolls.
- **Music** — a queue-based player with a live "Now Playing" embed and playback buttons.
- **Fun & Utility** — memes, animal facts, anime reaction gifs, coinflip/dice/8-ball, avatar/userinfo/botstats, urban dictionary, and a leveling/XP system with a leaderboard.
- **Web dashboard** (Next.js App Router) — Discord OAuth2 login, per-guild permission-gated settings, command manager, knowledge base editor, and searchable audit logs.
- **One custom Node server** (`src/server.ts`) boots the Next.js request handler and the Discord client side by side, sharing the same Prisma client and an in-process settings cache — a dashboard change (e.g. flipping "AI enabled") is picked up by the bot on its very next message, no restart required.
- **PostgreSQL + Prisma** for all persistence (`prisma/schema.prisma`).

## Architecture

```
src/
├── server.ts        # boots Next.js + the Discord client together
├── bot/              # client bootstrap, command/event framework, module registry
│   └── modules/      # one FeatureModule per system: ai, tickets, economy, fun, suggestions, giveaways, utility, music, core
├── ai/                # decision engine, knowledge retrieval, memory, staff assistant + escalation
├── economy/           # coins/bank/daily/beg/gamble/reputation service
├── tickets/           # ticket channel + transcript service
├── suggestions/       # (inline in the module) reaction-vote review flow
├── giveaways/         # scheduling, winner selection, reroll
├── music/             # queue manager + player (provider-agnostic)
├── stats/             # XP/leveling
├── providers/         # swappable AI / music provider implementations
├── database/          # Prisma client singleton + guild settings cache
├── services/          # logger, permissions, cooldowns, audit log
├── lib/               # dashboard-only auth/session/guild-access helpers
├── types/             # shared command/module contracts
├── app/               # Next.js dashboard: pages + REST API route handlers
└── components/        # dashboard UI
```

New feature idea? Add one module under `src/bot/modules/`, register it in `src/bot/registry.ts`, and (optionally) a settings page under `src/app/dashboard/[guildId]/`. Nothing else needs to change.

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` — from the [Discord Developer Portal](https://discord.com/developers/applications). Add `http://localhost:3000/api/auth/callback/discord` as an OAuth2 redirect.
   - `NEXTAUTH_SECRET` — any long random string (`openssl rand -base64 32`).
   - `DATABASE_URL` — a PostgreSQL connection string.
   - `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/apikey), to power the AI staff assistant.
   - `BOT_OWNER_IDS` — comma-separated Discord user IDs that always get full dashboard access.
2. `npm install`
3. `npx prisma migrate deploy` (or `npm run db:migrate:dev` in development)
4. `npm run build && npm start` (or `npm run dev` for local development). Slash commands auto-sync to every guild the bot is in on startup — no separate deploy step needed.

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
- Every feature toggle, AI behavior setting, ticket category, economy amount, and knowledge base entry is configurable from the dashboard — no code changes required for day-to-day administration.
- Fun/utility commands that depend on free third-party APIs (memes, animal facts, anime reactions, urban dictionary) fail gracefully with a friendly message if that API is unreachable — they never crash the bot.
- Image filters/overlays (meme-style image editing) were intentionally **not** ported from the reference bot this was built from: that feature depends on a private, paid third-party API key and ships disabled by default even in the original project.
