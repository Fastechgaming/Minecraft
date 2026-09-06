// Multi-server bridge for the MakongCore plugins (Paper on each backend
// server, Velocity on the proxy) - see ../../MakongCore/README.md.
//
// Direction is the opposite of lib/makongcore.js: here the PLUGIN connects
// outward to this website (POST /api/plugin/connect, then a repeating
// GET /api/plugin/poll), so there is no per-server URL to configure and no
// inbound port to open on the Minecraft side - it works the same whether a
// backend server is on the same box or a different host entirely. Auth is
// one shared secret (MAKONGCORE_SECRET), checked by routes/plugin.js.
//
// State here is in-memory only and resets on restart - a plugin just
// reconnects and re-registers on its next poll, so nothing is lost beyond a
// few seconds of "offline" on the Servers admin page.
const ONLINE_WINDOW_MS = 12_000; // ~4 poll intervals at the plugin's default 3s
const RANKINGS_STALE_MS = 5 * 60 * 1000; // fall back to admin-curated data if nothing's reported in this long
const { nanoid } = require("nanoid");

const servers = new Map(); // serverId -> { kind, lastSeen, commands: [], pings: [], pongs: [] }
const rankingsByServer = new Map(); // serverId -> { teams: [{name,star}], players: [{name,star,tier}], reportedAt }

function enabled() {
  return Boolean(process.env.MAKONGCORE_SECRET);
}

function entry(serverId) {
  let e = servers.get(serverId);
  if (!e) {
    e = { kind: "paper", lastSeen: 0, commands: [], pings: [], pongs: [] };
    servers.set(serverId, e);
  }
  return e;
}

function register(serverId, kind) {
  const e = entry(serverId);
  e.kind = kind === "velocity" ? "velocity" : "paper";
  e.lastSeen = Date.now();
}

function heartbeat(serverId) {
  entry(serverId).lastSeen = Date.now();
}

function isOnline(serverId) {
  const e = servers.get(serverId);
  return Boolean(e && Date.now() - e.lastSeen < ONLINE_WINDOW_MS);
}

function listServers() {
  const now = Date.now();
  return Array.from(servers.entries()).map(([serverId, e]) => ({
    serverId,
    kind: e.kind,
    online: now - e.lastSeen < ONLINE_WINDOW_MS,
    lastSeen: e.lastSeen,
  }));
}

// Pushes a console command for `serverId` to run on its next poll. Queues it
// even if that server has never connected (or is currently offline) - it'll
// simply be waiting whenever it does. Callers that care whether it'll run
// promptly should check isOnline() first (see telegram/bot.js's Accept flow).
function queueCommand(serverId, command, meta) {
  const id = nanoid(8);
  entry(serverId).commands.push({ id, command, meta: meta || null, queuedAt: Date.now() });
  return id;
}

function drainCommands(serverId) {
  const e = entry(serverId);
  const drained = e.commands;
  e.commands = [];
  return drained;
}

// No persistence for acks beyond a console log - there's currently nowhere
// in the admin UI that needs a history of past deliveries beyond what the
// Telegram order thread already shows.
function ackCommand(serverId, commandId, ok, result) {
  console.log(`[pluginBridge] ${serverId} ack ${commandId}: ${ok ? "ok" : "failed"}${result ? ` — ${result}` : ""}`);
}

// Cross-server ping/pong, relayed through the website so it works whether or
// not the two servers share a Velocity proxy. `from` pings `target`; once
// `target` answers (via queuePong), `from` sees the pong on its own next poll.
function queuePing(from, target) {
  const id = nanoid(8);
  entry(target).pings.push({ id, from, queuedAt: Date.now() });
  return id;
}

function drainPings(serverId) {
  const e = entry(serverId);
  const drained = e.pings;
  e.pings = [];
  return drained;
}

function queuePong(from, target, pingId) {
  entry(target).pongs.push({ id: pingId, from, queuedAt: Date.now() });
}

function drainPongs(serverId) {
  const e = entry(serverId);
  const drained = e.pongs;
  e.pongs = [];
  return drained;
}

// Plugin pushes its Team/MaTier Star standings here on every poll tick (see
// WebsiteBridgeService.reportRankings() on the plugin side). Trusts the
// plugin's own tier field for players - it already knows the top-10-only
// cap on M1, which this website has no way to re-derive on its own.
function reportRankings(serverId, teams, players) {
  rankingsByServer.set(serverId, {
    teams: Array.isArray(teams) ? teams : [],
    players: Array.isArray(players) ? players : [],
    reportedAt: Date.now(),
  });
}

// Merges every server's fresh (non-stale) report into one {teams,players}
// list, de-duplicated by lowercased name (keeping whichever report has the
// higher star count - matters for a network-mode setup where every backend
// server reports the same shared totals, and for an independent-per-server
// setup where the same player name could coincidentally exist on two
// unrelated servers). Returns null when nothing fresh has been reported, so
// callers can fall back to the admin-curated JSON.
function getLiveRankings() {
  const now = Date.now();
  const teamsByName = new Map();
  const playersByName = new Map();
  let sawFreshReport = false;

  for (const report of rankingsByServer.values()) {
    if (now - report.reportedAt > RANKINGS_STALE_MS) continue;
    sawFreshReport = true;
    for (const team of report.teams) {
      const key = String(team.name || "").toLowerCase();
      if (!key) continue;
      const existing = teamsByName.get(key);
      if (!existing || Number(team.star) > Number(existing.star)) {
        teamsByName.set(key, team);
      }
    }
    for (const player of report.players) {
      const key = String(player.name || "").toLowerCase();
      if (!key) continue;
      const existing = playersByName.get(key);
      if (!existing || Number(player.star) > Number(existing.star)) {
        playersByName.set(key, player);
      }
    }
  }

  if (!sawFreshReport) return null;
  return {
    teams: Array.from(teamsByName.values()),
    players: Array.from(playersByName.values()),
  };
}

module.exports = {
  enabled,
  register,
  heartbeat,
  isOnline,
  listServers,
  queueCommand,
  drainCommands,
  ackCommand,
  queuePing,
  drainPings,
  queuePong,
  drainPongs,
  reportRankings,
  getLiveRankings,
};
