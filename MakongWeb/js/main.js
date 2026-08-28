/**
 * Makong Network — shared site behaviour: nav, footer links, IP copy, live status.
 * Runs on every page. Depends on config.js being loaded first.
 */
(function () {
  "use strict";

  const cfg = window.MAKONG_CONFIG;

  function wireFooterAndNavLinks() {
    const map = {
      discordLink: cfg.links.discord,
      telegramLink: cfg.links.telegram,
      heroDiscord: cfg.links.discord,
      footerDiscord: cfg.links.discord,
      footerTelegram: cfg.links.telegram,
      footerFacebook: cfg.links.facebook,
    };
    Object.entries(map).forEach(([id, url]) => {
      const el = document.getElementById(id);
      if (el && url) el.href = url;
    });

    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  function wireMobileNav() {
    const toggle = document.getElementById("navToggle");
    const links = document.getElementById("navLinks");
    if (!toggle || !links) return;
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  function wireCopyIp() {
    const ipDisplay = `${cfg.server.javaIp}${cfg.server.javaPort !== 25565 ? ":" + cfg.server.javaPort : ""}`;
    const ipEl = document.getElementById("serverIp");
    const stepIpEl = document.getElementById("stepIp");
    if (ipEl) ipEl.textContent = ipDisplay;
    if (stepIpEl) stepIpEl.textContent = ipDisplay;

    const btn = document.getElementById("copyIpBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(cfg.server.javaIp);
        const original = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = original), 1500);
      } catch (err) {
        btn.textContent = "Copy failed";
      }
    });
  }

  async function refreshServerStatus() {
    const dot = document.getElementById("statusDot");
    const text = document.getElementById("statusText");
    const count = document.getElementById("playerCount");
    const max = document.getElementById("playerMax");
    const version = document.getElementById("versionText");
    const note = document.getElementById("statusNote");
    if (!dot || !text) return; // status card not present on this page

    try {
      const res = await fetch(cfg.server.statusApiJava, { cache: "no-store" });
      if (!res.ok) throw new Error("status api error");
      const data = await res.json();

      if (data.online) {
        dot.className = "dot online";
        text.textContent = "Online";
        if (count) count.textContent = data.players?.online ?? "0";
        if (max) max.textContent = `/ ${data.players?.max ?? "?"} players online`;
        if (version) version.textContent = cfg.server.version;
      } else {
        dot.className = "dot offline";
        text.textContent = "Offline";
        if (count) count.textContent = "0";
        if (max) max.textContent = "/ 0 players online";
      }
      if (note) note.textContent = "Live status refreshes every 30 seconds.";
    } catch (err) {
      dot.className = "dot offline";
      text.textContent = "Status unavailable";
      if (note) note.textContent = "Couldn't reach the status service — try again shortly.";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireFooterAndNavLinks();
    wireMobileNav();
    wireCopyIp();
    refreshServerStatus();
    setInterval(refreshServerStatus, 30000);
  });
})();
