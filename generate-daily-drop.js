import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Config
const OUT_DIR = path.join(__dirname, "recipes");
fs.mkdirSync(OUT_DIR, { recursive: true });

// Env
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const HEMISPHERE = (process.env.DAILY_DROP_HEMISPHERE || "Northern")
  .trim()
  .toLowerCase()
  .startsWith("s")
  ? "Southern"
  : "Northern";

// --- Helpers
function todayISO() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Astronomically approximate seasons using fixed date boundaries.
 * Northern:
 *   Winter: Dec 1–Feb 28/29
 *   Spring: Mar 1–May 31
 *   Summer: Jun 1–Aug 31
 *   Autumn: Sep 1–Nov 30
 * Southern is inverted.
 */
function getSeason(dateISO, hemisphere = "Northern") {
  const [y, m, d] = dateISO.split("-").map(Number);
  const md = Number(`${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`);
  const north =
    (md >= 1201 || md <= 229) ? "Winter" :
    (md >= 301 && md <= 531) ? "Spring" :
    (md >= 601 && md <= 831) ? "Summer" :
    "Autumn";
  if (hemisphere === "Northern") return north;
  // Invert for Southern Hemisphere
  const map = { Winter: "Summer", Spring: "Autumn", Summer: "Winter", Autumn: "Spring" };
  return map[north];
}

function seasonalMood(season) {
  const picks = {
    Winter: ["Cozy", "Calm", "Grounded"],
    Spring: ["Renew", "Fresh", "Bright"],
    Summer: ["Energize", "Uplift", "Cool"],
    Autumn: ["Warmth", "Focus", "Comfort"]
  };
  const arr = picks[season] || ["Balance"];
  return arr[Math.floor(Math.random() * arr.length)];
}

function seasonalOilPool(season) {
  // Common, broadly available oils with Latin names.
  const pools = {
    Winter: [
      "Sweet Orange (Citrus sinensis)",
      "Cedarwood Atlas (Cedrus atlantica)",
      "Frankincense (Boswellia carterii)",
      "Cinnamon Leaf (Cinnamomum verum)",
      "Cardamom (Elettaria cardamomum)"
    ],
    Spring: [
      "Lavender (Lavandula angustifolia)",
      "Lemon (Citrus limon)",
      "Geranium (Pelargonium graveolens)",
      "Spearmint (Mentha spicata)",
      "Eucalyptus Radiata (Eucalyptus radiata)"
    ],
    Summer: [
      "Peppermint (Mentha × piperita)",
      "Lime (Citrus aurantifolia)",
      "Grapefruit (Citrus × paradisi)",
      "Lavender (Lavandula angustifolia)",
      "Tea Tree (Melaleuca alternifolia)"
    ],
    Autumn: [
      "Sweet Orange (Citrus sinensis)",
      "Cedarwood Atlas (Cedrus atlantica)",
      "Clove Bud (Syzygium aromaticum)",
      "Ginger (Zingiber officinale)",
      "Patchouli (Pogostemon cablin)"
    ]
  };
  return pools[season] || pools.Autumn;
}

function pick(objOrArr, n) {
  const arr = Array.isArray(objOrArr) ? objOrArr.slice() : Object.keys(objOrArr);
  const out = [];
  while (out.length < Math.min(n, arr.length)) {
    const i = Math.floor(Math.random() * arr.length);
    out.push(arr.splice(i, 1)[0]);
  }
  return out;
}

function tinyLocalGenerator(dateISO, hemisphere) {
  const season = getSeason(dateISO, hemisphere);
  const oils = seasonalOilPool(season);
  const chosen = pick(oils, 3);

  // Make a simple diffuser & roller recipe with reasonable totals.
  const diffuserDrops = {};
