const express = require("express");
const multer = require("multer");
const path = require("path");
const { nanoid } = require("nanoid");
const store = require("../lib/store");

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "..", "public", "images", "items"),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ".png";
      cb(null, `${nanoid(10)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error("Only image uploads are allowed"));
    cb(null, true);
  },
});

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect("/admin/login");
}

router.get("/login", (req, res) => {
  res.render("login", { error: null });
});

router.post("/login", express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect("/admin");
  }
  res.render("login", { error: "Wrong username or password." });
});

router.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/admin/login");
});

router.get("/", requireAuth, (req, res) => {
  const items = store.getItems();
  res.render("items", { items, categories: store.CATEGORIES, gamemodes: store.GAMEMODES });
});

router.get("/items/new", requireAuth, (req, res) => {
  res.render("item-form", {
    item: null,
    categories: store.CATEGORIES,
    gamemodes: store.GAMEMODES,
    defaultCategory: req.query.category || "ranks",
    defaultGamemode: req.query.gamemode || store.GAMEMODES[0].id,
  });
});

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

router.post("/items", requireAuth, upload.single("imageFile"), (req, res, next) => {
  try {
    const { category, gamemode, name, price, permanentPrice, shortDesc, infoText, videoUrl, imageUrl, deliveryCommand } = req.body;
    if (!store.CATEGORIES.includes(category)) throw new Error("Invalid category");
    if (!store.GAMEMODES.some((g) => g.id === gamemode)) throw new Error("Invalid gamemode");

    const slug = slugify(name);

    // A rank item is matched to the Minecraft plugin's LuckPerms ladder (and
    // to the catalogue-derived fallback ladder when the plugin isn't
    // connected) by exact id: `rank-<gamemode>-<ladder id>` - see
    // AngkorStore's config.yml `ranks.ladder`. Ranks are per-gamemode
    // (EcoSMP's VIP and BoxPvP's VIP are unrelated), so the gamemode is part
    // of the id, not just a random nanoid suffix - it has to be
    // `rank-<gamemode>-<slug>` with a trailing "rank" word stripped (name
    // "VIP Rank" in EcoSMP -> id rank-ecosmp-vip), or Up Rank silently won't
    // recognise it.
    let id;
    if (category === "ranks") {
      const rankSlug = slug.replace(/-rank$/, "") || slug;
      id = `rank-${gamemode}-${rankSlug}`;
      if (store.findItem(id)) id = `rank-${gamemode}-${rankSlug}-${nanoid(4)}`;
    } else {
      id = `${category}-${gamemode}-${slug}-${nanoid(4)}`;
    }

    const item = {
      id,
      name,
      price: Number(price),
      permanentPrice: permanentPrice === "" || permanentPrice == null ? null : Number(permanentPrice),
      currency: "USD",
      shortDesc: shortDesc || "",
      infoText: infoText || "",
      videoUrl: videoUrl || "",
      deliveryCommand: deliveryCommand || "",
      image: req.file ? `/images/items/${req.file.filename}` : imageUrl || "/images/items/placeholder-other.svg",
      category,
      gamemode,
    };
    store.upsertItem(category, item);
    res.redirect("/admin");
  } catch (err) {
    next(err);
  }
});

router.get("/items/:id/edit", requireAuth, (req, res) => {
  const item = store.findItem(req.params.id);
  if (!item) return res.status(404).send("Item not found");
  res.render("item-form", {
    item,
    categories: store.CATEGORIES,
    gamemodes: store.GAMEMODES,
    defaultCategory: item.category,
    defaultGamemode: item.gamemode || store.GAMEMODES[0].id,
  });
});

router.post("/items/:id", requireAuth, upload.single("imageFile"), (req, res, next) => {
  try {
    const existing = store.findItem(req.params.id);
    if (!existing) return res.status(404).send("Item not found");

    const { category, gamemode, name, price, permanentPrice, shortDesc, infoText, videoUrl, imageUrl, deliveryCommand } = req.body;
    if (!store.CATEGORIES.includes(category)) throw new Error("Invalid category");
    if (!store.GAMEMODES.some((g) => g.id === gamemode)) throw new Error("Invalid gamemode");

    const updated = {
      ...existing,
      name,
      price: Number(price),
      permanentPrice: permanentPrice === "" || permanentPrice == null ? null : Number(permanentPrice),
      shortDesc: shortDesc || "",
      infoText: infoText || "",
      videoUrl: videoUrl || "",
      deliveryCommand: deliveryCommand || "",
      image: req.file ? `/images/items/${req.file.filename}` : imageUrl || existing.image,
      category,
      gamemode,
    };

    if (category !== existing.category) store.deleteItem(existing.id);
    store.upsertItem(category, updated);
    res.redirect("/admin");
  } catch (err) {
    next(err);
  }
});

router.post("/items/:id/delete", requireAuth, (req, res) => {
  store.deleteItem(req.params.id);
  res.redirect("/admin");
});

module.exports = router;
