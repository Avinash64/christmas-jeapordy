// app/lib/gameData.js
export const CSV_URL = "./example.csv";

function parseCsvSimple(text) {
  // Simple CSV parser (assumes no commas inside fields)
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(","); // simple split
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (cols[j] ?? "").trim();
    }
    rows.push(obj);
  }
  return rows;
}

function normalizeCategory(row) {
  // handle "Catagory" misspelling + any other variants
  return (row.Catagory || row.Category || row.category || "").trim();
}

function toPoints(row) {
  const n = Number(row.Points);
  return Number.isFinite(n) ? n : NaN;
}

function isYoutubeUrl(s) {
  if (!s) return false;
  const u = s.toLowerCase();
  return u.includes("youtube.com") || u.includes("youtu.be");
}

function toYoutubeEmbed(url) {
  // Accepts youtube watch URLs, youtu.be, or already-embed URLs
  try {
    if (url.includes("/embed/")) return url;

    // youtu.be/<id>
    const ytShort = url.match(/youtu\.be\/([^?&]+)/i);
    if (ytShort?.[1]) return `https://www.youtube.com/embed/${ytShort[1]}`;

    // youtube.com/watch?v=<id>
    const vMatch = url.match(/[?&]v=([^?&]+)/i);
    if (vMatch?.[1]) return `https://www.youtube.com/embed/${vMatch[1]}`;

    return url; // fallback
  } catch {
    return url;
  }
}

export function buildGameFromRows(rows) {
  // Build map: category -> Map(points -> clueObj)
  const byCat = new Map();

  for (const r of rows) {
    const category = normalizeCategory(r);
    const points = toPoints(r);
    if (!category || !Number.isFinite(points)) continue;

    const clue = (r.Clue ?? "").trim();
    const answer = (r.Answer ?? "").trim();
    const picture = (r.Picture ?? "").trim();

    if (!byCat.has(category)) byCat.set(category, new Map());

    // If duplicates exist, keep the first occurrence for that (category, points)
    const catMap = byCat.get(category);
    if (!catMap.has(points)) {
      catMap.set(points, {
        category,
        points,
        clue,
        answer,
        picture,
        clueIsYoutube: isYoutubeUrl(clue),
        youtubeEmbedUrl: isYoutubeUrl(clue) ? toYoutubeEmbed(clue) : "",
      });
    }
  }

  // Determine categories (in order of appearance)
  const allCategoriesInOrder = [];
  for (const r of rows) {
    const c = normalizeCategory(r);
    if (c && !allCategoriesInOrder.includes(c)) allCategoriesInOrder.push(c);
  }

  // Take first 6 unique categories; pad if fewer
  const categories = allCategoriesInOrder.slice(0, 6);
  while (categories.length < 6) categories.push(`Category ${categories.length + 1}`);

  // Ensure each category has points 100..500 sorted
  const pointValues = [100, 200, 300, 400, 500];
  const cluesByCategory = {};

  for (const cat of categories) {
    const catMap = byCat.get(cat) || new Map();
    cluesByCategory[cat] = pointValues
      .slice()
      .sort((a, b) => a - b)
      .map((p) => catMap.get(p) ?? null); // null if missing
  }

  // Also provide direct lookup
  const lookup = {};
  for (const cat of categories) {
    lookup[cat] = {};
    for (const p of [100, 200, 300, 400, 500]) {
      lookup[cat][p] = (byCat.get(cat) || new Map()).get(p) ?? null;
    }
  }

  return { categories, lookup };
}

export async function loadGameData() {
  const res = await fetch(CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${CSV_URL}`);
  const text = await res.text();
  const rows = parseCsvSimple(text);
  return buildGameFromRows(rows);
}
