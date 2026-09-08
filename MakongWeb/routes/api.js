const express = require("express");
const path = require("path");
const multer = require("multer");
const { nanoid } = require("nanoid");
const store = require("../lib/store");
const rankings = require("../lib/rankings");
const coupons = require("../lib/coupons");
const { getServerStatus } = require("../lib/minecraft");
const { normalizeServerName, isValidRawName } = require("../public/js/playername");
const telegram = require("../telegram/bot");
const makongcore = require("../lib/makongcore");
const pluginBridge = require("../lib/pluginBridge");
const tebex = require("../lib/tebex");
const { current: currentAccount, STORE_SCOPE, getRankLadder } = require("./account");

const router = express.Router();

// Payment screenshots customers upload. Kept out of /public so proofs are not
// publicly browsable - they are only ever sent to the admin's Telegram.
const PROOF_DIR = path.join(__dirname, "..", "data", "proofs");
const proofUpload = multer({
  storage: multer.diskStorage({
    destination: PROOF_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${req.params.id}-${nanoid(6)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error("Please upload an image of your payment receipt."));
    cb(null, true);
  },
});

// Public, safe subset of the site config for the frontend to render.
router.get("/config", (req, res) => {
  const cfg = store.getConfig();
  res.json({
    serverName: cfg.serverName,
    tagline: cfg.tagline,
    welcomeMessage: cfg.welcomeMessage,
    logo: cfg.logo,
    logoIcon: cfg.logoIcon || cfg.logo,
    discordLink: cfg.discordLink,
    // The Telegram bot players message a 6-digit account-verification code
    // to (see MakongCore's module/verification.yml telegram.username) - used
    // by /verify to link straight to it.
    telegramBotUsername: cfg.telegramBotUsername || "",
    khqrImage: cfg.khqrImage,
    tebexUrl: cfg.tebexUrl,
    javaIp: cfg.javaIp,
    javaPort: cfg.javaPort,
    bedrockIp: cfg.bedrockIp,
    bedrockPort: cfg.bedrockPort,
    serverFeatures: cfg.serverFeatures || [],
    socials: cfg.socials,
    supportTelegram: process.env.TELEGRAM_SUPPORT_USERNAME || "",
    // Informational only — the store works either way (see routes/account.js
    // and lib/makongcore.js). True once MAKONGCORE_URL/SECRET are set,
    // which switches name verification, coins and rank from the local
    // ledger to the live Minecraft server.
    makongcoreEnabled: makongcore.enabled(),
    // True once TEBEX_WEBSTORE_TOKEN is set - shows a "Pay via Tebex" option
    // on /checkout for items with a tebexPackageId, alongside KHQR.
    tebexHeadlessEnabled: tebex.enabled(),
  });
});

router.get("/status", async (req, res) => {
  const cfg = store.getConfig();
  const result = await getServerStatus(cfg);
  res.json(result);
});

router.get("/items", (req, res) => {
  res.json({ ...store.getItems(), gamemodes: store.GAMEMODES });
});

// Prefers live Team/MaTier Star standings reported by the plugin (see
// lib/pluginBridge.js) - falls back to the admin-curated JSON whenever no
// server has reported fresh data (plugin bridge not configured, or every
// connected server has gone stale/offline).
router.get("/rankings", (req, res) => {
  const live = pluginBridge.getLiveRankings();
  if (live) return res.json({ ...live, live: true });
  res.json({ ...rankings.getRankings(), live: false });
});

// Public, safe subset of an order - used by /checkout and /success, and by
// the coupon routes below to return the updated order after a change.
// Deliberately omits the delivery command and the stored proof filename. A
// coupon can only ever be honored on the KHQR path (Tebex packages have no
// price override - see lib/tebex.js), so tebexAvailable is forced false
// once one is applied rather than letting the customer pay full price on
// Tebex after being shown a discounted total.
function publicOrder(order) {
  const couponInfo = order.coupon ? { code: order.coupon.code, discount: order.coupon.discount } : null;

  if (order.items) {
    const tebexAvailable =
      !order.coupon &&
      order.items.every((line) => {
        const item = store.findItem(line.itemId);
        return Boolean(item && item.tebexPackageId);
      });
    return {
      id: order.id,
      items: order.items.map((line) => ({
        itemId: line.itemId,
        itemName: line.itemName,
        itemImage: line.itemImage,
        itemDesc: line.itemDesc,
        amount: line.amount,
        duration: line.duration || null,
        quantity: line.quantity || 1,
        upgrade: line.upgrade || null,
      })),
      amount: order.amount,
      originalAmount: order.originalAmount || null,
      coupon: couponInfo,
      currency: order.currency,
      playerName: order.playerName,
      edition: order.edition,
      status: order.status,
      createdAt: order.createdAt,
      tebexAvailable,
    };
  }

  const item = store.findItem(order.itemId);
  return {
    id: order.id,
    itemId: order.itemId,
    itemName: order.itemName,
    itemImage: order.itemImage,
    itemDesc: order.itemDesc,
    amount: order.amount,
    originalAmount: order.originalAmount || null,
    coupon: couponInfo,
    currency: order.currency,
    playerName: order.playerName,
    edition: order.edition,
    duration: order.duration || null,
    quantity: order.quantity || 1,
    status: order.status,
    createdAt: order.createdAt,
    // Only true when this item has a tebexPackageId configured - lets
    // /checkout decide whether to show the "Pay via Tebex" button at all.
    tebexAvailable: !order.coupon && Boolean(item && item.tebexPackageId),
  };
}

router.get("/order/:id", (req, res) => {
  const order = store.findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(publicOrder(order));
});

// Applies (or swaps) a coupon code on an order that hasn't been paid yet.
// Always evaluated against the order's original pre-discount amount, so
// re-applying a different code never compounds off an already-discounted
// total; swapping releases the old code's redemption first.
router.post("/order/:id/coupon", (req, res) => {
  const order = store.findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "awaiting_payment") {
    return res.status(400).json({ error: "This order has already been submitted." });
  }

  const baseAmount = order.originalAmount != null ? order.originalAmount : order.amount;
  const result = coupons.evaluate((req.body || {}).code, baseAmount);
  if (!result.ok) return res.status(400).json({ error: result.error });

  if (order.coupon) coupons.releaseRedemption(order.coupon.id);
  coupons.recordRedemption(result.coupon.id);

  const updated = store.updateOrder(order.id, {
    originalAmount: baseAmount,
    amount: result.finalAmount,
    coupon: { id: result.coupon.id, code: result.coupon.code, type: result.coupon.type, value: result.coupon.value, discount: result.discount },
  });

  res.json(publicOrder(updated));
});

