// app/lib/gameData.js
export const CSV_URL = "/example.csv";

const POINT_VALUES = [100, 200, 300, 400, 500];

function parseCsvSimple(text) {
  // Simple parser: assumes no commas inside fields.
  // Handles missing trailing columns & strips UTF-8 BOM.
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    while (cols.length < headers.length) cols.push(""); // pad trailing empties

    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = cols[j] ?? "";
    }
    rows.push(obj);
  }

  return rows;
}

function normalizeCategory(row) {
  return (row.Catagory || row.Category || row.category || "").trim();
}

function toPoints(row) {
  const n = Number(row.Points);
  return Number.isFinite(n) ? n : NaN;
}

function pickPicture(row) {
  return (row.Picture || row.picture || row.Image || row.image || "").trim();
}

function pickYoutube(row) {
  // IMPORTANT: your CSV uses "Youtube"
  return (
    row.Youtube ||
    row.YouTube ||
    row.YOUTUBE ||
    row.youtube ||
    row["You Tube"] ||
    ""
  ).trim();
}

function isYoutubeUrl(s) {
  if (!s) return false;
  const u = s.toLowerCase();
  return u.includes("youtube.com") || u.includes("youtu.be");
}

function toYoutubeEmbed(url) {
  if (!url) return "";
  try {
    if (url.includes("/embed/")) return url;

    // youtu.be/<id>
    const short = url.match(/youtu\.be\/([^?&/]+)/i);
    if (short?.[1]) return `https://www.youtube.com/embed/${short[1]}`;

    // youtube.com/watch?v=<id>
    const v = url.match(/[?&]v=([^?&/]+)/i);
    if (v?.[1]) return `https://www.youtube.com/embed/${v[1]}`;

    // youtube.com/shorts/<id>
    const shorts = url.match(/youtube\.com\/shorts\/([^?&/]+)/i);
    if (shorts?.[1]) return `https://www.youtube.com/embed/${shorts[1]}`;

    return url; // fallback
  } catch {
    return url;
  }
}

export function buildGameFromRows(rows) {
  // category -> Map(points -> entry)
  const byCat = new Map();

  for (const r of rows) {
    const category = normalizeCategory(r);
    const points = toPoints(r);
    if (!category || !Number.isFinite(points)) continue;
    if (!POINT_VALUES.includes(points)) continue;

    const clue = (r.Clue ?? "").trim();
    const answer = (r.Answer ?? "").trim();
    const picture = pickPicture(r);
    const youtube = pickYoutube(r);
    const youtubeEmbedUrl = isYoutubeUrl(youtube) ? toYoutubeEmbed(youtube) : "";

    if (!byCat.has(category)) byCat.set(category, new Map());
    const catMap = byCat.get(category);

    // Keep first occurrence per (category, points)
    if (!catMap.has(points)) {
      catMap.set(points, {
        category,
        points,
        clue,
        answer,
        picture,
        youtube,
        youtubeEmbedUrl,
      });
    }
  }

  // categories in appearance order (first 6)
  const seen = new Set();
  const categories = [];
  for (const r of rows) {
    const c = normalizeCategory(r);
    if (c && !seen.has(c)) {
      seen.add(c);
      categories.push(c);
    }
    if (categories.length === 6) break;
  }
  while (categories.length < 6) categories.push(`Category ${categories.length + 1}`);

  // lookup[category][points] = entry|null
  const lookup = {};
  for (const cat of categories) {
    lookup[cat] = {};
    const catMap = byCat.get(cat) || new Map();
    for (const p of POINT_VALUES) {
      lookup[cat][p] = catMap.get(p) ?? null;
    }
  }

  return { categories, lookup, pointValues: POINT_VALUES };
}

export async function loadGameData() {
  const res = await fetch(CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${CSV_URL}`);
  const text = await res.text();
  const rows = parseCsvSimple(text);
  return buildGameFromRows(rows);
}
