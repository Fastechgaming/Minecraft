// Ranking page - Top Player (left on desktop, top on mobile) and Top Team
// (right/bottom), both ranked by Star. Each board is paginated 10 at a time
// with a search box that filters by name across the *whole* leaderboard
// (not just the current page) - rank numbers always reflect each entry's
// true position in the full sorted list, search included, so searching for
// someone doesn't renumber them.
let rankingData = { teams: [], players: [], live: false };

const PAGE_SIZE = 10;
// Per-board UI state, kept outside rankingData/render() so typing in the
// search box or flipping a page doesn't need a full data refetch.
const boardState = {
  players: { page: 1, query: "" },
  teams: { page: 1, query: "" },
};

const boards = {
  players: {
    listEl: document.getElementById("ranking-board-players"),
    pagerEl: document.getElementById("ranking-pager-players"),
    searchEl: document.getElementById("ranking-search-players"),
    showTier: true,
  },
  teams: {
    listEl: document.getElementById("ranking-board-teams"),
    pagerEl: document.getElementById("ranking-pager-teams"),
    searchEl: document.getElementById("ranking-search-teams"),
    showTier: false,
  },
};

const sourceEl = document.getElementById("ranking-source");

// Player tier. Once the plugin is reporting live Star data, each player
// entry already carries its own `tier` computed by the plugin (MaTierService
// .tierForRanked()) - that's authoritative, since it alone knows the M1
// top-10-only cap. This local table is only a fallback for admin-curated
// entries (see /admin/rankings), which have no such field, and must match
// the plugin's module/matier.yml (matier.tiers) thresholds.
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

// Same palette as the plugin's MaTierService.TIER_HEX - kept in sync by
// hand since it's a different codebase. M9 (dull stone gray, "the
// beginning") through M1 (pure Minecraft green, the top).
const TIER_COLORS = {
  M9: "#AAAAAA",
  M8: "#8B9A7A",
  M7: "#6F9B4A",
  M6: "#5FAF45",
  M5: "#4CAF50",
  M4: "#43A047",
  M3: "#2E8B57",
  M2: "#00A86B",
  M1: "#55FF55",
};

function medalClass(rank) {
  if (rank === 1) return " rank-1";
  if (rank === 2) return " rank-2";
  if (rank === 3) return " rank-3";
  return "";
}

function renderRow(entry, showTier) {
  const star = Number(entry.star) || 0;
  const tier = entry.tier || tierFor(star);
  const tierColor = TIER_COLORS[tier] || TIER_COLORS.M9;
  return `
    <li class="board-row${medalClass(entry.rank)}">
      <span class="board-rank">${entry.rank}</span>
      <span class="board-name">${escapeHtml(entry.name)}${
    showTier ? `<span class="board-tier" style="background:${tierColor}">${escapeHtml(tier)}</span>` : ""
  }</span>
      <span class="board-points">⭐ ${star.toLocaleString()}</span>
    </li>`;
}

// `kind` is "players" or "teams" - looks up boards[kind] and boardState[kind].
function renderBoard(kind, list) {
  const { listEl, pagerEl, showTier } = boards[kind];
  const state = boardState[kind];

  if (!list.length) {
    listEl.innerHTML = `<p class="board-empty">${escapeHtml(t("ranking.empty"))}</p>`;
    pagerEl.innerHTML = "";
    return;
  }

  // Rank is assigned from the full sorted list *before* filtering, so a
  // search result still shows the player/team's true leaderboard position.
  const ranked = [...list]
    .sort((a, b) => (Number(b.star) || 0) - (Number(a.star) || 0))
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  const query = state.query.trim().toLowerCase();
  const filtered = query ? ranked.filter((e) => (e.name || "").toLowerCase().includes(query)) : ranked;

  if (!filtered.length) {
    listEl.innerHTML = `<p class="board-empty">${escapeHtml(t("ranking.noresults"))}</p>`;
    pagerEl.innerHTML = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;

  const start = (state.page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  listEl.innerHTML = `<ol class="board-list">${pageItems.map((e) => renderRow(e, showTier)).join("")}</ol>`;

  if (totalPages <= 1) {
    pagerEl.innerHTML = "";
    return;
  }
  pagerEl.innerHTML = `
    <button type="button" class="pager-btn" data-board="${kind}" data-dir="-1" ${state.page <= 1 ? "disabled" : ""} aria-label="${escapeHtml(t("ranking.pager.prev"))}">&#8249;</button>
    <span class="pager-label">${escapeHtml(t("ranking.pager.page", { page: state.page, total: totalPages }))}</span>
    <button type="button" class="pager-btn" data-board="${kind}" data-dir="1" ${state.page >= totalPages ? "disabled" : ""} aria-label="${escapeHtml(t("ranking.pager.next"))}">&#8250;</button>
  `;
}

function render() {
  renderBoard("players", rankingData.players || []);
  renderBoard("teams", rankingData.teams || []);
  sourceEl.hidden = false;
  sourceEl.textContent = t(rankingData.live ? "ranking.source.live" : "ranking.source.sample");
}

async function loadRankings() {
  const loading = `<p class="board-empty">${escapeHtml(t("ranking.loading"))}</p>`;
  boards.players.listEl.innerHTML = loading;
  boards.teams.listEl.innerHTML = loading;
  try {
    rankingData = await fetchJSON("/api/rankings");
  } catch {
    rankingData = { teams: [], players: [], live: false };
  }
  render();
}

for (const kind of Object.keys(boards)) {
  boards[kind].searchEl.addEventListener("input", (e) => {
    boardState[kind].query = e.target.value;
    boardState[kind].page = 1;
    renderBoard(kind, rankingData[kind] || []);
  });
  boards[kind].pagerEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".pager-btn");
    if (!btn || btn.disabled) return;
    boardState[kind].page += Number(btn.dataset.dir);
    renderBoard(kind, rankingData[kind] || []);
  });
}

document.addEventListener("i18n:change", render);
loadRankings();
