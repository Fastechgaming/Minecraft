/**
 * Makong Network — store page logic.
 *
 * Flow:
 *  1. On load, ask the shopper to pick a region.
 *     - Global  -> redirect to the Tebex store (cfg.links.tebex).
 *     - Cambodia -> stay on-site, show the KHQR / Telegram-approval checkout flow.
 *  2. Shopper picks a rank/coin item -> checkout modal:
 *     Step 1: enter IGN + Telegram username
 *     Step 2: scan KHQR (DEMO — see README for connecting a real Bakong merchant API)
 *     Step 3: confirm on Telegram so an admin can verify payment & deliver the order
 */
(function () {
  "use strict";

  const cfg = window.MAKONG_CONFIG;
  const REGION_KEY = "makong_region";
  let activeCategory = "ranks";
  let currentOrder = null; // { item, orderId, expiresAt }
  let qrTimerInterval = null;

  // ---------- Region selection ----------

  function getSavedRegion() {
    return sessionStorage.getItem(REGION_KEY);
  }

  function applyRegion(region) {
    if (region === "global") {
      window.location.href = cfg.links.tebex;
      return;
    }
    sessionStorage.setItem(REGION_KEY, "cambodia");
    document.getElementById("regionModal").hidden = true;
    const banner = document.getElementById("regionBanner");
    if (banner) banner.hidden = false;
    renderStore();
  }

  function wireRegionModal() {
    const modal = document.getElementById("regionModal");
    const remember = document.getElementById("rememberRegion");

    document.getElementById("regionCambodia").addEventListener("click", () => {
      applyRegion("cambodia");
    });
    document.getElementById("regionGlobal").addEventListener("click", () => {
      applyRegion("global");
    });
    document.getElementById("changeRegionBtn")?.addEventListener("click", () => {
      sessionStorage.removeItem(REGION_KEY);
      modal.hidden = false;
    });

    const saved = getSavedRegion();
    if (saved === "cambodia") {
      modal.hidden = true;
      document.getElementById("regionBanner").hidden = false;
      renderStore();
    } else {
      modal.hidden = false;
    }
  }

  // ---------- Store grid ----------

  function formatKhr(amount) {
    return amount.toLocaleString("en-US") + " ៛";
  }

  function approxUsd(khr) {
    return "≈ $" + (khr / cfg.khqr.usdToKhr).toFixed(2);
  }

  function renderStore() {
    const grid = document.getElementById("storeGrid");
    if (!grid) return;
    const items = cfg.store[activeCategory] || [];
    grid.innerHTML = items
      .map(
        (item) => `
      <div class="item-card">
        ${item.badge ? `<span class="badge">${item.badge}</span>` : ""}
        <h3>${item.name}</h3>
        <div class="price">${formatKhr(item.priceKhr)}</div>
        <div class="price-sub">${approxUsd(item.priceKhr)}</div>
        <ul>${item.perks.map((p) => `<li>${p}</li>`).join("")}</ul>
        <button class="btn btn-primary btn-block" data-buy="${item.id}">Buy Now</button>
      </div>`
      )
      .join("");

    grid.querySelectorAll("[data-buy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = items.find((i) => i.id === btn.dataset.buy);
        if (item) openCheckout(item);
      });
    });
  }

  function wireTabs() {
    document.querySelectorAll(".store-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".store-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        activeCategory = tab.dataset.cat;
        renderStore();
      });
    });
  }

  // ---------- Checkout flow ----------

  function genOrderId() {
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `MK-${Date.now().toString(36).toUpperCase()}-${rand}`;
  }

  function setStep(step) {
    document.getElementById("checkoutStepDetails").hidden = step !== 1;
    document.getElementById("checkoutStepPay").hidden = step !== 2;
    document.getElementById("checkoutStepDelivery").hidden = step !== 3;
    document.querySelectorAll(".step-indicator .seg").forEach((seg) => {
      seg.classList.toggle("done", Number(seg.dataset.step) <= step);
    });
  }

  function openCheckout(item) {
    currentOrder = { item, orderId: null, expiresAt: null };

    document.getElementById("checkoutTitle").textContent = `Checkout — ${item.name}`;
    document.getElementById("orderSummary").innerHTML = `
      <div class="row"><span>${item.name}</span><span>${formatKhr(item.priceKhr)}</span></div>
      <div class="row"><span>Approx. value</span><span>${approxUsd(item.priceKhr)}</span></div>
      <div class="row total"><span>Total due (KHQR)</span><span>${formatKhr(item.priceKhr)}</span></div>
    `;
    document.getElementById("ignInput").value = "";
    document.getElementById("telegramInput").value = "";
    document.getElementById("ignError").style.display = "none";
    document.getElementById("telegramError").style.display = "none";

    setStep(1);
    document.getElementById("checkoutModal").hidden = false;
  }

  function closeCheckout() {
    document.getElementById("checkoutModal").hidden = true;
    clearInterval(qrTimerInterval);
    currentOrder = null;
  }

  function validateDetails() {
    const ign = document.getElementById("ignInput").value.trim();
    const tg = document.getElementById("telegramInput").value.trim();
    const ignOk = ign.length >= 3;
    const tgOk = /^@?[\w]{4,}$/.test(tg);

    document.getElementById("ignError").style.display = ignOk ? "none" : "block";
    document.getElementById("telegramError").style.display = tgOk ? "none" : "block";
    if (!ignOk || !tgOk) return null;
    return { ign, telegram: tg.startsWith("@") ? tg : `@${tg}` };
  }

  function renderQr(orderId, item) {
    const box = document.getElementById("qrBox");
    box.innerHTML = "";

    if (typeof QRCode === "undefined") {
      box.innerHTML = `<p style="color:#900; padding:20px; max-width:220px;">QR library failed to load. Check your connection and reopen this checkout.</p>`;
      return;
    }

    const canvas = document.createElement("canvas");
    box.appendChild(canvas);

    // DEMO payload only — a production integration should request a real EMV/KHQR
    // string + transaction MD5 from your Bakong merchant API on a backend, then
    // poll that backend's "check transaction" endpoint instead of the manual
    // "I've Paid" button below. See README.md.
    const demoPayload = JSON.stringify({
      demo: true,
      merchant: cfg.khqr.merchantName,
      amountKhr: item.priceKhr,
      orderId,
    });

    QRCode.toCanvas(canvas, demoPayload, { width: 220, margin: 1 }, (err) => {
      if (err) box.innerHTML = `<p style="color:#c00; padding:20px;">QR generation failed</p>`;
    });
  }

  function startQrTimer() {
    const timerEl = document.getElementById("qrTimer");
    const durationMs = 3 * 60 * 1000;
    currentOrder.expiresAt = Date.now() + durationMs;

    clearInterval(qrTimerInterval);
    qrTimerInterval = setInterval(() => {
      const remaining = Math.max(0, currentOrder.expiresAt - Date.now());
      const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
      const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
      timerEl.textContent = `Expires in ${mm}:${ss}`;
      if (remaining <= 0) {
        clearInterval(qrTimerInterval);
        timerEl.textContent = "QR expired — go back and try again";
        document.getElementById("payConfirm").disabled = true;
      }
    }, 1000);
  }

  function goToPayStep() {
    const details = validateDetails();
    if (!details) return;
    currentOrder.buyer = details;
    currentOrder.orderId = genOrderId();

    document.getElementById("payOrderId").textContent = `Order ID: ${currentOrder.orderId}`;
    document.getElementById("payConfirm").disabled = false;
    renderQr(currentOrder.orderId, currentOrder.item);
    startQrTimer();
    setStep(2);
  }

  function goToDeliveryStep() {
    clearInterval(qrTimerInterval);
    document.getElementById("deliveryOrderId").textContent = `Order ID: ${currentOrder.orderId}`;

    const msg = encodeURIComponent(
      `Hi! I paid for ${currentOrder.item.name} (${formatKhr(currentOrder.item.priceKhr)}).\n` +
      `Order ID: ${currentOrder.orderId}\nIGN: ${currentOrder.buyer.ign}\n` +
      `Please attach your payment screenshot when you send this.`
    );
    const tgBtn = document.getElementById("telegramApproveBtn");
    tgBtn.href = `${cfg.links.telegramBot}?start=${currentOrder.orderId}&text=${msg}`;

    setStep(3);
  }

  function wireCheckout() {
    document.getElementById("checkoutClose").addEventListener("click", closeCheckout);
    document.getElementById("checkoutCancel").addEventListener("click", closeCheckout);
    document.getElementById("checkoutToPay").addEventListener("click", goToPayStep);
    document.getElementById("payBack").addEventListener("click", () => setStep(1));
    document.getElementById("payConfirm").addEventListener("click", goToDeliveryStep);
    document.getElementById("deliveryDone").addEventListener("click", closeCheckout);

    document.getElementById("checkoutModal").addEventListener("click", (e) => {
      if (e.target.id === "checkoutModal") closeCheckout();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireRegionModal();
    wireTabs();
    wireCheckout();
  });
})();
