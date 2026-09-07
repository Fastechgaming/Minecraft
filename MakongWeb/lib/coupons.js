// Tiny JSON-file "database" for promo codes - same pattern as lib/store.js
// and lib/rankings.js. Admin-curated from /admin/coupons.
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");

const DATA_DIR = path.join(__dirname, "..", "data");
const COUPONS_FILE = path.join(DATA_DIR, "coupons.json");
const COUPONS_SEED_FILE = path.join(DATA_DIR, "coupons.example.json");

// Same reasoning as items.json/rankings.json: gitignored so admin edits
// survive a `git pull`, seeded from the tracked example once so a fresh
// checkout isn't silently empty.
if (!fs.existsSync(COUPONS_FILE) && fs.existsSync(COUPONS_SEED_FILE)) {
  fs.copyFileSync(COUPONS_SEED_FILE, COUPONS_FILE);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return fallback;
  }
}

function writeJson(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function getCoupons() {
  const data = readJson(COUPONS_FILE, { coupons: [] });
  return Array.isArray(data.coupons) ? data.coupons : [];
}

function saveCoupons(list) {
  writeJson(COUPONS_FILE, { coupons: list });
}

function findById(id) {
  return getCoupons().find((c) => c.id === id) || null;
}

function findByCode(code) {
  const norm = String(code || "").trim().toUpperCase();
  if (!norm) return null;
  return getCoupons().find((c) => c.code === norm) || null;
}

function upsertCoupon(coupon) {
  const list = getCoupons();
  const idx = list.findIndex((c) => c.id === coupon.id);
  if (idx === -1) list.push(coupon);
  else list[idx] = { ...list[idx], ...coupon };
  saveCoupons(list);
  return coupon;
}

function deleteCoupon(id) {
  const list = getCoupons();
  const next = list.filter((c) => c.id !== id);
  const removed = next.length !== list.length;
  if (removed) saveCoupons(next);
  return removed;
}

function newId() {
  return `coupon-${nanoid(8)}`;
}

// Validates a code against one order's pre-discount amount and returns the
// discount to apply. Read-only - the caller decides when a code is actually
// "spent" (see recordRedemption below), so a failed/preview check can never
// burn a use.
function evaluate(code, amount) {
  const coupon = findByCode(code);
  if (!coupon) return { ok: false, error: "That coupon code isn't valid." };
  if (!coupon.active) return { ok: false, error: "This coupon is no longer active." };
  if (coupon.expiresAt && Date.now() > coupon.expiresAt) return { ok: false, error: "This coupon has expired." };
  if (coupon.maxUses != null && (coupon.usedCount || 0) >= coupon.maxUses) {
    return { ok: false, error: "This coupon has reached its use limit." };
  }
  if (coupon.minAmount && amount < coupon.minAmount) {
    return { ok: false, error: `This coupon needs an order of at least $${Number(coupon.minAmount).toFixed(2)}.` };
  }

  let discount = coupon.type === "percent" ? (amount * coupon.value) / 100 : coupon.value;
  discount = Math.max(0, Math.min(amount, Math.round(discount * 100) / 100));
  const finalAmount = Math.round((amount - discount) * 100) / 100;
  return { ok: true, coupon, discount, finalAmount };
}

// Counts one redemption toward maxUses. Called once a coupon is actually
// attached to an order (POST /order/:id/coupon), never on a plain
// evaluate(). Not refunded if that order later goes unpaid/rejected - at
// this store's scale (small, manually reviewed via Telegram) that's an
// acceptable tradeoff against the complexity of tracking redemption state
// through the whole order lifecycle; releaseRedemption below only undoes it
// for the one case the UI actually allows, swapping/removing the code
// before payment.
function recordRedemption(id) {
  const list = getCoupons();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], usedCount: (list[idx].usedCount || 0) + 1 };
  saveCoupons(list);
}

function releaseRedemption(id) {
  const list = getCoupons();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], usedCount: Math.max(0, (list[idx].usedCount || 0) - 1) };
  saveCoupons(list);
}

module.exports = {
  getCoupons,
  findById,
  findByCode,
  upsertCoupon,
  deleteCoupon,
  newId,
  evaluate,
  recordRedemption,
  releaseRedemption,
};