router.post("/order/:id/coupon/remove", (req, res) => {
  const order = store.findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "awaiting_payment") {
    return res.status(400).json({ error: "This order has already been submitted." });
  }
  if (!order.coupon) return res.status(400).json({ error: "No coupon is applied." });

  coupons.releaseRedemption(order.coupon.id);
  const updated = store.updateOrder(order.id, {
    amount: order.originalAmount != null ? order.originalAmount : order.amount,
    originalAmount: undefined,
    coupon: undefined,
  });

  res.json(publicOrder(updated));
});

const MAX_KEY_QTY = 20;
const MAX_CART_LINES = 20;

// Thrown by resolveLine()/resolveBuyer() for a problem with the request
// itself (bad item id, item no longer for sale, not signed in) - callers
// turn this into a 400/401; anything else bubbles up as a 500 the same way
// an unexpected error always has.
class CheckoutError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// Prices and validates one line (an item + the options that affect its
// price - quantity, duration, an upgrade trade-in) into the shape saved on
// an order. Shared by the single-item /checkout below and the multi-item
// /cart/checkout, so a cart line is priced by exactly the same rules a
// direct purchase always has been - never trusts anything the browser computed.
async function resolveLine({ itemId, upgradeFromRankId, duration, quantity: rawQuantity }, ladderCache) {
  if (!itemId) throw new CheckoutError("itemId is required");
  const item = store.findItem(itemId);
  if (!item) throw new CheckoutError("Item not found");
  if (item.comingSoon) throw new CheckoutError(`${item.name} isn't available for purchase yet.`);

  let amount = item.price;
  let upgrade = null;
  const isRankItem = store.getItems().ranks.some((i) => i.id === item.id);

  // Keys can be bought in bulk - never trust the client's quantity or the
  // total it computed, just the count, clamped to a sane range and
  // multiplied against the catalogue price. Meaningless for ranks/other.
  const quantity = item.category === "keys" ? Math.min(MAX_KEY_QTY, Math.max(1, Math.round(Number(rawQuantity)) || 1)) : 1;
  amount = Math.round(amount * quantity * 100) / 100;

  // Ranks are sold for 1 month or permanently - never trust the client's
  // price, recompute from the catalogue. Permanent defaults to 3x the
  // monthly price unless the admin set an explicit permanentPrice.
  // Meaningless for a trade-in upgrade (that path prices its own ladder
  // step below), so it's resolved first and simply overridden there.
  const rankDuration = isRankItem && duration === "permanent" ? "permanent" : isRankItem ? "monthly" : null;
  if (rankDuration === "permanent") amount = store.permanentPriceFor(item);

  if (upgradeFromRankId && isRankItem) {
    if (!ladderCache.has(item.gamemode)) ladderCache.set(item.gamemode, await getRankLadder(item.gamemode));
    const { ranks } = ladderCache.get(item.gamemode);
    const toRank = ranks.find((r) => r.itemId === item.id || `rank-${r.id}` === item.id);
    const fromRank = ranks.find((r) => r.id === upgradeFromRankId);
    if (toRank && fromRank && fromRank.weight < toRank.weight) {
      amount = Math.max(0, Math.round((toRank.priceUsd - fromRank.priceUsd) * 100) / 100);
      upgrade = {
        fromRankId: fromRank.id,
        fromGroup: fromRank.group || fromRank.id,
        toRankId: toRank.id,
        toGroup: toRank.group || toRank.id,
      };
    }
    // An invalid/stale from-rank falls through to a plain full-price
    // purchase rather than failing outright - the player still gets what
    // they asked to buy, just without the discount they no longer qualify for.
  }

  return {
    itemId: item.id,
    itemName: item.name,
    itemImage: item.image,
    itemDesc: item.shortDesc || "",
    gamemode: item.gamemode || null,
    amount,
    currency: item.currency || "USD",
    upgrade, // null for a plain purchase; {fromRankId, fromGroup, toRankId, toGroup} for an upgrade
    duration: upgrade ? null : rankDuration, // "monthly" | "permanent" for a plain rank buy, null otherwise
    quantity, // 1 for ranks/other; the bought count for keys
  };
}

