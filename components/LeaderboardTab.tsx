'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy,
  ChevronLeft,
  ChevronRight,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarDays,
  Dumbbell,
  Utensils,
  Moon,
  Activity,
} from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import type { LeaderboardView, LeaderboardResponse } from '@/lib/types';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getCurrentWeekMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function addDaysToISO(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-pink-500',
];

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div
      className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-semibold text-xs text-white ${color}`}
    >
      {initials || '?'}
    </div>
  );
}

// ─── Rank badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="w-8 h-8 flex-shrink-0 flex flex-col items-center justify-center gap-0.5">
        <Trophy className="w-3.5 h-3.5 text-yellow-400" />
        <span className="text-[8px] font-bold text-yellow-400 leading-none">#1</span>
      </div>
    );
  if (rank === 2)
    return (
      <div className="w-8 h-8 flex-shrink-0 flex flex-col items-center justify-center gap-0.5">
        <Trophy className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[8px] font-bold text-slate-400 leading-none">#2</span>
      </div>
    );
  if (rank === 3)
    return (
      <div className="w-8 h-8 flex-shrink-0 flex flex-col items-center justify-center gap-0.5">
        <Trophy className="w-3.5 h-3.5 text-amber-600" />
        <span className="text-[8px] font-bold text-amber-600 leading-none">#3</span>
      </div>
    );
  return (
    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
      <span className="text-xs font-bold text-text-muted">#{rank}</span>
    </div>
  );
}

// ─── Goal tier color ──────────────────────────────────────────────────────────

function goalColor(pct: number): string {
  if (pct >= 100) return '#a855f7';
  if (pct >= 85)  return '#10b981';
  if (pct >= 65)  return '#22d3ee';
  if (pct >= 45)  return '#f59e0b';
  if (pct >= 20)  return '#f97316';
  return '#f43f5e';
}

// ─── Rank change indicator ────────────────────────────────────────────────────

function RankChange({ change }: { change: number | null | undefined }) {
  if (change == null) return null;
  if (change > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-400 text-[10px] font-semibold">
        <TrendingUp className="w-2.5 h-2.5" />
        {change}
      </span>
    );
  if (change < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-rose-400 text-[10px] font-semibold">
        <TrendingDown className="w-2.5 h-2.5" />
        {Math.abs(change)}
      </span>
    );
  return (
    <span className="inline-flex items-center text-text-muted text-[10px]">
      <Minus className="w-2.5 h-2.5" />
    </span>
  );
}

// ─── Week calendar picker ─────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type CalWeek = {
  weekStart: string;
  days: Array<{ date: string; day: number; isCurrentMonth: boolean }>;
  isSelected: boolean;
  isFuture: boolean;
};

function buildCalendarWeeks(
  year: number,
  month: number,
  selectedWeekStart: string,
  currentWeekMonday: string,
): CalWeek[] {
  const firstOfMonth = new Date(year, month, 1);
  const dow = firstOfMonth.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() + offset);

  const weeks: CalWeek[] = [];
  const cur = new Date(start);

  for (let w = 0; w < 6; w++) {
    const weekStart = toISO(cur);
    const days: CalWeek['days'] = [];
    let hasCurrentMonth = false;

    for (let d = 0; d < 7; d++) {
      days.push({ date: toISO(cur), day: cur.getDate(), isCurrentMonth: cur.getMonth() === month });
      if (cur.getMonth() === month) hasCurrentMonth = true;
      cur.setDate(cur.getDate() + 1);
    }

    if (hasCurrentMonth) {
      weeks.push({
        weekStart,
        days,
        isSelected: weekStart === selectedWeekStart,
        isFuture: weekStart > currentWeekMonday,
      });
    }
  }
  return weeks;
}

function WeekCalendar({
  selectedWeekStart,
  currentWeekMonday,
  onSelect,
  onClose,
}: {
  selectedWeekStart: string;
  currentWeekMonday: string;
  onSelect: (weekStart: string) => void;
  onClose: () => void;
}) {
  const seed = new Date(selectedWeekStart + 'T12:00:00');
  const [calYear, setCalYear] = useState(seed.getFullYear());
  const [calMonth, setCalMonth] = useState(seed.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  const handleOutsideClick = useCallback(
    (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [handleOutsideClick]);

  function prevMonth() {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  }

  function nextMonth() {
    const nowD = new Date();
    const nextY = calMonth === 11 ? calYear + 1 : calYear;
    const nextM = calMonth === 11 ? 0 : calMonth + 1;
    if (nextY > nowD.getFullYear() || (nextY === nowD.getFullYear() && nextM > nowD.getMonth())) return;
    setCalYear(nextY);
    setCalMonth(nextM);
  }

  const weeks = buildCalendarWeeks(calYear, calMonth, selectedWeekStart, currentWeekMonday);
  const nowD = new Date();
  const canGoNext =
    calYear < nowD.getFullYear() ||
    (calYear === nowD.getFullYear() && calMonth < nowD.getMonth());

  return (
    <div
      ref={ref}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-surface-1 border border-white/10 rounded-2xl shadow-2xl p-4 w-72"
    >
      {/* Month navigator */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
          <ChevronLeft className="w-4 h-4 text-text-secondary" />
        </button>
        <span className="text-sm font-semibold text-text-primary">
          {MONTH_NAMES[calMonth]} {calYear}
        </span>
        <button
          onClick={nextMonth}
          disabled={!canGoNext}
          className={`p-1.5 rounded-lg transition-colors ${canGoNext ? 'hover:bg-white/10' : 'opacity-30 cursor-not-allowed'}`}
        >
          <ChevronRight className="w-4 h-4 text-text-secondary" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-text-muted py-0.5">
            {l}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="space-y-0.5">
        {weeks.map((week) => (
          <button
            key={week.weekStart}
            disabled={week.isFuture}
            onClick={() => { onSelect(week.weekStart); onClose(); }}
            className={`w-full grid grid-cols-7 rounded-xl transition-colors ${
              week.isSelected
                ? 'bg-primary-orange/20 ring-1 ring-primary-orange/40'
                : week.isFuture
                ? 'opacity-25 cursor-not-allowed'
                : 'hover:bg-white/8 cursor-pointer'
            }`}
          >
            {week.days.map((d) => (
              <div
                key={d.date}
                className={`text-center text-xs py-1.5 font-medium ${
                  week.isSelected
                    ? d.isCurrentMonth
                      ? 'text-primary-orange'
                      : 'text-primary-orange/40'
                    : d.isCurrentMonth
                    ? 'text-text-primary'
                    : 'text-text-muted'
                }`}
              >
                {d.day}
              </div>
            ))}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeaderboardTab() {
  const [view, setView] = useState<LeaderboardView>('weekly');
  const [weekStart, setWeekStart] = useState<string>(getCurrentWeekMonday);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentWeekMonday = getCurrentWeekMonday();
  const isCurrentWeek = weekStart === currentWeekMonday;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url =
      view === 'weekly'
        ? apiUrl(`/api/leaderboard?view=weekly&week_start=${weekStart}`)
        : apiUrl(`/api/leaderboard?view=${view}`);
    fetch(url, getApiFetchOptions())
      .then((res) => {
        if (!res.ok && res.status === 503)
          return res.json().then((d) => { throw new Error(d.error || 'Service unavailable'); });
        return res.json();
      })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load'); setData(null); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [view, weekStart]);

  if (loading) return <div className="animate-pulse text-text-muted">Loading leaderboard…</div>;

  if (error) {
    return (
      <div className="space-y-4 animate-fade-up">
        <h2 className="text-lg font-semibold text-text-primary">Leaderboard</h2>
        <div className="glass-card p-6 text-center">
          <p className="text-accent-red font-medium">Could not load leaderboard</p>
          <p className="text-sm text-text-muted mt-1">{error}</p>
          <p className="text-xs text-text-secondary mt-3">
            Check that Supabase is configured in{' '}
            <code className="bg-black/5 px-1 rounded">.env.local</code> and the DB is reachable.
            Open{' '}
            <a href="/api/health" target="_blank" rel="noopener noreferrer" className="text-primary-orange underline">
              /api/health
            </a>{' '}
            to verify connection.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-text-muted">Could not load leaderboard.</div>;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ── Header ── */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Leaderboard</h2>

        {/* View tabs */}
        <div className="flex gap-2">
          {(['weekly', 'monthly', 'alltime'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`tab-item relative ${view === v ? 'active' : ''}`}
            >
              {v === 'weekly' ? 'Week' : v === 'monthly' ? 'Month' : 'All time'}
            </button>
          ))}
        </div>

        {/* Week navigator */}
        {view === 'weekly' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(addDaysToISO(weekStart, -7))}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4 text-text-secondary" />
            </button>

            <div className="relative flex-1 flex justify-center">
              <button
                onClick={() => setCalendarOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 hover:bg-white/10 rounded-xl text-sm font-medium text-text-primary transition-colors w-full justify-center"
              >
                <CalendarDays className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <span className="truncate">{data.period}</span>
              </button>
              {calendarOpen && (
                <WeekCalendar
                  selectedWeekStart={weekStart}
                  currentWeekMonday={currentWeekMonday}
                  onSelect={(ws) => { setWeekStart(ws); }}
                  onClose={() => setCalendarOpen(false)}
                />
              )}
            </div>

            <button
              onClick={() => { if (!isCurrentWeek) setWeekStart(addDaysToISO(weekStart, 7)); }}
              disabled={isCurrentWeek}
              className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                isCurrentWeek ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10'
              }`}
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        )}

        {view !== 'weekly' && (
          <p className="text-sm text-text-secondary">{data.period}</p>
        )}
      </div>

      {/* ── Rankings ── */}
      <div className="glass-card overflow-hidden">
        {!data.rankings?.length ? (
          <div className="p-6 text-center">
            <p className="text-text-muted">No users on the leaderboard yet.</p>
            <p className="text-xs text-text-secondary mt-2">
              If you expected to see people here, check that the database has profiles with{' '}
              <code className="bg-black/5 px-1 rounded">is_active = true</code>.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {data.rankings.map((r) => {
              const isMe =
                data.current_user_id != null && r.user.id === data.current_user_id;
              const bd = r.score.breakdown;

              return (
                <li
                  key={r.rank}
                  className={`px-3 py-3 transition-colors ${
                    isMe
                      ? 'border-l-[3px] border-primary-orange bg-primary-orange/5 hover:bg-primary-orange/8'
                      : 'border-l-[3px] border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank */}
                    <RankBadge rank={r.rank} />

                    {/* Avatar */}
                    <Avatar name={r.user.display_name} url={r.user.avatar_url} />

                    {/* Name + stats sub-line */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[15px] text-text-primary leading-tight truncate">
                          {r.user.display_name}
                        </span>
                        {isMe && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary-orange text-white leading-none flex-shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                      {/* Sub-line: breakdown · days · streak · goal% */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {bd && (
                          <>
                            <span className="inline-flex items-center gap-0.5 text-xs">
                              <Dumbbell className="w-3 h-3 text-blue-400" />
                              <span className="text-text-secondary">{bd.workout}</span>
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-xs">
                              <Utensils className="w-3 h-3 text-emerald-400" />
                              <span className="text-text-secondary">{bd.nutrition}</span>
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-xs">
                              <Moon className="w-3 h-3 text-indigo-400" />
                              <span className="text-text-secondary">{bd.sleep}</span>
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-xs">
                              <Activity className="w-3 h-3 text-amber-400" />
                              <span className="text-text-secondary">{bd.steps}</span>
                            </span>
                            <span className="text-text-muted/40 text-xs">·</span>
                          </>
                        )}
                        <span className="text-xs text-text-muted">
                          {r.user.days_active}d active
                        </span>
                        {r.user.streak_days > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-orange-400 text-xs font-semibold">
                            <Flame className="w-3 h-3" />
                            {r.user.streak_days}d
                          </span>
                        )}
                        {r.score.goals_pct != null && (
                          <span
                            className="text-xs font-semibold"
                            style={{ color: goalColor(r.score.goals_pct) }}
                          >
                            {r.score.goals_pct}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Points inline */}
                    <div className="flex-shrink-0 text-right">
                      <p className="font-bold text-[15px] text-text-primary leading-tight tabular-nums">
                        {view === 'alltime'
                          ? r.score.normalized_score.toFixed(1)
                          : r.score.total_points}
                        <span className="text-xs font-normal text-text-muted ml-0.5">
                          {view === 'alltime' ? 'pts/d' : 'pts'}
                        </span>
                      </p>
                      <div className="flex justify-end mt-0.5">
                        <RankChange change={r.rank_change} />
                      </div>
                    </div>

                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {view === 'alltime' && (
        <p className="text-xs text-text-muted">
          All-time ranking uses <strong>normalized score</strong> (total points ÷ days since
          joining) so newcomers can compete fairly.
        </p>
      )}
    </div>
  );
}
