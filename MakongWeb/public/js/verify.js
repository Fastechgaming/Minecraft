// /verify: two buttons that just forward to wherever a player actually
// enters their in-game 6-digit code (MakongCore's own Discord bot panel or
// Telegram bot - see MakongCore/module/verification.yml). This page does
// none of the verifying itself, it's purely a friendly "which one do I use"
// landing spot.
async function loadVerify() {
  let cfg = {};
  try {
    cfg = await getSiteConfig();
  } catch {
    /* buttons below fall back to their not-configured toast */
  }

  document.getElementById("verify-discord").addEventListener("click", () => {
    if (cfg.discordLink) window.open(cfg.discordLink, "_blank", "noopener");
    else showToast(t("verify.notConfigured"));
  });

  document.getElementById("verify-telegram").addEventListener("click", () => {
    if (cfg.telegramBotUsername) window.open(`https://t.me/${encodeURIComponent(cfg.telegramBotUsername)}`, "_blank", "noopener");
    else showToast(t("verify.notConfigured"));
  });
}

loadVerify();