// Verifies the signed-in account and returns its resolved edition + delivery
// name - shared by both checkout routes below.
function resolveBuyer(req) {
  // No `makongcore.enabled()` gate here on purpose: everything below
  // (currentAccount, getRankLadder, store.findItem/saveOrder) already has
  // its own plugin-absent fallback — see lib/makongcore.js's own comment
  // ("nothing breaks while the plugin isn't installed"). Without the plugin
  // the typed name is simply accepted as-is and delivery falls back to a
  // manual Telegram-approved command, exactly as documented.
  // The buyer is whoever is signed in — the store makes you verify a name
  // before it will show you a Buy button, so there is nothing to type here.
  const account = currentAccount(req, STORE_SCOPE);
  if (!account) throw new CheckoutError("Verify your Minecraft name before buying.", "NOT_SIGNED_IN");
  const edition = account.edition === "bedrock" ? "bedrock" : "java";
  if (!isValidRawName(account.player, edition)) {
    throw new CheckoutError("Your saved name is no longer valid — please verify it again.");
  }
  return { account, edition, finalName: normalizeServerName(account.player, edition) };
}

// Step 1 of checkout: player name + edition. Creates a pending order and hands
// back its id; the customer is then sent to /checkout to pay + upload proof.
router.post("/checkout", async (req, res) => {
  try {
    const { itemId, upgradeFromRankId, duration, quantity } = req.body || {};
    const buyer = resolveBuyer(req);
    const line = await resolveLine({ itemId, upgradeFromRankId, duration, quantity }, new Map());

    const order = {
      id: nanoid(10),
      itemId: line.itemId,
      itemName: line.itemName,
      itemImage: line.itemImage,
      itemDesc: line.itemDesc,
      gamemode: line.gamemode,
      amount: line.amount,
      currency: line.currency,
      playerName: buyer.finalName,
      playerUuid: buyer.account.uuid || null,
      edition: buyer.edition,
      upgrade: line.upgrade,
      duration: line.duration,
      quantity: line.quantity,
      status: "awaiting_payment",
      createdAt: Date.now(),
    };
    store.saveOrder(order);

    res.json({ orderId: order.id });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return res.status(err.code === "NOT_SIGNED_IN" ? 401 : 400).json({ error: err.message, code: err.code });
    }
    console.error("[checkout] error:", err);
    telegram.notifyAdmin(`🔥 *Store error* — /api/checkout threw: ${err.message}`, { key: "checkout-error", cooldownMs: 5 * 60 * 1000 }).catch(() => {});
    res.status(500).json({ error: err.message || "Failed to start checkout" });
  }
});

