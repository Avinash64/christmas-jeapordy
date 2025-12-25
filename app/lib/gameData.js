// app/lib/gameData.js
export const CSV_URL = "/example.csv";
export const CSV_TEXT_KEY = "jeopardy_csv_text_v1";

const POINT_VALUES = [100, 200, 300, 400, 500];

function parseCsv(text) {
  const s = (text ?? "").replace(/^\uFEFF/, "");
  const rows = [];

  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote: ""
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    // not in quotes
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch === "\r") {
      // ignore CR (handles CRLF)
      continue;
    } else {
      field += ch;
    }
  }

  // last field
  row.push(field);
  rows.push(row);

  // remove empty trailing rows
  const cleaned = rows
    .map((r) => r.map((c) => (c ?? "").trim()))
    .filter((r) => r.some((c) => c.length > 0));

  if (cleaned.length === 0) return [];

  const headers = cleaned[0].map((h) => h.trim());
  const data = cleaned.slice(1);

  return data.map((cols) => {
    // pad missing columns
    while (cols.length < headers.length) cols.push("");

    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (cols[j] ?? "").trim();
    }
    return obj;
  });
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

function parseYouTubeStartSeconds(url) {
  try {
    const u = new URL(url);

    // Common keys
    const t = u.searchParams.get("t");
    const start = u.searchParams.get("start");
    const time = t ?? start;
    if (!time) return 0;

    // If it's purely digits, it's seconds.
    if (/^\d+$/.test(time)) return Number(time);

    // Parse formats like 1h2m3s or 9m53s or 30s
    let seconds = 0;
    const h = time.match(/(\d+)h/i);
    const m = time.match(/(\d+)m/i);
    const s = time.match(/(\d+)s/i);
    if (h) seconds += Number(h[1]) * 3600;
    if (m) seconds += Number(m[1]) * 60;
    if (s) seconds += Number(s[1]);

    return Number.isFinite(seconds) ? seconds : 0;
  } catch {
    return 0;
  }
}

function toYoutubeEmbed(url) {
  if (!url) return "";

  const startSeconds = parseYouTubeStartSeconds(url);

  // Extract video ID from several formats
  let id = "";

  // youtu.be/<id>
  const short = url.match(/youtu\.be\/([^?&/]+)/i);
  if (short?.[1]) id = short[1];

  // youtube.com/watch?v=<id>
  if (!id) {
    const v = url.match(/[?&]v=([^?&/]+)/i);
    if (v?.[1]) id = v[1];
  }

  // youtube.com/live/<id>
  if (!id) {
    const live = url.match(/youtube\.com\/live\/([^?&/]+)/i);
    if (live?.[1]) id = live[1];
  }

  // youtube.com/shorts/<id>
  if (!id) {
    const shorts = url.match(/youtube\.com\/shorts\/([^?&/]+)/i);
    if (shorts?.[1]) id = shorts[1];
  }

  // already embed?
  if (!id && url.includes("/embed/")) {
    // preserve existing embed url but add start if missing
    try {
      const u = new URL(url);
      if (startSeconds > 0 && !u.searchParams.get("start")) {
        u.searchParams.set("start", String(startSeconds));
      }
      return u.toString();
    } catch {
      return url;
    }
  }

  if (!id) return url; // fallback

  const embed = new URL(`https://www.youtube.com/embed/${id}`);
  if (startSeconds > 0) embed.searchParams.set("start", String(startSeconds));
  return embed.toString();
}


export function buildGameFromText(csvText) {
  const rows = parseCsv(csvText);

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
