// Tiny JSON-file "database" for the Ranking page - same pattern as lib/store.js.
// There's no live stats feed from the Minecraft server (AngkorStore doesn't
// track kills/deaths/star/points), so this is an admin-curated leaderboard:
// you add/edit teams and players from /admin/rankings with their current
// numbers, same way items are curated.
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");

const DATA_DIR = path.join(__dirname, "..", "data");
const RANKINGS_FILE = path.join(DATA_DIR, "rankings.json");
const RANKINGS_SEED_FILE = path.join(DATA_DIR, "rankings.example.json");

// Same reasoning as items.json: gitignored so admin edits survive a `git
// pull`, seeded from the tracked example once so a fresh checkout isn't
// silently empty.
if (!fs.existsSync(RANKINGS_FILE) && fs.existsSync(RANKINGS_SEED_FILE)) {
  fs.copyFileSync(RANKINGS_SEED_FILE, RANKINGS_FILE);
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

const CATEGORIES = ["teams", "players"];

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Kills-per-death - the standard fallback of "just show kills" when nobody
// has died yet, rather than dividing by zero or hiding the stat.
function kdrOf(entry) {
  const kills = Number(entry.kills) || 0;
  const deaths = Number(entry.deaths) || 0;
  return deaths > 0 ? round2(kills / deaths) : round2(kills);
}

function withKdr(entry) {
  return { ...entry, kdr: kdrOf(entry) };
}

function getRankings() {
  const data = readJson(RANKINGS_FILE, { teams: [], players: [] });
  for (const cat of CATEGORIES) if (!Array.isArray(data[cat])) data[cat] = [];
  return {
    teams: data.teams.map(withKdr),
    players: data.players.map(withKdr),
  };
}

function saveRankings(data) {
  writeJson(RANKINGS_FILE, data);
}

function findEntry(category, id) {
  if (!CATEGORIES.includes(category)) return null;
  const data = readJson(RANKINGS_FILE, { teams: [], players: [] });
  return (data[category] || []).find((e) => e.id === id) || null;
}

// Ids are prefixed team-/player- (see newId), so an edit/delete link only
// needs to carry the id - this looks up whichever category it belongs to.
function findAny(id) {
  const data = readJson(RANKINGS_FILE, { teams: [], players: [] });
  for (const cat of CATEGORIES) {
    const found = (data[cat] || []).find((e) => e.id === id);
    if (found) return { category: cat, entry: found };
  }
  return null;
}

function upsertEntry(category, entry) {
  if (!CATEGORIES.includes(category)) throw new Error(`Unknown category: ${category}`);
  const data = readJson(RANKINGS_FILE, { teams: [], players: [] });
  for (const cat of CATEGORIES) if (!Array.isArray(data[cat])) data[cat] = [];
  const list = data[category];
  const idx = list.findIndex((e) => e.id === entry.id);
  if (idx === -1) list.push(entry);
  else list[idx] = { ...list[idx], ...entry };
  saveRankings(data);
  return entry;
}

function deleteEntry(category, id) {
  if (!CATEGORIES.includes(category)) return false;
  const data = readJson(RANKINGS_FILE, { teams: [], players: [] });
  const before = (data[category] || []).length;
  data[category] = (data[category] || []).filter((e) => e.id !== id);
  const removed = data[category].length !== before;
  if (removed) saveRankings(data);
  return removed;
}

function deleteAny(id) {
  const found = findAny(id);
  return found ? deleteEntry(found.category, id) : false;
}

function newId(category) {
  return `${category === "teams" ? "team" : "player"}-${nanoid(8)}`;
}

module.exports = {
  CATEGORIES,
  getRankings,
  findEntry,
  findAny,
  upsertEntry,
  deleteEntry,
  deleteAny,
  newId,
};