// Cart checkout: same rules as /checkout above, just applied to every line
// in the cart and totalled into one order - one KHQR payment (or one Tebex
// basket, if every line has a tebexPackageId) covers the whole cart.
router.post("/cart/checkout", async (req, res) => {
  try {
    const buyer = resolveBuyer(req);

    const { lines: rawLines } = req.body || {};
    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      return res.status(400).json({ error: "Your cart is empty." });
    }
    if (rawLines.length > MAX_CART_LINES) {
      return res.status(400).json({ error: `A cart can hold at most ${MAX_CART_LINES} items.` });
    }

    const ladderCache = new Map();
    const items = [];
    for (const raw of rawLines) {
      items.push(await resolveLine(raw || {}, ladderCache));
    }

    const amount = Math.round(items.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
    const currency = items[0].currency;

    const order = {
      id: nanoid(10),
      items,
      amount,
      currency,
      playerName: buyer.finalName,
      playerUuid: buyer.account.uuid || null,
      edition: buyer.edition,
      status: "awaiting_payment",
      createdAt: Date.now(),
    };
    store.saveOrder(order);

    res.json({ orderId: order.id });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return res.status(err.code === "NOT_SIGNED_IN" ? 401 : 400).json({ error: err.message, code: err.code });
    }
    console.error("[cart checkout] error:", err);
    telegram.notifyAdmin(`🔥 *Store error* — /api/cart/checkout threw: ${err.message}`, { key: "cart-checkout-error", cooldownMs: 5 * 60 * 1000 }).catch(() => {});
    res.status(500).json({ error: err.message || "Failed to start checkout" });
  }
});

// Step 2: customer uploads their payment screenshot. We forward it straight to
// the admin's Telegram with Accept / Reject buttons.
router.post("/order/:id/proof", (req, res, next) => {
  proofUpload.single("proof")(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });
    try {
      const order = store.findOrder(req.params.id);
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (!req.file) return res.status(400).json({ error: "Please attach your payment screenshot." });

      const updated = store.updateOrder(order.id, {
        status: "pending_review",
        proofFile: req.file.filename,
        submittedAt: Date.now(),
      });

      const sent = await telegram.sendOrderForReview(updated, path.join(PROOF_DIR, req.file.filename));
      if (!sent.ok) {
        // The order is still recorded, so the owner can find it in the admin
        // panel even when Telegram is misconfigured or down.
        console.error("[order] Telegram notification failed:", sent.reason);
      }

      res.json({ ok: true, orderId: order.id, notified: sent.ok });
    } catch (err) {
      next(err);
    }
  });
});

