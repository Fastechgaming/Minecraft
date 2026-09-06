// Ranking page. There's no live stats feed from the Minecraft server, so
// this is an admin-curated leaderboard (see /admin/rankings) - Top Player
// (left on desktop, top on mobile) and Top Team (right/bottom), both ranked
// by Star only.
let rankingData = { teams: [], players: [] };

const playersBoard = document.getElementById("ranking-board-players");
const teamsBoard = document.getElementById("ranking-board-teams");

// Player tier, purely a Star-count lookup - no separate field to maintain.
// M1 is the top tier, M9 the base. These thresholds must match the
// MakongCore plugin's module/matier.yml exactly (matier.tiers) - that's the
// authoritative source once the plugin is reporting live Star data; until
// then this page's Star numbers are admin-curated and this is just where
// they map to a tier for display.
const TIERS = [
  { tier: "M1", min: 1500 },
  { tier: "M2", min: 1200 },
  { tier: "M3", min: 975 },
  { tier: "M4", min: 750 },
  { tier: "M5", min: 600 },
  { tier: "M6", min: 450 },
  { tier: "M7", min: 300 },
  { tier: "M8", min: 150 },
  { tier: "M9", min: 0 },
];
function tierFor(star) {
  const value = Number(star) || 0;
  return (TIERS.find((t) => value >= t.min) || TIERS[TIERS.length - 1]).tier;
}

function medalClass(rank) {
  if (rank === 1) return " rank-1";
  if (rank === 2) return " rank-2";
  if (rank === 3) return " rank-3";
  return "";
}

// `showTier` is true for players (their M-rank comes from Star) and false
// for teams (a team just shows its Star total, no individual tier).
function renderBoard(el, list, showTier) {
  if (!list.length) {
    el.innerHTML = `<p class="board-empty">${escapeHtml(t("ranking.empty"))}</p>`;
    return;
  }

  const sorted = [...list].sort((a, b) => (Number(b.star) || 0) - (Number(a.star) || 0));

  el.innerHTML = `
    <ol class="board-list">
      ${sorted
        .map((entry, i) => {
          const rank = i + 1;
          const star = Number(entry.star) || 0;
          return `
            <li class="board-row${medalClass(rank)}">
              <span class="board-rank">${rank}</span>
              <span class="board-name"><span class="board-avatar">${
                entry.icon ? escapeHtml(entry.icon) : escapeHtml((entry.name || "?").charAt(0).toUpperCase())
              }</span>${escapeHtml(entry.name)}${
            showTier ? `<span class="board-tier">${tierFor(star)}</span>` : ""
          }</span>
              <span class="board-points">⭐ ${star.toLocaleString()}</span>
            </li>`;
        })
        .join("")}
    </ol>
  `;
}

function render() {
  renderBoard(playersBoard, rankingData.players || [], true);
  renderBoard(teamsBoard, rankingData.teams || [], false);
}

async function loadRankings() {
  const loading = `<p class="board-empty">${escapeHtml(t("ranking.loading"))}</p>`;
  playersBoard.innerHTML = loading;
  teamsBoard.innerHTML = loading;
  try {
    rankingData = await fetchJSON("/api/rankings");
  } catch {
    rankingData = { teams: [], players: [] };
  }
  render();
}

document.addEventListener("i18n:change", render);
loadRankings();
