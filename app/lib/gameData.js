// app/lib/gameData.js
export const CSV_URL = "/example.csv";
export const CSV_TEXT_KEY = "jeopardy_csv_text_v1";

const POINT_VALUES = [100, 200, 300, 400, 500];

function parseCsvSimple(text) {
  const cleaned = (text ?? "").replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    while (cols.length < headers.length) cols.push("");

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

    const short = url.match(/youtu\.be\/([^?&/]+)/i);
    if (short?.[1]) return `https://www.youtube.com/embed/${short[1]}`;

    const v = url.match(/[?&]v=([^?&/]+)/i);
    if (v?.[1]) return `https://www.youtube.com/embed/${v[1]}`;

    const shorts = url.match(/youtube\.com\/shorts\/([^?&/]+)/i);
    if (shorts?.[1]) return `https://www.youtube.com/embed/${shorts[1]}`;

    return url;
  } catch {
    return url;
  }
}

export function buildGameFromText(csvText) {
  const rows = parseCsvSimple(csvText);

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

    // first occurrence wins for (category, points)
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

  // categories in appearance order
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
  // 1) prefer uploaded CSV from localStorage
  try {
    const stored = localStorage.getItem(CSV_TEXT_KEY);
    if (stored && stored.trim().length > 0) {
      return buildGameFromText(stored);
    }
  } catch {
    // ignore
  }

  // 2) fallback to public/example.csv
  const res = await fetch(CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${CSV_URL}`);
  const text = await res.text();
  return buildGameFromText(text);
}