// Kicks off "Pay via Tebex": create a basket, add every line's matching
// Tebex package to it (a cart order just adds more than one - Tebex baskets
// are cart-shaped already), and send the customer straight to Tebex's own
// checkout to pay by wallet/card. Never trusts anything back from that page
// by itself - see verify-tebex below, which re-confirms server-to-server.
router.get("/checkout/:id/pay-tebex", async (req, res) => {
  const fail = (reason) => {
    console.error("[tebex] pay-tebex failed:", reason);
    res.redirect(`/checkout?order=${encodeURIComponent(req.params.id)}&tebexError=1`);
  };
  // Same as fail(), plus a Telegram alert - reserved for reasons that mean
  // something is actually broken (Tebex misconfigured, its API failing, a
  // catalog gap) rather than routine navigation (a stale order link, an
  // order already decided) that isn't worth paging anyone about.
  const failOperational = (reason) => {
    telegram.notifyAdmin(`🔥 *Tebex checkout error* — ${reason}`, { key: "tebex-pay-error", cooldownMs: 5 * 60 * 1000 }).catch(() => {});
    fail(reason);
  };

  if (!tebex.enabled()) return fail("Tebex is not configured");

  const order = store.findOrder(req.params.id);
  if (!order) return fail("Order not found");
  if (order.status !== "awaiting_payment") return fail(`Order already ${order.status}`);
  // A coupon can only be honored on the KHQR path - Tebex packages have no
  // price override (see lib/tebex.js), so a discounted order can't be sent
  // there without silently charging full price.
  if (order.coupon) return fail("This order has a coupon applied — pay with KHQR to use it");

  const lines = order.items || [{ itemId: order.itemId, quantity: order.quantity || 1 }];
  const resolved = [];
  for (const line of lines) {
    const item = store.findItem(line.itemId);
    if (!item || !item.tebexPackageId) return failOperational(`Item has no linked Tebex package: ${line.itemId}`);
    resolved.push({ item, quantity: line.quantity || 1 });
  }

  const origin = `${req.protocol}://${req.get("host")}`;
  const completeUrl = `${origin}/checkout?order=${order.id}&tebex=1`;
  const cancelUrl = `${origin}/checkout?order=${order.id}`;

  const basketResult = await tebex.createBasket({
    completeUrl,
    cancelUrl,
    custom: { orderId: order.id },
  });
  if (!basketResult.ok) return failOperational(basketResult.reason);

  const basketIdent = basketResult.basket.ident;
  let checkoutUrl = null;
  for (const { item, quantity } of resolved) {
    const packageResult = await tebex.addPackage(basketIdent, item.tebexPackageId, quantity);
    if (!packageResult.ok) return failOperational(packageResult.reason);
    checkoutUrl = (packageResult.basket.links && packageResult.basket.links.checkout) || checkoutUrl;
  }
  if (!checkoutUrl) return failOperational("Tebex did not return a checkout link");

  store.updateOrder(order.id, { tebexBasketIdent: basketIdent });
  res.redirect(checkoutUrl);
});

// Step after the customer returns from Tebex's checkout (?tebex=1 on
// /checkout) - re-checks the basket server-to-server before trusting that the
// payment actually went through, then delivers exactly like a manually
// Accepted order would.
router.post("/checkout/:id/verify-tebex", async (req, res) => {
  if (!tebex.enabled()) return res.status(400).json({ error: "Tebex is not configured" });

  const order = store.findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (order.status === "accepted") return res.json({ ok: true, status: "accepted" });
  if (order.status === "rejected") return res.json({ ok: true, status: "rejected" });

  if (!order.tebexBasketIdent) {
    return res.status(400).json({ error: "This order was never sent to Tebex." });
  }

  const basketResult = await tebex.getBasket(order.tebexBasketIdent);
  if (!basketResult.ok) {
    console.error("[tebex] verify-tebex failed:", basketResult.reason);
    telegram.notifyAdmin(`🔥 *Tebex verify error* — ${basketResult.reason}`, { key: "tebex-verify-error", cooldownMs: 5 * 60 * 1000 }).catch(() => {});
    return res.status(502).json({ error: basketResult.reason });
  }

  if (!basketResult.basket.complete) {
    return res.json({ ok: true, status: "not_paid" });
  }

  const result = await telegram.announceAccepted(order, { label: "💳 *Paid via Tebex*" });
  if (!result.ok) console.error("[tebex] Telegram notification failed:", result.reason);

  res.json({ ok: true, status: "accepted" });
});

module.exports = router;
