require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieSession = require("cookie-session");

const apiRoutes = require("./routes/api");
const adminRoutes = require("./routes/admin");
const pluginRoutes = require("./routes/plugin");
const { router: accountRoutes } = require("./routes/account");
const telegram = require("./telegram/bot");

const app = express();
const PORT = process.env.PORT || 3000;
// Bind to 0.0.0.0 by default so it works anywhere. Behind a Cloudflare Tunnel
// set HOST=127.0.0.1 so the app is only reachable through the tunnel and never
// directly on the box's public IP.
const HOST = process.env.HOST || "0.0.0.0";
const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

// Served over HTTPS? Then we are behind a proxy (Cloudflare, nginx), so trust
// its forwarded headers and mark the session cookies Secure. Derived from
// SITE_URL so a local http:// run keeps working untouched.
const BEHIND_HTTPS = String(process.env.SITE_URL || "").startsWith("https://");
if (BEHIND_HTTPS) app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());

// Two separate cookies, each mounted only where it belongs: a short-lived one
// for the admin panel, and a long-lived one holding the player's name that the
// store reads.
const adminSession = cookieSession({
  name: "makong_admin",
  secret: SECRET,
  maxAge: 12 * 60 * 60 * 1000, // 12h
  httpOnly: true,
  sameSite: "lax",
  secure: BEHIND_HTTPS,
});
const playerSession = cookieSession({
  name: "makong_player",
  secret: SECRET,
  maxAge: 400 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: "lax",
  secure: BEHIND_HTTPS,
});

// Liveness probe for the tunnel / process manager. Deliberately does not touch
// the Minecraft server, so it stays instant even when the game server is down.
app.get("/healthz", (req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

// No cookies needed here - plugins are machine clients authenticated by
// shared secret, so this is mounted ahead of the session middleware below.
app.use("/api/plugin", pluginRoutes);

app.use("/api", playerSession);
app.use("/api/account", accountRoutes);
app.use("/api", apiRoutes);
app.use("/admin", adminSession, adminRoutes);

// Clean URLs: /store instead of /store.html. Old .html links (bookmarks,
// anything already indexed) redirect permanently to the clean one instead of
// just quietly still working, so there is one canonical URL per page.
const CLEAN_PAGES = ["store", "checkout", "success", "ranking", "verify"];
app.get(CLEAN_PAGES.map((p) => `/${p}.html`), (req, res) => {
  const page = req.path.replace(/\.html$/, "");
  const qs = req.url.slice(req.path.length); // preserve ?order=... etc.
  res.redirect(301, page + qs);
});

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// Fallback error handler for admin form errors (bad category, bad upload, etc.)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).send(`Something went wrong: ${err.message}`);
});

app.listen(PORT, HOST, () => {
  console.log(`Makong Network website running on ${HOST}:${PORT}`);
  if (BEHIND_HTTPS) console.log(`[https] trusting proxy headers, session cookies marked Secure (SITE_URL=${process.env.SITE_URL})`);
  if (require("./lib/makongcore").enabled()) {
    console.log("[makongcore] plugin bridge configured — verifying names against the Minecraft server");
  } else {
    console.log("[makongcore] no plugin configured — names are accepted without server verification");
  }
  if (require("./lib/pluginBridge").enabled()) {
    console.log("[pluginBridge] MAKONGCORE_SECRET set — /api/plugin is open for MakongCore plugins to connect");
  } else {
    console.log("[pluginBridge] MAKONGCORE_SECRET not set — /api/plugin is disabled");
  }
  telegram.initBot();
  // Telegram-alerts on a connected server dropping off the bridge (or
  // MakongCore's own verify API going unreachable, tracked separately in
  // lib/makongcore.js) - see lib/pluginBridge.js's startHealthCheck().
  require("./lib/pluginBridge").startHealthCheck();
});
