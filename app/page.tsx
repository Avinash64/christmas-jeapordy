"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadGameData, CSV_TEXT_KEY } from "./lib/gameData";

const STORAGE_KEY = "jeopardy_revealed_v1";
const TEAMS_KEY = "jeopardy_teams_v1";
const ACTIVE_TEAM_KEY = "jeopardy_active_team_v1";

const DEFAULT_TEAMS = [
  { id: 1, name: "Team 1", points: 0 },
  { id: 2, name: "Team 2", points: 0 },
  { id: 3, name: "Team 3", points: 0 },
  { id: 4, name: "Team 4", points: 0 },
];

function clampName(s: any) {
  return (s ?? "").toString().slice(0, 20);
}

function tileKey(category: string, value: number) {
  return `${category}:${value}`;
}

function clearAllLocalGameData() {
  localStorage.removeItem("jeopardy_revealed_v1");
  localStorage.removeItem("jeopardy_teams_v1");
  localStorage.removeItem("jeopardy_active_team_v1");
  localStorage.removeItem("jeopardy_csv_text_v1");
}


function loadTeamsSafe() {
  try {
    const raw = localStorage.getItem(TEAMS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      const byId = new Map(parsed.map((t) => [Number(t?.id), t]));
      return DEFAULT_TEAMS.map((d) => {
        const t = byId.get(d.id);
        return {
          id: d.id,
          name: clampName(typeof t?.name === "string" ? t.name : d.name),
          points: Number.isFinite(Number(t?.points)) ? Number(t.points) : d.points,
        };
      });
    }
  } catch {}
  return DEFAULT_TEAMS;
}

