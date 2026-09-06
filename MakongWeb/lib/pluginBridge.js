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
const ONLINE_WINDOW_MS = 20_000; // ~4 poll intervals at the plugin's default 5s
const { nanoid } = require("nanoid");

const servers = new Map(); // serverId -> { kind, lastSeen, commands: [], pings: [], pongs: [] }

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
};
