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

  const diffuserDrops = {};
  diffuserDrops[chosen[0]] = 3;
  diffuserDrops[chosen[1]] = 2;
  diffuserDrops[chosen[2]] = 1;

  const rollerDrops = {};
  rollerDrops[chosen[0]] = 4;
  rollerDrops[chosen[1]] = 3;

  const mood = seasonalMood(season);

  return {
    app: "The Daily Drop",
    date: dateISO,
    season,
    hemisphere,
    title: `${season} ${mood} Blend`,
    oils: chosen,
    formats: {
      diffuser: {
        drops: diffuserDrops,
        notes: "Use in a well-ventilated area; adjust water per manufacturer."
      },
      roller: {
        size_ml: 10,
        dilution_percent: season === "Winter" ? 2.0 : 3.0,
        drops: rollerDrops,
        carrier: "fractionated coconut or jojoba"
      },
      spray_optional: {
        size_ml: 30,
        drops: { [chosen[0]]: 6, [chosen[1]]: 4 },
        base: "distilled water + 95% ethanol",
        note: "Shake well before each use; avoid fabrics that spot."
      }
    },
    why_it_works:
      season === "Summer"
        ? "Cool mint lifts and bright citrus brightens while herbal floral keeps it soft."
        : season === "Winter"
        ? "Warm woods and resin provide a cozy base while sweet citrus adds lift."
        : season === "Spring"
        ? "Fresh citrus and green floral notes evoke renewal and clean air."
        : "Comforting spice and wood pair with sweet notes for a grounded, focused feel.",
    safety: [
      "Patch test; dilute for skin.",
      "Avoid eyes/mucosa; keep from children & pets.",
      "Do not ingest oils.",
      "Consult a qualified professional if pregnant, nursing, or under medical care."
    ],
    tags: [`Season:${season}`, `Mood:${mood}`, "Use:Home"]
  };
}

// --- Variety helpers
// The model used to get the same prompt every day, so it kept returning the
// same mix (e.g. "Golden Leaf Glow" five days running). We now tell it what was
// posted recently and give each day a different focus.

function recentRecipes(dateISO, days = 21) {
  return fs.readdirSync(OUT_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < dateISO)
    .sort()
    .slice(-days)
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), "utf8")); }
      catch { return null; }
    })
    .filter(Boolean);
}

function oilKey(r) {
  const drops = r?.formats?.diffuser?.drops || {};
  return Object.keys(drops).map(k => k.toLowerCase().split(" ")[0]).sort().join("+");
}

const DAILY_FOCUS = [
  "Morning focus for work or study",
  "Evening wind-down before sleep",
  "Fresh, clean home after tidying",
  "Uplifting midday mood boost",
  "Calm and steady for a busy day",
  "Cozy gathering with friends or family",
  "Grounding meditation or yoga",
  "Creative energy for a hobby",
  "Bright, airy weekend morning",
  "Soothing reading nook"
];

function dailyFocus(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dayOfYear = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
  return DAILY_FOCUS[dayOfYear % DAILY_FOCUS.length];
}

function isRepeat(result, recent) {
  const title = String(result?.title || "").trim().toLowerCase();
  const recentTitles = new Set(recent.map(r => String(r.title || "").trim().toLowerCase()));
  const recentOils = new Set(recent.slice(-7).map(oilKey));
  return recentTitles.has(title) || recentOils.has(oilKey(result));
}

// The app shows whole drops; round halves and drop non-numeric entries
// (the model occasionally puts "carrier" inside "drops").
function normalizeDrops(result) {
  for (const fmt of ["diffuser", "roller", "spray_optional"]) {
    const drops = result?.formats?.[fmt]?.drops;
    if (!drops || typeof drops !== "object") continue;
    for (const [k, v] of Object.entries(drops)) {
      const n = Math.round(Number(v));
      if (Number.isFinite(n) && n > 0) drops[k] = n; else delete drops[k];
    }
  }
  return result;
}

// --- DeepSeek Model Call
async function callDeepSeek(dateISO, season, hemisphere, recent = []) {
  if (!DEEPSEEK_API_KEY) throw new Error("no-deepseek-key");
  const sysPath = path.join(__dirname, "prompts/system-daily-drop.txt");
  const sys = fs.existsSync(sysPath) ? fs.readFileSync(sysPath, "utf8") : "You are a professional aromatherapist. Output valid JSON only.";
  
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 1.0,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: [
            `Today is ${dateISO}. Hemisphere: ${hemisphere}. Season: ${season}.`,
            `Today's focus: ${dailyFocus(dateISO)}.`,
            recent.length
              ? `Recent mixes (do NOT reuse these titles, and use a different combination of oils than any of them):\n` +
                recent.map(r => `- ${r.date}: "${r.title}" (${Object.keys(r?.formats?.diffuser?.drops || {}).join(", ")})`).join("\n")
              : "",
            "Drops must be whole numbers. Please produce one JSON recipe as specified."
          ].filter(Boolean).join("\n")
        }
      ]
    })
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`deepseek-fail ${res.status} ${t}`);
  }

  const data = await res.json();
  let txt = data.choices?.[0]?.message?.content?.trim();
  
  if (txt.startsWith("```json")) {
    txt = txt.slice(7);
  } else if (txt.startsWith("```")) {
    txt = txt.slice(3);
  }
  if (txt.endsWith("```")) {
    txt = txt.slice(0, -3);
  }

  return JSON.parse(txt.trim());
}

// --- Main
(async () => {
  const dateISO = todayISO();
  const outfile = path.join(OUT_DIR, `${dateISO}.json`);
  const season = getSeason(dateISO, HEMISPHERE);

  if (fs.existsSync(outfile)) {
    console.log(`Already exists: ${outfile}`);
    process.exit(0);
  }

  let result = null;

  const recent = recentRecipes(dateISO);

  for (let attempt = 1; attempt <= 3 && !result; attempt++) {
    try {
      const candidate = await callDeepSeek(dateISO, season, HEMISPHERE, recent);
      if (isRepeat(candidate, recent) && attempt < 3) {
        console.warn(`↻ Attempt ${attempt} repeated a recent mix ("${candidate.title}"); retrying`);
        continue;
      }
      result = candidate;
      console.log("✅ Generated via DeepSeek");
    } catch (e) {
      console.warn(`⚠️ DeepSeek failed: ${e.message}`);
      break;
    }
  }

  if (!result) {
    console.log("ℹ️ Using local generator fallback.");
    result = tinyLocalGenerator(dateISO, HEMISPHERE);
  }

  normalizeDrops(result);
  result.app = "The Daily Drop";
  result.date = dateISO;
  result.season = season;
  result.hemisphere = HEMISPHERE;

  fs.writeFileSync(outfile, JSON.stringify(result, null, 2), "utf8");
  console.log(`Wrote ${outfile}`);
})();
