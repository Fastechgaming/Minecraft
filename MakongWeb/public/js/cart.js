// Client-side cart state for the store, persisted in localStorage so it
// survives page reloads and switching between gamemode/category tabs (it
// does NOT survive across the /store <-> /checkout navigation on purpose -
// see store.js's startCartCheckout, which clears it once an order is
// created). Only ever holds what /api/cart/checkout needs (itemId + the
// options that affect price) plus a cached `estimatedAmount` for display -
// the server always re-prices every line from scratch at checkout time
// exactly like a direct purchase does, so nothing here is ever trusted,
// only shown.
const CART_KEY = "makong-cart";

function cartLoad() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let cartLines = cartLoad();

function cartSave() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cartLines));
  } catch {
    /* private browsing / storage full - the cart just won't persist a reload */
  }
  document.dispatchEvent(new CustomEvent("cart:change"));
}

// Two lines are "the same" (quantities add up) only when they're the same
// item bought the same way - a different duration or upgrade trade-in is a
// distinct line even for the same item.
function cartLineKey(line) {
  return [line.itemId, line.duration || "", line.upgradeFromRankId || ""].join("|");
}

const MAX_LINE_QTY = 20;

function cartAdd(line) {
  const key = cartLineKey(line);
  const existing = cartLines.find((l) => cartLineKey(l) === key);
  if (existing) {
    existing.quantity = Math.min(MAX_LINE_QTY, (existing.quantity || 1) + (line.quantity || 1));
    existing.estimatedAmount = line.estimatedAmount;
  } else {
    cartLines.push({ ...line, quantity: Math.min(MAX_LINE_QTY, line.quantity || 1) });
  }
  cartSave();
}

function cartRemove(key) {
  cartLines = cartLines.filter((l) => cartLineKey(l) !== key);
  cartSave();
}

function cartClear() {
  cartLines = [];
  cartSave();
}

function cartCount() {
  return cartLines.reduce((sum, l) => sum + (l.quantity || 1), 0);
}

function cartGet() {
  return cartLines;
}

window.Cart = {
  add: cartAdd,
  remove: cartRemove,
  clear: cartClear,
  count: cartCount,
  get: cartGet,
  key: cartLineKey,
};
