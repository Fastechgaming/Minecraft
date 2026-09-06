// Client for Tebex's Headless API - lets a customer pay through Tebex's own
// hosted checkout (Tebex Wallet, cards, etc.) without ever leaving this
// site's own store UI to browse Tebex's storefront first. This is the
// "OurStore -> TebexCheckout -> TebexWallet" flow, as opposed to the
// existing Global-region redirect which sends shoppers to browse and buy on
// Tebex's own storefront directly.
//
// Until TEBEX_WEBSTORE_TOKEN is set, `enabled()` is false and nothing about
// the site changes - the existing KHQR flow and the Global->Tebex-storefront
// redirect both keep working exactly as they do today.
//
// Get your public token from the Tebex Creator Panel: Webstore -> Integrations
// -> Headless API. Docs (official OpenAPI spec):
// https://github.com/tebexio/TebexHeadless-OpenAPI
const HEADLESS_BASE = "https://headless.tebex.io";

function token() {
  return process.env.TEBEX_WEBSTORE_TOKEN || "";
}

function enabled() {
  return Boolean(token());
}

function accountUrl() {
  return `${HEADLESS_BASE}/api/accounts/${token()}`;
}

async function callJson(url, opts) {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(10000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, reason: data.detail || data.title || `Tebex returned ${res.status}` };
    }
    return { ok: true, basket: data.data };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// A basket is a cart-like object Tebex tracks; `custom` is opaque data we
// attach now and get back unchanged from every later GET on this basket -
// that's how verifyBasket below knows which of our own orders it belongs to,
// without needing webhooks or any secret beyond the public token.
function createBasket({ completeUrl, cancelUrl, custom }) {
  return callJson(`${accountUrl()}/baskets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      complete_url: completeUrl,
      cancel_url: cancelUrl,
      custom,
      complete_auto_redirect: true,
    }),
  });
}

// Package-related basket endpoints live under a different path (no account
// token needed - the basket ident alone identifies the store), per Tebex's
// own OpenAPI spec.
function addPackage(basketIdent, packageId, quantity) {
  return callJson(`${HEADLESS_BASE}/api/baskets/${encodeURIComponent(basketIdent)}/packages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ package_id: String(packageId), quantity: Math.max(1, Math.round(quantity) || 1) }),
  });
}

// Server-to-server confirmation - the customer's browser bouncing back to
// complete_url is never trusted by itself, this is what actually confirms
// the basket was paid (`complete: true`).
function getBasket(basketIdent) {
  return callJson(`${accountUrl()}/baskets/${encodeURIComponent(basketIdent)}`, { method: "GET" });
}

module.exports = { enabled, createBasket, addPackage, getBasket };
