// "Complete your Purchase" page: order summary, KHQR to scan, receipt upload.
const params = new URLSearchParams(location.search);
const orderId = params.get("order");
const content = document.getElementById("checkout-content");

let selectedFile = null;

// The scan hint has the amount in bold in the middle of the sentence, so the
// translated string is split around its {amount} slot rather than escaped whole.
function scanHintHtml(amount) {
  const bold = `<strong>${escapeHtml(formatPrice(amount))}</strong>`;
  return t("checkout.scanHint").split("{amount}").map(escapeHtml).join(bold);
}

function lineTagsHtml(line) {
  const tags = [];
  if (line.upgrade) tags.push(escapeHtml(t("store.upRank")));
  if (line.duration) tags.push(escapeHtml(t(line.duration === "permanent" ? "store.durationPermanent" : "store.duration1Month")));
  if (line.quantity > 1) tags.push(`×${line.quantity}`);
  return tags.length ? `<span class="checkout-item-tags">${tags.join(" · ")}</span>` : "";
}

// A coupon on the order shows as a strikethrough original total plus a
// discount row, before the final (already-discounted) total - same markup
// for both order shapes below.
function couponRowsHtml(order) {
  if (!order.coupon) return "";
  return `
    <div><span>${escapeHtml(t("checkout.discount"))} (${escapeHtml(order.coupon.code)})</span><strong>−${escapeHtml(formatPrice(order.coupon.discount))}</strong></div>`;
}

// A cart order (order.items present) shows one row per item plus the
// combined total; a single-item order keeps its original one-item layout.
function checkoutSummaryMarkup(order) {
  if (order.items) {
    return `
    <div class="checkout-summary checkout-summary-multi">
      <h3>${escapeHtml(t("checkout.items"))}</h3>
      <div class="checkout-cart-rows">
        ${order.items
          .map(
            (line) => `
          <div class="checkout-cart-row">
            <img class="checkout-item-img small" src="${escapeHtml(line.itemImage || "")}" alt="${escapeHtml(line.itemName)}" onerror="this.style.display='none'" />
            <div class="checkout-cart-row-body">
              <div class="checkout-cart-row-name">${escapeHtml(line.itemName)}</div>
              ${lineTagsHtml(line)}
            </div>
            <div class="checkout-cart-row-price">${escapeHtml(formatPrice(line.amount))}</div>
          </div>`
          )
          .join("")}
      </div>
      <div class="checkout-rows">
        <div><span>${escapeHtml(t("checkout.inServerName"))}</span><strong>${escapeHtml(order.playerName)}</strong></div>
        <div><span>${escapeHtml(t("checkout.edition"))}</span><strong>${escapeHtml(t(order.edition === "bedrock" ? "buy.bedrock" : "buy.java"))}</strong></div>
        ${couponRowsHtml(order)}
        <div><span>${escapeHtml(t("checkout.total"))}</span><strong class="price">${escapeHtml(formatPrice(order.amount))}</strong></div>
      </div>
    </div>`;
  }

  return `
    <div class="checkout-summary">
      <img class="checkout-item-img" src="${escapeHtml(order.itemImage || "")}" alt="${escapeHtml(order.itemName)}" onerror="this.style.display='none'" />
      <div class="checkout-summary-text">
        <h3>${escapeHtml(order.itemName)}</h3>
        <p>${escapeHtml(order.itemDesc || "")}</p>
        <div class="checkout-rows">
          <div><span>${escapeHtml(t("checkout.inServerName"))}</span><strong>${escapeHtml(order.playerName)}</strong></div>
          <div><span>${escapeHtml(t("checkout.edition"))}</span><strong>${escapeHtml(t(order.edition === "bedrock" ? "buy.bedrock" : "buy.java"))}</strong></div>
          ${
            order.duration
              ? `<div><span>${escapeHtml(t("checkout.duration"))}</span><strong>${escapeHtml(t(order.duration === "permanent" ? "store.durationPermanent" : "store.duration1Month"))}</strong></div>`
              : ""
          }
          ${
            order.quantity > 1
              ? `<div><span>${escapeHtml(t("store.quantity"))}</span><strong>×${order.quantity}</strong></div>`
              : ""
          }
          ${couponRowsHtml(order)}
          <div><span>${escapeHtml(t("checkout.total"))}</span><strong class="price">${escapeHtml(formatPrice(order.amount))}</strong></div>
        </div>
      </div>
    </div>`;
}