function loadActiveTeamId() {
  try {
    const n = Number(localStorage.getItem(ACTIVE_TEAM_KEY));
    return [1, 2, 3, 4].includes(n) ? n : 1;
  } catch {
    return 1;
  }
}

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [didHydrate, setDidHydrate] = useState(false);

  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [activeTeamId, setActiveTeamId] = useState(1);

  const [categories, setCategories] = useState<string[]>([]);
  const [lookup, setLookup] = useState<any>(null);
  const [pointValues, setPointValues] = useState<number[]>([100, 200, 300, 400, 500]);

  const [csvName, setCsvName] = useState("");

  // NEW: dropdown state
  const [settingsOpen, setSettingsOpen] = useState(false);

  const refreshGameFromSource = async () => {
    const data = await loadGameData();
    setCategories(data.categories);
    setLookup(data.lookup);
    setPointValues(data.pointValues);
  };

  useEffect(() => {
    (async () => {
      await refreshGameFromSource();

      // revealed
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : null;
        if (Array.isArray(arr)) setRevealed(new Set(arr));
      } catch {}

      // teams + active
      setTeams(loadTeamsSafe());
      setActiveTeamId(loadActiveTeamId());

      // show which source is active
      try {
        const stored = localStorage.getItem(CSV_TEXT_KEY);
        if (stored) setCsvName("Uploaded CSV");
      } catch {}

      setDidHydrate(true);
    })();
  }, []);

  useEffect(() => {
    if (!didHydrate) return;
    try {
      localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
    } catch {}
  }, [teams, didHydrate]);

  useEffect(() => {
    if (!didHydrate) return;
    try {
      localStorage.setItem(ACTIVE_TEAM_KEY, String(activeTeamId));
    } catch {}
  }, [activeTeamId, didHydrate]);

  const headers = useMemo(() => categories, [categories]);

  const updateTeam = (id: number, patch: any) => {
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const resetAll = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TEAMS_KEY);
    localStorage.removeItem(ACTIVE_TEAM_KEY);
    setRevealed(new Set());
    setTeams(DEFAULT_TEAMS);
    setActiveTeamId(1);
    router.push("/");
  };

  const onPickCsv = () => fileInputRef.current?.click();

  const onUploadCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();

    localStorage.setItem(CSV_TEXT_KEY, text);
    setCsvName(file.name);

    // reset revealed when switching sets
    localStorage.removeItem(STORAGE_KEY);
    setRevealed(new Set());

    await refreshGameFromSource();

    // allow re-upload of same file
    e.target.value = "";
  };


  const resetEverythingConfirmed = async () => {
  const ok = window.confirm(
    "This will reset the board, teams, scores, active team, and uploaded CSV.\n\nAre you sure?"
  );

  if (!ok) return;

  clearAllLocalGameData();

  // reset in-memory state
  setRevealed(new Set());
  setTeams(DEFAULT_TEAMS);
  setActiveTeamId(1);
  setCsvName("");

  // reload default CSV
  await refreshGameFromSource();

  // close settings dropdown
  setSettingsOpen(false);
};

  const useDefaultCsv = async () => {
    localStorage.removeItem(CSV_TEXT_KEY);
    setCsvName("Default (/public/example.csv)");

    localStorage.removeItem(STORAGE_KEY);
    setRevealed(new Set());

    await refreshGameFromSource();
  };

  if (headers.length === 0 || !lookup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-800 font-sans text-yellow-300">
        Loading board…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-800 font-sans">
      <main className="w-full max-w-5xl px-6 py-10">
        {/* Dropdown wrapper */}
        <div className="mb-6">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded bg-blue-900 px-4 py-2 text-sm font-bold text-yellow-300 shadow hover:bg-blue-700"
            aria-expanded={settingsOpen}
            aria-controls="game-settings"
          >
            Game settings
            <span className="text-xs opacity-80">{settingsOpen ? "▲" : "▼"}</span>
          </button>

          {settingsOpen && (
            <div
              id="game-settings"
              className="mt-3 rounded bg-blue-900/60 p-4 shadow"
            >
              {/* CSV controls */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="rounded bg-blue-900 px-3 py-2 text-sm font-bold text-yellow-300 shadow">
                  CSV: {csvName || "Default (/public/example.csv)"}
                </div>

                <button
                  onClick={onPickCsv}
                  className="rounded bg-yellow-300 px-3 py-2 text-sm font-bold text-blue-900 shadow hover:opacity-90"
                >
                  Upload CSV
                </button>

                <button
                  onClick={useDefaultCsv}
                  className="rounded bg-blue-900 px-3 py-2 text-sm font-bold text-yellow-300 shadow hover:bg-blue-700"
                >
                  Use default CSV
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={onUploadCsv}
                  className="hidden"
                />
              </div>

              {/* Active team selector */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded bg-blue-900 px-3 py-2 text-sm font-bold text-yellow-300 shadow">
                  Active team:
                </div>
                {teams.map((t) => {
                  const active = t.id === activeTeamId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTeamId(t.id)}
                      className={[
                        "rounded px-3 py-2 text-sm font-bold shadow",
                        active
                          ? "bg-yellow-300 text-blue-900"
                          : "bg-blue-900 text-yellow-300 hover:bg-blue-700",
                      ].join(" ")}
                    >
                      {t.name}
                    </button>
                  );
                })}

              </div>
                {/* Danger zone */}
                <div className="mt-6 border-t border-blue-700 pt-4">
                  <button
                    onClick={resetEverythingConfirmed}
                    className="rounded bg-red-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-red-500"
                  >
                    Reset ALL game data
                  </button>

                  <div className="mt-1 text-xs text-yellow-300/70">
                    Clears board, teams, scores, and uploaded CSV
                  </div>
                </div>
            </div>
          )}
        </div>

        {/* Teams bar */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {teams.map((team) => {
            const active = team.id === activeTeamId;
            return (
              <div
                key={team.id}
                className={[
                  "rounded p-4 text-yellow-300 shadow",
                  active ? "bg-blue-700" : "bg-blue-900",
                ].join(" ")}
              >
                <input
                  value={team.name}
                  onChange={(e) => updateTeam(team.id, { name: clampName(e.target.value) })}
                  className="mb-2 w-full rounded bg-blue-800/60 px-3 py-2 text-sm font-bold text-yellow-300 outline-none"
                />
                <div className="text-2xl font-extrabold">{team.points}</div>
              </div>
            );
          })}
        </div>

        {/* Board */}
        <div className="grid grid-cols-6 grid-rows-6 gap-3">
          {headers.map((cat) => (
            <div
              key={cat}
              className="flex items-center justify-center rounded bg-blue-900 p-3 text-center text-sm font-bold text-yellow-300"
            >
              {cat.toUpperCase()}
            </div>
          ))}

          {pointValues.flatMap((value) =>
            headers.map((category) => {
              const key = tileKey(category, value);
              const isRevealed = revealed.has(key);
              const exists = !!lookup?.[category]?.[value];

              if (isRevealed || !exists) {
                return (
                  <div key={key} className="h-20 rounded bg-blue-700/40 shadow" />
                );
              }

              return (
                <Link
                  key={key}
                  href={`/question/${encodeURIComponent(category)}/${value}`}
                  className="flex h-20 items-center justify-center rounded bg-blue-700 text-2xl font-extrabold text-yellow-300 shadow hover:bg-blue-600 active:scale-[0.99]"
                >
                  ${value}
                </Link>
              );
            })
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={resetAll}
            className="inline-flex items-center justify-center rounded bg-blue-700/60 px-4 py-2 text-sm font-bold text-yellow-300 hover:bg-blue-600/60"
          >
            Reset board + teams
          </button>
        </div>
      </main>
    </div>
  );
}
