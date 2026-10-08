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

// --- DeepSeek Model Call
async function callDeepSeek(dateISO, season, hemisphere) {
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
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `Today is ${dateISO}. Hemisphere: ${hemisphere}. Season: ${season}. Please produce one JSON recipe as specified.`
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

  try {
    result = await callDeepSeek(dateISO, season, HEMISPHERE);
    console.log("✅ Generated via DeepSeek");
  } catch (e) {
    console.warn(`⚠️ DeepSeek failed: ${e.message}`);
  }

  if (!result) {
    console.log("ℹ️ Using local generator fallback.");
    result = tinyLocalGenerator(dateISO, HEMISPHERE);
  }

  result.app = "The Daily Drop";
  result.date = dateISO;
  result.season = season;
  result.hemisphere = HEMISPHERE;

  fs.writeFileSync(outfile, JSON.stringify(result, null, 2), "utf8");
  console.log(`Wrote ${outfile}`);
})();
