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
router.get("/poll", (req, res) => {
  const serverId = String(req.query.serverId || "");
  if (!serverId) return res.status(400).json({ error: "serverId is required" });
  pluginBridge.heartbeat(serverId);
  res.json({
    ok: true,
    servers: pluginBridge.listServers(),
    commands: pluginBridge.drainCommands(serverId),
    pings: pluginBridge.drainPings(serverId),
    pongs: pluginBridge.drainPongs(serverId),
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

module.exports = router;
