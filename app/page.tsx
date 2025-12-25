"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadGameData } from "./lib/gameData";

const STORAGE_KEY = "jeopardy_revealed_v1";
const TEAMS_KEY = "jeopardy_teams_v1";
const ACTIVE_TEAM_KEY = "jeopardy_active_team_v1";

const values = [100, 200, 300, 400, 500];

function tileKey(category, value) {
  return `${category}:${value}`;
}

// (keep your existing teams code that now works)
const DEFAULT_TEAMS = [
  { id: 1, name: "Team 1", points: 0 },
  { id: 2, name: "Team 2", points: 0 },
  { id: 3, name: "Team 3", points: 0 },
  { id: 4, name: "Team 4", points: 0 },
];

function clampName(s) {
  return (s ?? "").toString().slice(0, 20);
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

  const [didHydrate, setDidHydrate] = useState(false);
  const [revealed, setRevealed] = useState(() => new Set());
  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [activeTeamId, setActiveTeamId] = useState(1);

  // NEW: csv-driven categories + lookup
  const [categories, setCategories] = useState([]);
  const [lookup, setLookup] = useState(null);

  useEffect(() => {
    (async () => {
      // load csv
      const data = await loadGameData();
      setCategories(data.categories);
      setLookup(data.lookup);

      // load revealed
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : null;
        if (Array.isArray(arr)) setRevealed(new Set(arr));
      } catch {}

      // load teams + active team
      setTeams(loadTeamsSafe());
      setActiveTeamId(loadActiveTeamId());

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

  const updateTeam = (id, patch) => {
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

  // If CSV not loaded yet
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
        {/* Active team selector */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
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

        {/* Teams bar (name + score only) */}
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
                  className="mb-2 w-full rounded bg-blue-800/60 px-3 py-2 text-sm font-bold text-yellow-300 outline-none placeholder:text-yellow-300/50"
                />
                <div className="text-2xl font-extrabold">{team.points}</div>
              </div>
            );
          })}
        </div>

        {/* Board */}
        <div className="grid grid-cols-6 grid-rows-6 gap-3">
          {/* Headers */}
          {headers.map((cat) => (
            <div
              key={cat}
              className="flex items-center justify-center rounded bg-blue-900 p-3 text-center text-sm font-bold text-yellow-300"
            >
              {cat.toUpperCase()}
            </div>
          ))}

          {/* Tiles */}
          {values.flatMap((value) =>
            headers.map((category) => {
              const key = tileKey(category, value);
              const isRevealed = revealed.has(key);

              // if CSV doesn't have a clue for this slot, make it blank
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

        <div className="mt-6">
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
