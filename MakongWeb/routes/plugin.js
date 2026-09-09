// API the MakongCore plugins (Paper + Velocity) connect to - see
// lib/pluginBridge.js for the protocol/architecture notes and
// ../../MakongCore/README.md for the plugin side.
const express = require("express");
const pluginBridge = require("../lib/pluginBridge");

const router = express.Router();

function auth(req, res, next) {
  if (!pluginBridge.enabled()) {
    return res.status(503).json({ error: "MakongCore bridge is not configured (MAKONGCORE_SECRET unset)." });
  }
  const secret = req.get("X-Makong-Secret") || "";
  if (secret !== process.env.MAKONGCORE_SECRET) {
    return res.status(401).json({ error: "Bad or missing X-Makong-Secret." });
  }
  next();
}

router.use(auth);

// Called once on plugin startup to register this server. Also perfectly fine
// to call again later (e.g. a reconnect) - it's just an upsert.
router.post("/connect", (req, res) => {
  const { serverId, kind } = req.body || {};
  if (!serverId) return res.status(400).json({ error: "serverId is required" });
  pluginBridge.register(String(serverId), kind);
  console.log(`[pluginBridge] ${serverId} connected (${kind === "velocity" ? "velocity" : "paper"})`);
  res.json({ ok: true, serverId: String(serverId) });
});

// Called repeatedly (every few seconds) by each connected plugin. Doubles as
// the heartbeat that keeps it showing "online", and hands back anything
// queued for it since the last poll: commands to run, pings to answer, and
// pongs answering pings it sent earlier.
//
// Also re-affirms `kind` on every single poll (not just the one-time
// /connect) by upserting through register() instead of a bare heartbeat -
// connect() only ever runs once per plugin process lifetime, so without
// this a website restart (which wipes the in-memory server registry) would
// leave every already-running plugin stuck showing pluginBridge.js's
// entry() default of "paper" forever, even a real Velocity proxy, until
// that plugin itself restarts. `kind` is optional so an older plugin build
// that doesn't send it yet still degrades to the old heartbeat-only
// behavior instead of erroring.
router.get("/poll", (req, res) => {
  const serverId = String(req.query.serverId || "");
  if (!serverId) return res.status(400).json({ error: "serverId is required" });
  const kind = req.query.kind;
  if (kind) pluginBridge.register(serverId, String(kind));
  else pluginBridge.heartbeat(serverId);
  res.json({
    ok: true,
    servers: pluginBridge.listServers(),
    commands: pluginBridge.drainCommands(serverId),
    pings: pluginBridge.drainPings(serverId),
    pongs: pluginBridge.drainPongs(serverId),
    profileRequests: pluginBridge.drainProfileRequests(serverId),
    profileAnswers: pluginBridge.drainProfileAnswers(serverId),
  });
});

// A plugin reports back after running a command it was handed via /poll.
router.post("/ack", (req, res) => {
  const { serverId, commandId, ok, result } = req.body || {};
  if (!serverId || !commandId) return res.status(400).json({ error: "serverId and commandId are required" });
  pluginBridge.ackCommand(String(serverId), String(commandId), Boolean(ok), result);
  res.json({ ok: true });
});

// A plugin asking to ping another connected server (e.g. its own /makong
// ping <target> in-game command).
router.post("/ping", (req, res) => {
  const { serverId, target } = req.body || {};
  if (!serverId || !target) return res.status(400).json({ error: "serverId and target are required" });
  const pingId = pluginBridge.queuePing(String(serverId), String(target));
  res.json({ ok: true, pingId });
});

// The target server answering a ping it saw in its own /poll.
router.post("/pong", (req, res) => {
  const { serverId, target, pingId } = req.body || {};
  if (!serverId || !target || !pingId) return res.status(400).json({ error: "serverId, target and pingId are required" });
  pluginBridge.queuePong(String(serverId), String(target), String(pingId));
  res.json({ ok: true });
});

