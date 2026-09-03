// Ranking page. There's no live stats feed from the Minecraft server, so
// this is an admin-curated leaderboard (see /admin/rankings) - two boards
// (Top Team / Top Player), each sortable by Star, Points, Kills, Deaths or
// KDR (kills per death, computed server-side).
let rankingData = { teams: [], players: [] };
let activeCategory = "teams";
let activeStat = "star";

const board = document.getElementById("ranking-board");
const categoryTabs = document.getElementById("ranking-category-tabs");
const statTabs = document.getElementById("ranking-stat-tabs");

function medalClass(rank) {
  if (rank === 1) return " rank-1";
  if (rank === 2) return " rank-2";
  if (rank === 3) return " rank-3";
  return "";
}

function formatStat(value, stat) {
  if (stat === "kdr") return Number(value).toFixed(2);
  return Number(value).toLocaleString();
}

function render() {
  const list = [...(rankingData[activeCategory] || [])].sort((a, b) => (b[activeStat] || 0) - (a[activeStat] || 0));

  if (!list.length) {
    board.innerHTML = `<p class="board-empty">${escapeHtml(t("ranking.empty"))}</p>`;
    return;
  }

  board.innerHTML = `
    <ol class="board-list">
      ${list
        .map((entry, i) => {
          const rank = i + 1;
          return `
            <li class="board-row${medalClass(rank)}">
              <span class="board-rank">${rank}</span>
              <span class="board-name"><span class="board-avatar">${
                entry.icon ? escapeHtml(entry.icon) : escapeHtml((entry.name || "?").charAt(0).toUpperCase())
              }</span>${escapeHtml(entry.name)}</span>
              <span class="board-points">${escapeHtml(formatStat(entry[activeStat], activeStat))}</span>
            </li>`;
        })
        .join("")}
    </ol>
  `;
}

async function loadRankings() {
  board.innerHTML = `<p class="board-empty">${escapeHtml(t("ranking.loading"))}</p>`;
  try {
    rankingData = await fetchJSON("/api/rankings");
  } catch {
    rankingData = { teams: [], players: [] };
  }
  render();
}

categoryTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-category]");
  if (!btn) return;
  activeCategory = btn.dataset.category;
  categoryTabs.querySelectorAll("[data-category]").forEach((b) => b.classList.toggle("active", b === btn));
  render();
});

statTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-stat]");
  if (!btn) return;
  activeStat = btn.dataset.stat;
  statTabs.querySelectorAll("[data-stat]").forEach((b) => b.classList.toggle("active", b === btn));
  render();
});

document.addEventListener("i18n:change", render);
loadRankings();