// The coupon step: an input+apply while none is applied, or a small
// "applied" line with a Remove link once one is. Only shown while the
// order is still awaiting payment (checked by the caller).
function couponStepMarkup(order) {
  if (order.coupon) {
    return `
    <div class="checkout-step coupon-step">
      <p class="coupon-applied-line">
        ${escapeHtml(t("checkout.couponApplied", { code: order.coupon.code }))}
        <button type="button" class="link-btn" id="coupon-remove-btn">${escapeHtml(t("checkout.couponRemove"))}</button>
      </p>
      <p class="checkout-hint">${escapeHtml(t("checkout.couponTebexNote"))}</p>
    </div>`;
  }
  return `
    <div class="checkout-step coupon-step">
      <h3>${escapeHtml(t("checkout.couponTitle"))}</h3>
      <div class="coupon-input-row">
        <input type="text" id="coupon-input" placeholder="${escapeHtml(t("checkout.couponPlaceholder"))}" autocomplete="off" />
        <button type="button" class="change-name-btn" id="coupon-apply-btn">${escapeHtml(t("checkout.couponApply"))}</button>
      </div>
    </div>`;
}

function wireCouponStep() {
  const applyBtn = document.getElementById("coupon-apply-btn");
  const removeBtn = document.getElementById("coupon-remove-btn");

  if (applyBtn) {
    const input = document.getElementById("coupon-input");
    const apply = async () => {
      const code = input.value.trim();
      if (!code) return;
      applyBtn.disabled = true;
      applyBtn.textContent = t("checkout.couponApplying");
      try {
        await fetchJSON(`/api/order/${encodeURIComponent(orderId)}/coupon`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        await loadCheckout();
      } catch (err) {
        showToast(err.message);
        applyBtn.disabled = false;
        applyBtn.textContent = t("checkout.couponApply");
      }
    };
    applyBtn.addEventListener("click", apply);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") apply();
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", async () => {
      removeBtn.disabled = true;
      try {
        await fetchJSON(`/api/order/${encodeURIComponent(orderId)}/coupon/remove`, { method: "POST" });
        await loadCheckout();
      } catch (err) {
        showToast(err.message);
        removeBtn.disabled = false;
      }
    });
  }
}

async function loadCheckout() {
  if (!orderId) {
    content.innerHTML = `<p class="empty-note">${escapeHtml(t("checkout.noOrder"))} <a href="/store">${escapeHtml(t("checkout.backToStore"))}</a>.</p>`;
    return;
  }

  let order;
  let cfg;
  try {
    [order, cfg] = await Promise.all([fetchJSON(`/api/order/${encodeURIComponent(orderId)}`), getSiteConfig()]);
  } catch (err) {
    content.innerHTML = `<p class="empty-note">${escapeHtml(t("checkout.loadFailed", { error: err.message }))} <a href="/store">${escapeHtml(t("checkout.backToStore"))}</a>.</p>`;
    return;
  }

  // Returning from Tebex's own checkout page - confirm server-to-server
  // before showing anything else, rather than trusting the redirect alone.
  if (params.get("tebex") === "1" && order.status === "awaiting_payment") {
    return renderTebexVerifying();
  }

  // Already submitted? Send them to the confirmation instead of letting them pay twice.
  if (order.status !== "awaiting_payment") {
    window.location.replace(`/success?order=${encodeURIComponent(order.id)}`);
    return;
  }

  if (params.get("tebexError") === "1") {
    showToast(t("checkout.tebexFailed"));
  }

  const supportHandle = cfg.supportTelegram || "";
  const khqrSrc = cfg.khqrImage || "/images/site/khqr.png";
  content.innerHTML = `
    ${checkoutSummaryMarkup(order)}

    ${couponStepMarkup(order)}

    ${
      cfg.tebexHeadlessEnabled && order.tebexAvailable
        ? `<div class="checkout-step">
            <h3>${escapeHtml(t("checkout.orTebex"))}</h3>
            <p class="checkout-hint">${escapeHtml(t("checkout.tebexHint"))}</p>
            <a class="continue-btn" id="tebex-pay-btn" href="/api/checkout/${encodeURIComponent(orderId)}/pay-tebex">${escapeHtml(t("checkout.payTebex"))}</a>
          </div>`
        : ""
    }

    <div class="checkout-step">
      <h3>${escapeHtml(t("checkout.step1"))}</h3>
      <p class="checkout-hint">${scanHintHtml(order.amount)}</p>
      <img class="checkout-khqr" src="${escapeHtml(khqrSrc)}" alt="KHQR payment code"
           onerror="this.replaceWith(Object.assign(document.createElement('p'),{className:'empty-note',textContent:t('checkout.khqrMissing')}))" />
      <div class="khqr-actions">
        <a class="save-khqr-btn" id="save-khqr" href="${escapeHtml(khqrSrc)}" download="MakongNetwork-KHQR.png">
          ${escapeHtml(t("checkout.saveKhqr"))}
        </a>
        <span class="checkout-hint khqr-save-hint">${escapeHtml(t("checkout.saveHint"))}</span>
      </div>
    </div>

    <div class="checkout-step">
      <h3>${escapeHtml(t("checkout.step2"))}</h3>
      <p class="checkout-hint">${escapeHtml(t("checkout.uploadHint"))}</p>
      <label class="file-drop" id="file-drop">
        <input type="file" id="proof-input" accept="image/*" hidden />
        <span class="file-drop-icon">🧾</span>
        <span class="file-drop-text" id="file-drop-text">${escapeHtml(t("checkout.dropText"))}</span>
        <img class="file-preview" id="file-preview" alt="" hidden />
      </label>
    </div>

    <button class="continue-btn" id="submit-btn" disabled>${escapeHtml(t("checkout.submit"))}</button>
    <p class="checkout-hint centered" id="submit-note">${escapeHtml(t("checkout.submitNote"))}</p>
    ${
      supportHandle
        ? `<p class="checkout-hint centered">${escapeHtml(t("checkout.trouble"))} <a href="https://t.me/${encodeURIComponent(supportHandle)}" target="_blank" rel="noopener">${escapeHtml(t("checkout.contactSupport"))}</a></p>`
        : ""
    }
  `;

  wireFileDrop();
  wireCouponStep();
  document.getElementById("submit-btn").addEventListener("click", submitProof);
}