// A plugin (MakongCore's /profile) asking another connected server
// (normally the one with kind "velocity", the only one with nLogin +
// whole-network online data) about a player by name. Same relay shape as
// ping/pong above - see lib/pluginBridge.js.
router.post("/profile-request", (req, res) => {
  const { serverId, target, playerName } = req.body || {};
  if (!serverId || !target || !playerName) {
    return res.status(400).json({ error: "serverId, target and playerName are required" });
  }
  const requestId = pluginBridge.queueProfileRequest(String(serverId), String(target), String(playerName).slice(0, 32));
  res.json({ ok: true, requestId });
});

// The target server answering a profile-request it saw in its own /poll.
const PROFILE_ANSWER_MAX_KEYS = 20;
function sanitizeProfileData(data) {
  if (!data || typeof data !== "object") return {};
  const out = {};
  for (const key of Object.keys(data).slice(0, PROFILE_ANSWER_MAX_KEYS)) {
    const value = data[key];
    if (value === null || typeof value === "number" || typeof value === "boolean") out[key] = value;
    else if (typeof value === "string") out[key] = value.slice(0, 128);
  }
  return out;
}
router.post("/profile-answer", (req, res) => {
  const { serverId, target, requestId, data } = req.body || {};
  if (!serverId || !target || !requestId) {
    return res.status(400).json({ error: "serverId, target and requestId are required" });
  }
  pluginBridge.queueProfileAnswer(String(serverId), String(target), String(requestId), sanitizeProfileData(data));
  res.json({ ok: true });
});

// A plugin's periodic Team/MaTier Star standings report, shown live on the
// public Ranking page (see lib/pluginBridge.js's getLiveRankings()).
const RANKINGS_MAX_ENTRIES = 200;

function sanitizeEntries(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, RANKINGS_MAX_ENTRIES).reduce((out, entry) => {
    if (!entry || typeof entry !== "object") return out;
    const name = String(entry.name || "").slice(0, 64).trim();
    if (!name) return out;
    const clean = { name, star: Number(entry.star) || 0 };
    if (entry.icon) clean.icon = String(entry.icon).slice(0, 8);
    if (entry.tier) clean.tier = String(entry.tier).slice(0, 8);
    out.push(clean);
    return out;
  }, []);
}

router.post("/rankings", (req, res) => {
  const { serverId, teams, players } = req.body || {};
  if (!serverId) return res.status(400).json({ error: "serverId is required" });
  pluginBridge.reportRankings(String(serverId), sanitizeEntries(teams), sanitizeEntries(players));
  res.json({ ok: true });
});

// A connected plugin (currently just MakongVelocity's /mcvlc autorestart)
// queuing a console command on ANOTHER connected server - same command
// queue the admin panel's /admin/servers already uses, just a second
// caller. No extra authorization boundary beyond the shared secret every
// plugin route here already requires: whoever holds MAKONGCORE_SECRET can
// already do this via the admin panel.
const COMMAND_MAX_LENGTH = 500;

router.post("/command", (req, res) => {
  const { serverId, targetServerId, command } = req.body || {};
  if (!serverId || !targetServerId || !command) {
    return res.status(400).json({ error: "serverId, targetServerId and command are required" });
  }
  const clean = String(command).slice(0, COMMAND_MAX_LENGTH).trim();
  if (!clean) return res.status(400).json({ error: "command is empty" });
  // Refuse rather than queue blindly into a target that isn't actually
  // polling right now - a command sitting in a dead target's queue forever
  // looks like success to the caller but never runs. This is the freshest
  // online check there is (based on that server's own last poll).
  if (!pluginBridge.isOnline(String(targetServerId))) {
    return res.status(409).json({ ok: false, error: `${targetServerId} is not currently connected` });
  }
  const commandId = pluginBridge.queueCommand(String(targetServerId), clean, { from: String(serverId) });
  res.json({ ok: true, commandId });
});

module.exports = router;
