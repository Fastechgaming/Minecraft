// Client for ABA Bank's PayWay checkout - lets Cambodian customers pay by
// card (or ABA PAY/KHQR through the same hosted checkout) instead of the
// site's own KHQR-screenshot-and-wait-for-Telegram-approval flow.
//
// Until ABA_PAYWAY_MERCHANT_ID/API_KEY are set, `enabled()` is false and the
// "Pay by Card" button simply doesn't appear - the existing KHQR flow is
// completely unaffected either way.
//
// Register for sandbox credentials at https://sandbox.payway.com.kh, then
// contact paywaysales@ababank.com for production access once it works.
// Docs: https://github.com/Joselay/aba-payway-docs
const crypto = require("crypto");

function config() {
  return {
    merchantId: process.env.ABA_PAYWAY_MERCHANT_ID || "",
    apiKey: process.env.ABA_PAYWAY_API_KEY || "",
    // Sandbox by default so a half-configured .env can never accidentally
    // take real money - production is opt-in, not opt-out.
    sandbox: String(process.env.ABA_PAYWAY_SANDBOX || "true").toLowerCase() !== "false",
  };
}

function enabled() {
  const { merchantId, apiKey } = config();
  return Boolean(merchantId && apiKey);
}

function baseUrl() {
  return config().sandbox ? "https://checkout-sandbox.payway.com.kh" : "https://checkout.payway.com.kh";
}

function hmac(input) {
  return crypto.createHmac("sha512", config().apiKey).update(input).digest("base64");
}

// UTC, PayWay's required YYYYMMDDHHmmss format.
function reqTime() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    String(d.getUTCFullYear()) +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

// The hidden fields (hash included) for the Purchase API's auto-submitted
// checkout form. `order` is priced entirely server-side already (see
// routes/api.js's /checkout) - this just carries that trusted amount over
// to PayWay, it never re-derives anything from the browser.
//
// firstname/lastname are deliberately left blank: PayWay rejects them if
// they contain digits or underscores ("must not contain numbers or special
// characters"), which ordinary Minecraft usernames do constantly (Steve123,
// .Bedrock_Name). The player name goes in custom_fields instead, which has
// no such restriction and still shows up in PayWay's transaction records.
function buildPurchaseFields(order, { returnUrl, cancelUrl, continueSuccessUrl }) {
  const { merchantId } = config();
  const req_time = reqTime();
  const tran_id = order.id; // nanoid(10) - well under PayWay's 20-char limit, unique per order already
  const amount = Number(order.amount).toFixed(2);
  const items = Buffer.from(
    JSON.stringify([{ name: order.itemName, quantity: order.quantity || 1, price: Number(order.amount) }])
  ).toString("base64");
  const custom_fields = Buffer.from(
    JSON.stringify({ player: order.playerName, orderId: order.id, gamemode: order.gamemode || "" })
  ).toString("base64");

  // Every one of these is part of the hash below, present or not - PayWay
  // recomputes the same concatenation on their end and rejects a mismatch
  // (error 1, "Wrong hash"), so the two lists must always match exactly.
  const fields = {
    req_time,
    merchant_id: merchantId,
    tran_id,
    amount,
    items,
    shipping: "",
    firstname: "",
    lastname: "",
    email: "",
    phone: "",
    type: "purchase",
    payment_option: "cards",
    return_url: Buffer.from(returnUrl).toString("base64"),
    cancel_url: cancelUrl,
    continue_success_url: Buffer.from(continueSuccessUrl).toString("base64"),
    return_deeplink: "",
    currency: order.currency || "USD",
    custom_fields,
    return_params: "",
    payout: "",
    lifetime: "",
    additional_params: "",
    google_pay_token: "",
    skip_success_page: "1",
  };

  const hashInput = [
    fields.req_time,
    fields.merchant_id,
    fields.tran_id,
    fields.amount,
    fields.items,
    fields.shipping,
    fields.firstname,
    fields.lastname,
    fields.email,
    fields.phone,
    fields.type,
    fields.payment_option,
    fields.return_url,
    fields.cancel_url,
    fields.continue_success_url,
    fields.return_deeplink,
    fields.currency,
    fields.custom_fields,
    fields.return_params,
    fields.payout,
    fields.lifetime,
    fields.additional_params,
    fields.google_pay_token,
    fields.skip_success_page,
  ].join("");

  return { ...fields, hash: hmac(hashInput) };
}

// Server-to-server confirmation - the customer's browser bouncing back to
// return_url is never trusted by itself (that's just a page load anyone
// could hit manually), this is what actually confirms money moved.
async function checkTransaction(tranId) {
  if (!enabled()) return { ok: false, reason: "ABA PayWay is not configured." };
  const { merchantId } = config();
  const req_time = reqTime();
  const hash = hmac(`${req_time}${merchantId}${tranId}`);

  try {
    const res = await fetch(`${baseUrl()}/api/payment-gateway/v1/payments/check-transaction-2`, {
      method: "POST",
      body: new URLSearchParams({ req_time, merchant_id: merchantId, tran_id: tranId, hash }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    const code = data.status && data.status.code;
    if (code !== "00" && code !== 0) {
      return { ok: false, reason: (data.status && data.status.message) || `PayWay check failed (${res.status})` };
    }
    const paymentStatusCode = data.data && data.data.payment_status_code;
    // 0 = APPROVED/PRE-AUTH, 2 = PENDING, 3 = DECLINED, 4 = REFUNDED, 7 = CANCELLED
    return { ok: true, approved: paymentStatusCode === 0, paymentStatusCode, raw: data };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { enabled, baseUrl, buildPurchaseFields, checkTransaction };
