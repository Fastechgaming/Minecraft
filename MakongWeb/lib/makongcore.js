// Client for the MakongCore Minecraft plugin's player-verify API (see
// ../../MakongCore/README.md).
//
// The plugin is what lets this website ask the server questions: is this a real
// player, how many coins do they have, what rank(s) are they. Until it is
// running, every call here reports `linked: false` and the site falls back to
// its own local ledger — so nothing breaks while the plugin isn't installed.
//
// Set these in .env to switch it on:
//   MAKONGCORE_URL=http://your-server:8123
//   MAKONGCORE_SECRET=...
//
// Auth is one shared secret in a header, not a signed request — deliberately
// simpler than a key+HMAC scheme so a mismatch is a one-line `curl`
// check instead of a signature-debugging session. If this server isn't on
// localhost or a private network, put the plugin's port behind a
// tunnel/VPN so that secret isn't sent in the clear (see the plugin's README).
//
// This is a separate, older API from lib/pluginBridge.js's multi-server
// command/ping bridge - that one is the plugin connecting outward to this
// website (no URL needed, works across many servers); this one is the website
// calling a single plugin's own HTTP server for live player/rank data. The two
// share MAKONGCORE_SECRET but are otherwise independent - one, both, or
// neither can be running.
const TIMEOUT_MS = 4000;

function config() {
  return {
    url: (process.env.MAKONGCORE_URL || "").replace(/\/+$/, ""),
    secret: process.env.MAKONGCORE_SECRET || "",
  };
}

function enabled() {
  const { url, secret } = config();
  return Boolean(url && secret);
}

// Tracks whether the last attempt reached the plugin at all (independent of
// whatever HTTP status it answered with), so a Telegram alert only fires on
// the down/up transition rather than once per failed request - this URL is
// hit on essentially every store/games page load, so without that it would
// spam on every single request while the plugin stays down. Only relevant
// once MAKONGCORE_URL/SECRET are actually set (see the early return below,
// before this ever gets involved) - a site that never configured this
// integration should never alert about it.
let unreachable = false;

async function request(method, path, payload) {
  const { url, secret } = config();
  if (!url || !secret) return { ok: false, linked: false, error: "MakongCore is not configured." };

  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const headers = { "X-MakongCore-Secret": secret };
  if (body) headers["Content-Type"] = "application/json";

  try {
    const res = await fetch(`${url}${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (unreachable) {
      unreachable = false;
      // Lazy require - avoids a top-level circular require with
      // telegram/bot.js (which doesn't currently require this module, but
      // keeping the pattern consistent with lib/pluginBridge.js's own note
      // means one fewer thing to get wrong if that ever changes).
      require("../telegram/bot")
        .notifyAdmin(`🟢 *MakongCore reachable again* — the website can reach the plugin's API at \`${url}\` again.`, { key: undefined })
        .catch(() => {});
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`[makongcore] ${method} ${path} -> ${res.status} ${data.error || ""}`);
      return { ok: false, linked: true, status: res.status, ...data };
    }
    return { ...data, ok: true, linked: true };
  } catch (err) {
    // The server being down must never take the website down with it.
    console.warn(`[makongcore] ${method} ${path} failed: ${err.message}`);
    if (!unreachable) {
      unreachable = true;
      require("../telegram/bot")
        .notifyAdmin(
          `🔴 *MakongCore unreachable* — the website couldn't reach the plugin's API at \`${url}\`.\n\nError: ${err.message}`,
          { key: "makongcore-unreachable", cooldownMs: 0 }
        )
        .catch(() => {});
    }
    return { ok: false, linked: false, error: "Could not reach the Minecraft server." };
  }
}

/* ------------------------------- the calls ------------------------------- */

// Name -> does this player exist, and who are they. Also brings back coins and
// every configured rank they hold, so the store and games pages need only
// this one call.
function verifyPlayer(name, edition) {
  return request("POST", "/api/v1/player/verify", { name, edition });
}

function getProfile(uuid) {
  return request("GET", `/api/v1/player/${encodeURIComponent(uuid)}/profile`);
}

function getRanks() {
  return request("GET", "/api/v1/ranks");
}

// Mini-game payout. `transactionId` must be stable for the round so a retry
// cannot pay twice - the plugin de-duplicates on it.
//
// `edition` is always sent alongside `name`, even though `uuid` should
// normally already be known by this point: the plugin only needs `name` (and
// therefore `edition`, to normalise it correctly) when `uuid` is missing, but
// leaving `edition` out entirely made it silently default to "java" on the
// plugin side - which fails Bedrock names (they start with a literal ".",
// which the Java name pattern rejects) and gets misreported as "player not
// found" instead of the real problem.
function grantCoins({ transactionId, uuid, name, edition, amount, reason, meta }) {
  return request("POST", "/api/v1/coins/grant", {
    transactionId,
    uuid,
    name,
    edition,
    amount,
    reason,
    source: "minigame",
    meta,
  });
}

// Store delivery, after the owner presses Accept in Telegram. See the note on
// grantCoins above - edition matters here for the exact same reason.
function deliverPurchase({ transactionId, uuid, name, edition, itemId, itemName, commands, requiresOnline }) {
  return request("POST", "/api/v1/purchase/deliver", {
    transactionId,
    uuid,
    name,
    edition,
    itemId,
    itemName,
    commands,
    requiresOnline: Boolean(requiresOnline),
  });
}

// `expectedFromRankId` is the rank the store priced the upgrade against - the
// plugin refuses with 409/RANK_CHANGED if the player's real rank has moved on
// since, rather than silently acting on stale pricing.
function upgradeRank({ transactionId, uuid, toRankId, expectedFromRankId }) {
  return request("POST", "/api/v1/rank/upgrade", {
    transactionId,
    uuid,
    toRankId,
    expectedFromRankId,
  });
}

function health() {
  return request("GET", "/api/v1/health");
}

module.exports = {
  enabled,
  verifyPlayer,
  getProfile,
  getRanks,
  grantCoins,
  deliverPurchase,
  upgradeRank,
  health,
};
