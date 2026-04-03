'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Trophy,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ChevronDown,
  Info,
} from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import type { LeaderboardView, LeaderboardResponse, FitnessGoal } from '@/lib/types';
import { resolveAvatarUrl } from '@/lib/avatar-url';
import {
  ScoringRulesSection,
  useScoringRules,
  dailyActivityCap,
  type ProfileContext,
} from '@/components/PointSystemPanel';
import { LeaderboardTopLadder } from '@/components/LeaderboardTopLadder';
import {
  FITNESS_GOAL_BADGES,
  LeaderboardRowStats,
  RankBadge,
  RankChange,
} from '@/components/LeaderboardRowStats';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getCurrentWeekMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return localISO(monday);
}

function addDaysToISO(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return localISO(d);
}

function toISO(d: Date): string {
  return localISO(d);
}

function getCurrentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Local calendar meta for the month-league hero (matches dashboard "This month's league" copy). */
function monthLeagueMeta(selectedMonth: string) {
  const [y, m] = selectedMonth.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthNameLong = monthStart.toLocaleDateString('en-US', { month: 'long' });
  const daysInMonth = new Date(y, m, 0).getDate();
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isSelectedCurrentMonth = selectedMonth === currentMonthStr;
  const dayOfMonth = now.getDate();
  const daysRemainingInMonth = daysInMonth - dayOfMonth + 1;
  const todayLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return {
    monthNameLong,
    year: y,
    daysInMonth,
    isSelectedCurrentMonth,
    dayOfMonth,
    daysRemainingInMonth,
    todayLabel,
  };
}