async function renderTebexVerifying() {
  content.innerHTML = `
    <div class="checkout-step">
      <p class="checkout-hint centered">${escapeHtml(t("checkout.tebexVerifying"))}</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/checkout/${encodeURIComponent(orderId)}/verify-tebex`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Verification failed (${res.status})`);

    if (data.status === "accepted") {
      window.location.replace(`/success?order=${encodeURIComponent(orderId)}`);
      return;
    }

    content.innerHTML = `
      <div class="checkout-step">
        <p class="checkout-hint centered">${escapeHtml(t("checkout.tebexNotPaid"))}</p>
        <button class="continue-btn" id="tebex-recheck-btn">${escapeHtml(t("checkout.tebexCheckAgain"))}</button>
      </div>
    `;
    document.getElementById("tebex-recheck-btn").addEventListener("click", renderTebexVerifying);
  } catch (err) {
    content.innerHTML = `
      <div class="checkout-step">
        <p class="empty-note">${escapeHtml(t("checkout.tebexError", { error: err.message }))}</p>
        <button class="continue-btn" id="tebex-recheck-btn">${escapeHtml(t("checkout.tebexCheckAgain"))}</button>
      </div>
    `;
    document.getElementById("tebex-recheck-btn").addEventListener("click", renderTebexVerifying);
  }
}

function wireFileDrop() {
  const drop = document.getElementById("file-drop");
  const input = document.getElementById("proof-input");
  const text = document.getElementById("file-drop-text");
  const preview = document.getElementById("file-preview");
  const submitBtn = document.getElementById("submit-btn");
  const note = document.getElementById("submit-note");

  function accept(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showToast(t("checkout.notImage"));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast(t("checkout.tooBig"));
      return;
    }
    selectedFile = file;
    text.textContent = file.name;
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    submitBtn.disabled = false;
    note.textContent = t("checkout.ready");
  }

  input.addEventListener("change", () => accept(input.files[0]));

  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add("dragging");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove("dragging");
    })
  );
  drop.addEventListener("drop", (e) => accept(e.dataTransfer.files[0]));
}

async function submitProof() {
  if (!selectedFile) return;
  const submitBtn = document.getElementById("submit-btn");
  const note = document.getElementById("submit-note");
  submitBtn.disabled = true;
  submitBtn.textContent = t("checkout.submitting");
  note.textContent = t("checkout.sending");

  try {
    const body = new FormData();
    body.append("proof", selectedFile);
    const res = await fetch(`/api/order/${encodeURIComponent(orderId)}/proof`, { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    window.location.href = `/success?order=${encodeURIComponent(orderId)}`;
  } catch (err) {
    showToast(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = t("checkout.submit");
    note.textContent = t("checkout.retry");
  }
}

// The whole panel is rendered from JS, so a language switch simply rebuilds it.
document.addEventListener("i18n:change", () => {
  selectedFile = null;
  loadCheckout();
});

loadCheckout();
