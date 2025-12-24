"use client";

import { useMemo, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const STORAGE_KEY = "jeopardy_revealed_v1";
const TEAMS_KEY = "jeopardy_teams_v1";
const ACTIVE_TEAM_KEY = "jeopardy_active_team_v1";

const DEFAULT_TEAMS = [
  { id: 1, name: "Team 1", points: 0 },
  { id: 2, name: "Team 2", points: 0 },
  { id: 3, name: "Team 3", points: 0 },
  { id: 4, name: "Team 4", points: 0 },
];

const QUESTION_BANK = {
  history: {
    100: {
      q: "Who was the first President of the United States?",
      a: "George Washington",
    },
  },
  science: {
    100: { q: "What planet is known as the Red Planet?", a: "Mars" },
  },
};

function clampName(s) {
  return (s ?? "").toString().slice(0, 20);
}

function tileKey(category, value) {
  return `${category}:${value}`;
}

function markRevealed(category, value) {
  const key = tileKey(category, value);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const set = new Set(Array.isArray(arr) ? arr : []);
    set.add(key);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {}
}

function loadTeams() {
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

function saveTeams(teams) {
  try {
    localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
  } catch {}
}

function loadActiveTeamId() {
  try {
    const raw = localStorage.getItem(ACTIVE_TEAM_KEY);
    const n = Number(raw);
    return [1, 2, 3, 4].includes(n) ? n : 1;
  } catch {
    return 1;
  }
}

function saveActiveTeamId(id) {
  try {
    localStorage.setItem(ACTIVE_TEAM_KEY, String(id));
  } catch {}
}

export default function QuestionPage() {
  const params = useParams();
  const router = useRouter();

  const category = typeof params.category === "string" ? params.category : "";
  const valueStr = typeof params.value === "string" ? params.value : "";
  const value = Number(valueStr);

  const entry = useMemo(() => QUESTION_BANK?.[category]?.[value], [category, value]);

  const [showAnswer, setShowAnswer] = useState(false);
  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [activeTeamId, setActiveTeamId] = useState(1);

  // prevent any chance of overwriting on mount
  const [didHydrate, setDidHydrate] = useState(false);

  useEffect(() => {
    setTeams(loadTeams());
    setActiveTeamId(loadActiveTeamId());
    setDidHydrate(true);
  }, []);

  useEffect(() => {
    if (!didHydrate) return;
    saveActiveTeamId(activeTeamId);
  }, [activeTeamId, didHydrate]);

  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? teams[0];

  const adjustActiveTeam = (delta) => {
    setTeams((prev) => {
      const next = prev.map((t) =>
        t.id === activeTeamId ? { ...t, points: t.points + delta } : t
      );
      saveTeams(next);
      return next;
    });
  };

  const onShowAnswer = () => {
    setShowAnswer(true);
    if (category && Number.isFinite(value)) markRevealed(category, value);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-800 font-sans">
      <main className="w-full max-w-2xl rounded bg-blue-900 p-8 text-yellow-300 shadow">
        <div className="mb-4 text-sm font-bold opacity-90">
          {(category || "UNKNOWN").toUpperCase()} • ${Number.isFinite(value) ? value : "?"}
        </div>

        <h1 className="mb-6 text-2xl font-extrabold">
          {entry?.q ?? "No question found for this tile yet."}
        </h1>

        {/* Active team switcher (NOW shown before answer too) */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="text-sm font-bold opacity-90">Active team:</div>
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
                    : "bg-blue-700 text-yellow-300 hover:bg-blue-600",
                ].join(" ")}
              >
                {t.name}
              </button>
            );
          })}
        </div>

        {/* Award controls (NOW available before answer too) */}
        <div className="mb-6 rounded bg-blue-800/40 p-4 shadow">
          <div className="mb-1 text-sm font-bold">{activeTeam?.name}</div>
          <div className="mb-3 text-2xl font-extrabold">{activeTeam?.points}</div>

          <div className="flex gap-2">
            <button
              onClick={() => adjustActiveTeam(-value)}
              className="flex-1 rounded bg-blue-700/60 px-3 py-2 text-sm font-bold hover:bg-blue-700"
            >
              -${value}
            </button>
            <button
              onClick={() => adjustActiveTeam(+value)}
              className="flex-1 rounded bg-blue-700 px-3 py-2 text-sm font-bold hover:bg-blue-600"
            >
              +${value}
            </button>
          </div>
        </div>

        {/* Show answer button + answer block */}
        {!showAnswer ? (
          <button
            onClick={onShowAnswer}
            className="mb-6 inline-flex items-center justify-center rounded bg-yellow-300 px-4 py-2 font-bold text-blue-900 hover:opacity-90"
          >
            Show answer
          </button>
        ) : (
          <div className="mb-6 rounded bg-blue-800/60 p-4">
            <div className="text-sm font-bold opacity-90">Answer</div>
            <div className="text-lg">{entry?.a ?? "No answer set."}</div>
          </div>
        )}

        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center justify-center rounded bg-blue-700 px-4 py-2 font-bold text-yellow-300 hover:bg-blue-600"
        >
          ← Back to board
        </button>
      </main>
    </div>
  );
}