function addMonthsToStr(monthStr: string, delta: number): string {
  const [year, month] = monthStr.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

function Avatar({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const src = resolveAvatarUrl({ userId, displayName: name, avatarUrl: url });

  if (broken) {
    return (
      <div
        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-semibold text-xs text-white ${color}`}
      >
        {initials || '?'}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-surface-2"
      onError={() => setBroken(true)}
    />
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

// ─── Month picker ─────────────────────────────────────────────────────────────

function MonthPicker({
  selectedMonth,
  onSelect,
  onClose,
}: {
  selectedMonth: string;
  onSelect: (month: string) => void;
  onClose: () => void;
}) {
  const [year] = selectedMonth.split('-').map(Number);
  const [calYear, setCalYear] = useState(year);
  const ref = useRef<HTMLDivElement>(null);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

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

  const canGoNextYear = calYear < currentYear;

  return (
    <div
      ref={ref}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-surface-1 border border-white/10 rounded-2xl shadow-2xl p-4 w-56"
    >
      {/* Year navigator */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCalYear((y) => y - 1)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-text-secondary" />
        </button>
        <span className="text-sm font-semibold text-text-primary">{calYear}</span>
        <button
          onClick={() => { if (canGoNextYear) setCalYear((y) => y + 1); }}
          disabled={!canGoNextYear}
          className={`p-1.5 rounded-lg transition-colors ${canGoNextYear ? 'hover:bg-white/10' : 'opacity-30 cursor-not-allowed'}`}
        >
          <ChevronRight className="w-4 h-4 text-text-secondary" />
        </button>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-3 gap-1">
        {MONTH_NAMES.map((name, i) => {
          const m = i + 1;
          const monthStr = `${calYear}-${String(m).padStart(2, '0')}`;
          const isSelected = monthStr === selectedMonth;
          const isFuture = calYear > currentYear || (calYear === currentYear && m > currentMonth);
          return (
            <button
              key={m}
              disabled={isFuture}
              onClick={() => { onSelect(monthStr); onClose(); }}
              className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-primary-orange/20 ring-1 ring-primary-orange/40 text-primary-orange'
                  : isFuture
                  ? 'opacity-25 cursor-not-allowed text-text-muted'
                  : 'hover:bg-white/8 text-text-primary cursor-pointer'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Scoring Guide (same dynamic rules + goal context as Point System sheet) ──

function ScoringGuide({ profile }: { profile?: ProfileContext }) {
  const [open, setOpen] = useState(false);
  const { byCategory, loading } = useScoringRules(true);
  const dailyMax = useMemo(() => dailyActivityCap(byCategory), [byCategory]);

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Info className="w-4 h-4 text-text-muted flex-shrink-0" />
          <span className="text-sm font-semibold text-text-primary">How points are scored</span>
          <span className="text-[11px] text-text-muted bg-surface-2 px-2 py-0.5 rounded-full tabular-nums shrink-0">
            {loading ? '…' : `${dailyMax || 85} pts / day max`}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-text-muted transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-white/10">
          {loading ? (
            <div className="px-4 py-4 space-y-2 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-surface-2/60" />
              ))}
            </div>
          ) : byCategory.size === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">Unable to load scoring rules.</p>
          ) : (
            <div className="px-4 py-3">
              <ScoringRulesSection byCategory={byCategory} profile={profile} hideScoringRulesTitle />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeaderboardTab({
  initialView,
  initialMonth,
  profile,
}: {
  initialView?: LeaderboardView;
  initialMonth?: string;
  profile?: ProfileContext;
} = {}) {
  const [view, setView] = useState<LeaderboardView>(() => initialView ?? 'monthly');
  const [weekStart, setWeekStart] = useState<string>(getCurrentWeekMonday);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => initialMonth ?? getCurrentMonthStr());
  const [monthCalendarOpen, setMonthCalendarOpen] = useState(false);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentWeekMonday = getCurrentWeekMonday();
  const isCurrentWeek = weekStart === currentWeekMonday;
  const currentMonthStr = getCurrentMonthStr();
  const isCurrentMonth = selectedMonth === currentMonthStr;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url =
      view === 'weekly'
        ? apiUrl(`/api/leaderboard?view=weekly&week_start=${weekStart}`)
        : view === 'monthly'
        ? apiUrl(`/api/leaderboard?view=monthly&month=${selectedMonth}`)
        : apiUrl(`/api/leaderboard?view=alltime`);
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
  }, [view, weekStart, selectedMonth]);

  if (loading) return <div className="animate-pulse text-text-muted">Loading leaderboard…</div>;

  if (error) {
    const isConfigError = error.toLowerCase().includes('supabase') || error.toLowerCase().includes('env') || error.toLowerCase().includes('missing');
    const isSchemaError = error.toLowerCase().includes('column') || error.toLowerCase().includes('does not exist') || error.toLowerCase().includes('relation');
    return (
      <div className="space-y-4 animate-fade-up">
        <h2 className="text-lg font-semibold text-text-primary">Leaderboard</h2>
        <div className="glass-card p-6 text-center">
          <p className="text-accent-red font-medium">Could not load leaderboard</p>
          <p className="text-sm text-text-muted mt-1">{error}</p>
          {isSchemaError && (
            <p className="text-xs text-text-secondary mt-3">
              A database migration may be pending. Run the latest migration in your Supabase project to add missing columns.
            </p>
          )}
          {isConfigError && !isSchemaError && (
            <p className="text-xs text-text-secondary mt-3">
              Check that Supabase is configured in{' '}
              <code className="bg-black/5 px-1 rounded">.env.local</code> and the DB is reachable.
              Open{' '}
              <a href="/api/health" target="_blank" rel="noopener noreferrer" className="text-primary-orange underline">
                /api/health
              </a>{' '}
              to verify connection.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-text-muted">Could not load leaderboard.</div>;

  const monthMeta = view === 'monthly' ? monthLeagueMeta(selectedMonth) : null;
  const myMonthlyRank =
    view === 'monthly' && data.current_user_id != null
      ? data.rankings.find((r) => r.user.id === data.current_user_id)?.rank ?? null
      : null;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ── Header ── */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Leaderboard</h2>

        {/* View tabs — Month first (default); scroll on narrow screens */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 md:mx-0 md:px-0 md:overflow-visible [scrollbar-width:thin]">
          {(['monthly', 'weekly', 'alltime'] as const).map((v) => (
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

        {/* Month league hero — same visual language as dashboard "This month's league" */}
        {view === 'monthly' && monthMeta && (
          <div className="relative overflow-hidden rounded-2xl border-2 border-accent-superjoin-orange/35 bg-surface-1 shadow-lg shadow-accent-superjoin-orange/15 w-full min-w-0">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_100%_-20%,rgba(249,115,22,0.22),transparent_55%),radial-gradient(ellipse_80%_50%_at_0%_100%,rgba(251,191,36,0.08),transparent_50%)]"
              aria-hidden
            />
            <div className="relative flex flex-col gap-4 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 min-w-0">
              <div className="flex gap-3 min-w-0 flex-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-superjoin-orange/20 border border-accent-superjoin-orange/35 shadow-inner">
                  <Trophy className="h-6 w-6 text-accent-superjoin-orange" aria-hidden />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-superjoin-orange/90">
                    This month&apos;s league
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight leading-none">
                    <span className="bg-gradient-to-r from-accent-superjoin-orange via-amber-500 to-amber-600 bg-clip-text text-transparent">
                      {monthMeta.monthNameLong}
                    </span>
                    <span className="text-text-primary"> league</span>
                  </h3>
                  {monthMeta.isSelectedCurrentMonth ? (
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-bold tabular-nums text-accent-superjoin-orange shrink-0">
                        Day {monthMeta.dayOfMonth}/{monthMeta.daysInMonth}
                      </span>
                      <span className="text-text-muted/70 shrink-0">·</span>
                      <span className="font-semibold text-text-primary sm:whitespace-nowrap">
                        {monthMeta.daysRemainingInMonth}{' '}
                        {monthMeta.daysRemainingInMonth === 1 ? 'day' : 'days'} left
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-text-secondary">Full month standings</p>
                  )}
                  <p className="text-xs text-text-muted sm:whitespace-nowrap">
                    {monthMeta.isSelectedCurrentMonth ? monthMeta.todayLabel : data.period}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 w-full min-w-0 items-stretch sm:w-auto sm:shrink-0 sm:items-end sm:min-w-[9.5rem] sm:text-right border-t border-white/10 pt-3 sm:border-t-0 sm:pt-0">
                <div className="flex items-baseline gap-2 sm:flex-col sm:items-end sm:gap-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Your rank</span>
                  {myMonthlyRank != null ? (
                    <span className="text-3xl sm:text-4xl font-black tabular-nums leading-none text-accent-superjoin-orange drop-shadow-sm">
                      #{myMonthlyRank}
                    </span>
                  ) : (
                    <span className="text-lg font-bold text-text-muted">—</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 w-full min-w-0 max-w-full sm:max-w-none">
                  <button
                    type="button"
                    onClick={() => setSelectedMonth((m) => addMonthsToStr(m, -1))}
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors flex-shrink-0 border border-white/10"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-4 h-4 text-text-secondary" />
                  </button>
                  <div className="relative flex-1 sm:flex-initial flex justify-center min-w-0">
                    <button
                      type="button"
                      onClick={() => setMonthCalendarOpen((o) => !o)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-accent-superjoin-orange/35 bg-accent-superjoin-orange/15 px-3 py-2 text-sm font-bold text-accent-superjoin-orange shadow-inner transition hover:brightness-110 w-full min-w-0 sm:w-auto sm:max-w-[200px]"
                    >
                      <CalendarDays className="w-3.5 h-3.5 shrink-0" aria-hidden />
                      <span className="truncate tabular-nums">
                        {monthMeta.monthNameLong} {monthMeta.year}
                      </span>
                    </button>
                    {monthCalendarOpen && (
                      <MonthPicker
                        selectedMonth={selectedMonth}
                        onSelect={(m) => {
                          setSelectedMonth(m);
                        }}
                        onClose={() => setMonthCalendarOpen(false)}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isCurrentMonth) setSelectedMonth((m) => addMonthsToStr(m, 1));
                    }}
                    disabled={isCurrentMonth}
                    className={`p-2 rounded-xl transition-colors flex-shrink-0 border border-white/10 ${
                      isCurrentMonth ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10'
                    }`}
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-4 h-4 text-text-secondary" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'alltime' && (
          <p className="text-sm text-text-secondary">{data.period}</p>
        )}
      </div>

      {/* ── Single leaderboard board (top 10 ladder + full rows for 11+) ── */}
      <div className="glass-card overflow-x-auto">
        {!data.rankings?.length ? (
          <div className="p-6 text-center">
            <p className="text-text-muted">No users on the leaderboard yet.</p>
            <p className="text-xs text-text-secondary mt-2">
              If you expected to see people here, check that the database has profiles with{' '}
              <code className="bg-black/5 px-1 rounded">is_active = true</code>.
            </p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 sm:px-5 border-b border-white/10 bg-surface-2/30">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-superjoin-orange/15 border border-accent-superjoin-orange/25">
                  <Trophy className="h-4 w-4 text-accent-superjoin-orange" aria-hidden />
                </div>
                <h3 className="text-sm font-semibold text-text-primary leading-tight">Standings</h3>
              </div>
            </div>
            <div className={`p-4 sm:p-5 ${data.rankings.length > 10 ? 'border-b border-white/10' : ''}`}>
              <LeaderboardTopLadder
                view={view}
                rankings={data.rankings}
                currentUserId={data.current_user_id}
              />
            </div>
            {data.rankings.length > 10 && (
              <>
                <div className="px-4 py-2 border-b border-white/10 bg-surface-2/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Rank 11 and below</p>
                </div>
                <ul className="divide-y divide-white/10">
                  {data.rankings.slice(10).map((r) => {
                    const isMe =
                      data.current_user_id != null && r.user.id === data.current_user_id;
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
                          <RankBadge rank={r.rank} />
                          <Avatar userId={r.user.id} name={r.user.display_name} url={r.user.avatar_url} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-[15px] text-text-primary leading-tight truncate">
                                {r.user.display_name}
                              </span>
                              {isMe && (
                                <span className="hidden sm:inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary-orange text-white leading-none flex-shrink-0">
                                  YOU
                                </span>
                              )}
                              {r.user.fitness_goal && (
                                <span
                                  className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none flex-shrink-0 ${
                                    FITNESS_GOAL_BADGES[r.user.fitness_goal as FitnessGoal]?.color ?? ''
                                  }`}
                                >
                                  {FITNESS_GOAL_BADGES[r.user.fitness_goal as FitnessGoal]?.label ?? r.user.fitness_goal}
                                </span>
                              )}
                            </div>
                            <LeaderboardRowStats r={r} isMe={isMe} className="mt-1" />
                          </div>
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
              </>
            )}
          </>
        )}
      </div>

      {view === 'alltime' && (
        <p className="text-xs text-text-muted">
          All-time ranking uses <strong>normalized score</strong> (total points ÷ days since
          joining) so newcomers can compete fairly.
        </p>
      )}

      {/* ── Scoring guide ── */}
      <ScoringGuide profile={profile} />
    </div>
  );
}
