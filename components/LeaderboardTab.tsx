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
  ChevronDown,
  Info,
  Footprints,
  Zap,
} from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import type { LeaderboardView, LeaderboardResponse } from '@/lib/types';

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

// ─── Scoring Guide ────────────────────────────────────────────────────────────

type ScoringRuleStatic = {
  id: number;
  action_label: string;
  condition_desc: string;
  points: number;
  is_bonus: boolean;
  age_note?: string;
};

type CategoryConfig = {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  max?: number;
  streakNote?: boolean;
  rules: ScoringRuleStatic[];
};

// Static scoring rules — mirrors lib/points.ts exactly.
// When you update the scoring engine, update this list too.
const SCORING_CATEGORIES: CategoryConfig[] = [
  {
    label: 'Workout', icon: Dumbbell, color: 'text-blue-400', bgColor: 'bg-blue-400/10', max: 20,
    rules: [
      { id: 1,  action_label: 'Complete any workout',        condition_desc: 'Log at least one workout session',          points: 10, is_bonus: false },
      { id: 2,  action_label: 'Workout for 45+ minutes',     condition_desc: 'Session duration is 45 minutes or more',   points: 5,  is_bonus: true  },
      { id: 3,  action_label: 'Workout for 60+ minutes',     condition_desc: 'Session duration is 60 minutes or more',   points: 5,  is_bonus: true  },
    ],
  },
  {
    label: 'Cardio', icon: Activity, color: 'text-rose-400', bgColor: 'bg-rose-400/10', max: 15,
    rules: [
      { id: 4,  action_label: 'Complete any cardio session', condition_desc: 'Log at least one cardio session',          points: 10, is_bonus: false },
      { id: 5,  action_label: 'Cardio for 30+ minutes',      condition_desc: 'Session duration is 30 minutes or more',  points: 5,  is_bonus: true, age_note: 'Over 35: 25.5 minutes counts (85% threshold)' },
    ],
  },
  {
    label: 'Sleep', icon: Moon, color: 'text-indigo-400', bgColor: 'bg-indigo-400/10', max: 15,
    rules: [
      { id: 6,  action_label: 'Sleep 7 to 9 hours',          condition_desc: 'Sweet spot — not too little, not too much', points: 10, is_bonus: false },
      { id: 7,  action_label: 'Sleep 6 to 7 hours',          condition_desc: 'Decent rest, just under the ideal range',   points: 5,  is_bonus: false },
      { id: 8,  action_label: 'Rate sleep quality 4 or 5',   condition_desc: 'Self-reported quality score out of 5',      points: 5,  is_bonus: true  },
    ],
  },
  {
    label: 'Nutrition', icon: Utensils, color: 'text-emerald-400', bgColor: 'bg-emerald-400/10', max: 33,
    rules: [
      { id: 9,  action_label: 'Drink 3 or more litres of water',     condition_desc: 'Fully hydrated for the day',                       points: 10, is_bonus: false },
      { id: 10, action_label: 'Drink between 2 and 3 litres',        condition_desc: 'Good hydration, just shy of the top tier',         points: 5,  is_bonus: false },
      { id: 11, action_label: 'Eat 2 or more home-cooked meals',     condition_desc: 'Meals prepared at home count',                     points: 5,  is_bonus: false },
      { id: 12, action_label: 'Have a protein-focused meal',         condition_desc: 'Log a meal where protein is the main focus',       points: 5,  is_bonus: false },
      { id: 13, action_label: 'Hit 100g or more of protein',         condition_desc: 'Total protein intake for the day reaches 100g',   points: 3,  is_bonus: true  },
      { id: 14, action_label: 'Skip junk food entirely',             condition_desc: 'No junk food consumed during the day',             points: 5,  is_bonus: false },
      { id: 15, action_label: 'No alcohol',                          condition_desc: 'Alcohol-free day',                                 points: 5,  is_bonus: false },
    ],
  },
  {
    label: 'Steps', icon: Footprints, color: 'text-amber-400', bgColor: 'bg-amber-400/10', max: 15,
    rules: [
      { id: 16, action_label: '10,000 or more steps', condition_desc: 'Full active day', points: 15, is_bonus: false, age_note: 'Over 35: 8,500 steps counts' },
      { id: 17, action_label: '7,500 or more steps',  condition_desc: 'Solid movement',  points: 10, is_bonus: false, age_note: 'Over 35: 6,375 steps counts' },
      { id: 18, action_label: '5,000 or more steps',  condition_desc: 'Getting there',   points: 5,  is_bonus: false, age_note: 'Over 35: 4,250 steps counts' },
    ],
  },
  {
    label: 'Log Streak', icon: Flame, color: 'text-orange-400', bgColor: 'bg-orange-400/10', streakNote: true,
    rules: [
      { id: 19, action_label: '7-day logging streak',          condition_desc: 'Log anything every day for a week',                  points: 10,  is_bonus: false },
      { id: 20, action_label: '14-day logging streak',         condition_desc: 'Two full weeks of showing up',                       points: 20,  is_bonus: false },
      { id: 21, action_label: '30-day logging streak',         condition_desc: 'A full month of logging',                            points: 40,  is_bonus: false },
      { id: 22, action_label: '60-day logging streak',         condition_desc: 'Two months without missing a day',                   points: 75,  is_bonus: false },
      { id: 23, action_label: '90-day logging streak',         condition_desc: 'Three months — identity-level habit',                points: 100, is_bonus: false },
      { id: 24, action_label: 'Every 30 days beyond 90',       condition_desc: 'Repeating bonus for every additional 30-day block',  points: 50,  is_bonus: false },
    ],
  },
  {
    label: 'Weekly Goals', icon: TrendingUp, color: 'text-green-400', bgColor: 'bg-green-400/10', streakNote: true,
    rules: [
      { id: 25, action_label: 'Hit some weekly goals (partial)', condition_desc: 'Met some of: workout days, workout mins, home-cooked meals goals', points: 20, is_bonus: false },
      { id: 26, action_label: 'Hit all weekly goals (full)',      condition_desc: 'All set weekly profile goals met this week',                       points: 50, is_bonus: false },
    ],
  },
  {
    label: 'Goal Crush', icon: Zap, color: 'text-amber-400', bgColor: 'bg-amber-400/10', streakNote: true,
    rules: [
      { id: 27, action_label: '3-day goal crush streak',  condition_desc: 'Hit personal daily goals 3 days running',                     points: 15,  is_bonus: false },
      { id: 28, action_label: '7-day goal crush streak',  condition_desc: 'A full week of crushing daily goals',                         points: 50,  is_bonus: false },
      { id: 29, action_label: '14-day goal crush streak', condition_desc: 'Two weeks of daily goal performance',                          points: 100, is_bonus: false },
      { id: 30, action_label: '30-day goal crush streak', condition_desc: 'A full month hitting every daily target',                      points: 200, is_bonus: false },
      { id: 31, action_label: 'Every 30 days beyond 30',  condition_desc: 'Repeating bonus for sustained daily goal performance',         points: 200, is_bonus: false },
    ],
  },
];

function ScoringGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-text-muted flex-shrink-0" />
          <span className="text-sm font-semibold text-text-primary">How points are scored</span>
          <span className="text-[11px] text-text-muted bg-surface-2 px-2 py-0.5 rounded-full">98 pts / day max</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-white/10 divide-y divide-white/10">
          {SCORING_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.label} className="px-4 py-3">
                {/* Category header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${cat.bgColor}`}>
                    <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-wider ${cat.color}`}>{cat.label}</span>
                  {cat.max != null && (
                    <span className="ml-auto text-[11px] text-text-muted tabular-nums">max {cat.max} pts</span>
                  )}
                  {cat.streakNote && (
                    <span className="ml-auto text-[11px] text-text-muted">one-time bonus per milestone</span>
                  )}
                </div>

                {/* Rules table */}
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-white/5">
                    {cat.rules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="py-1.5 pr-3">
                          <div className="flex items-start gap-1.5">
                            {rule.is_bonus && (
                              <span className="mt-0.5 flex-shrink-0 text-[9px] font-bold text-text-muted bg-white/8 px-1 rounded">+</span>
                            )}
                            <div>
                              <p className="text-text-primary font-medium leading-snug">{rule.action_label}</p>
                              <p className="text-text-muted leading-snug mt-0.5 text-[11px]">{rule.condition_desc}</p>
                              {rule.age_note && (
                                <p className="leading-snug mt-0.5 flex items-center gap-1">
                                  <span className="text-[9px] font-bold bg-amber-400/10 text-amber-400 px-1 py-0.5 rounded">35+</span>
                                  <span className="text-amber-400/80 text-[10px]">{rule.age_note}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-1.5 text-right align-top whitespace-nowrap">
                          <span className={`font-bold tabular-nums ${cat.color}`}>
                            {rule.is_bonus ? `+${rule.points}` : rule.points}
                          </span>
                          <span className="text-text-muted ml-0.5">pts</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div className="px-4 py-3 bg-surface-2/50">
            <p className="text-[11px] text-text-muted leading-relaxed">
              <span className="font-semibold text-text-secondary">Age bracket:</span> Members over 35 have 85% thresholds for steps and cardio for fair comparison.
              Streak bonuses are one-time awards per milestone and do not count toward the 98 pts/day cap.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeaderboardTab() {
  const [view, setView] = useState<LeaderboardView>('weekly');
  const [weekStart, setWeekStart] = useState<string>(getCurrentWeekMonday);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr);
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

        {/* Month navigator */}
        {view === 'monthly' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedMonth((m) => addMonthsToStr(m, -1))}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4 text-text-secondary" />
            </button>

            <div className="relative flex-1 flex justify-center">
              <button
                onClick={() => setMonthCalendarOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 hover:bg-white/10 rounded-xl text-sm font-medium text-text-primary transition-colors w-full justify-center"
              >
                <CalendarDays className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <span className="truncate">{data.period}</span>
              </button>
              {monthCalendarOpen && (
                <MonthPicker
                  selectedMonth={selectedMonth}
                  onSelect={(m) => { setSelectedMonth(m); }}
                  onClose={() => setMonthCalendarOpen(false)}
                />
              )}
            </div>

            <button
              onClick={() => { if (!isCurrentMonth) setSelectedMonth((m) => addMonthsToStr(m, 1)); }}
              disabled={isCurrentMonth}
              className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                isCurrentMonth ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10'
              }`}
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        )}

        {view === 'alltime' && (
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
                        {r.user.goal_crush_streak > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-amber-400 text-xs font-semibold">
                            <Zap className="w-3 h-3" />
                            {r.user.goal_crush_streak}d
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

      {/* ── Scoring guide ── */}
      <ScoringGuide />
    </div>
  );
}
