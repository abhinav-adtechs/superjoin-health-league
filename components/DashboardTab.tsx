'use client';

import { useState, useEffect, useRef, type ComponentType, type ReactNode, type ReactElement } from 'react';
import {
  Flame,
  Target,
  TrendingUp,
  Dumbbell,
  Droplets,
  Moon,
  Activity,
  CheckCircle2,
  Zap,
  ArrowRight,
  Utensils,
  Trophy,
  Footprints,
  ChevronDown,
  LayoutGrid,
  Circle,
} from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import { LogEntryModal, type EntryType } from './LogEntryModal';
import type { Profile, DailyEntry, FitnessGoal } from '@/lib/types';
import { FITNESS_GOAL_THEMES } from '@/lib/fitness-goal-theme';

const FITNESS_GOAL_BADGES: Record<FitnessGoal, { label: string; color: string }> = Object.fromEntries(
  (Object.entries(FITNESS_GOAL_THEMES) as [FitnessGoal, { label: string; badgeClass: string }][]).map(
    ([k, v]) => [k, { label: v.label, color: v.badgeClass }],
  ),
) as Record<FitnessGoal, { label: string; color: string }>;

// ── Blueprint Insights (desktop/tablet only in UI — see Section 6) ─────────────
const BLUEPRINT_INSIGHTS = [
  {
    category: 'Sleep',
    categoryColor: 'blue' as const,
    text: 'Finish eating at least 3 hours before bedtime. Your body repairs tissue at night — it cannot do that while digesting.',
    action: 'Log your last meal time when you log food tonight.',
  },
  {
    category: 'Workout',
    categoryColor: 'orange' as const,
    text: 'Minimum effective dose: 3 strength sessions + 3 cardio sessions per week delivers ~90% of the longevity benefit.',
    action: 'Check your workout days count in the This Week section above.',
  },
  {
    category: 'Nutrition',
    categoryColor: 'green' as const,
    text: 'Target 1g of protein per lb of target body weight, spread across meals throughout the day — not in one sitting.',
    action: 'Mark the protein meal checkbox when you log food today.',
  },
  {
    category: 'Sleep',
    categoryColor: 'blue' as const,
    text: 'Below 7 hours of sleep, cognitive performance degrades to the equivalent of 24 hours of full deprivation. 8 is the target.',
    action: 'Log your sleep hours if you have not yet today.',
  },
  {
    category: 'Recovery',
    categoryColor: 'red' as const,
    text: 'Even one alcoholic drink disrupts deep sleep quality by ~24%. Two or more effectively eliminate restorative REM sleep.',
    action: 'Log zero alcohol today for a full recovery night.',
  },
  {
    category: 'Workout',
    categoryColor: 'orange' as const,
    text: 'Zone 2 cardio — conversational pace for 45 minutes, 3×/week — is the single highest-ROI longevity exercise.',
    action: 'Log a cardio session today if it is on your schedule.',
  },
  {
    category: 'Nutrition',
    categoryColor: 'green' as const,
    text: 'Hydration affects cognition, energy, and recovery. Hitting your water goal before 6 PM avoids late-night intake that disrupts sleep.',
    action: 'Track your water progress in the daily goals above.',
  },
  {
    category: 'Sleep',
    categoryColor: 'blue' as const,
    text: 'Consistent sleep and wake times — within 30 minutes every day, including weekends — matter more than total hours.',
    action: 'Aim to wake at the same time tomorrow as today.',
  },
  {
    category: 'Workout',
    categoryColor: 'orange' as const,
    text: 'After 30, you lose 1–2% of muscle mass per year without resistance training. Strength work is non-negotiable for longevity.',
    action: 'Log a strength session if it is on your plan today.',
  },
  {
    category: 'Nutrition',
    categoryColor: 'green' as const,
    text: 'Home-cooked meals give full control over seed oils, sodium, and portion size — the three biggest levers in daily food quality.',
    action: 'Log a home-cooked meal when you eat today.',
  },
  {
    category: 'Recovery',
    categoryColor: 'red' as const,
    text: '7,000–10,000 daily steps reduces all-cause mortality by up to 50% — more impact per minute than almost any other single intervention.',
    action: 'Check your step count above and close the gap to your daily goal.',
  },
  {
    category: 'Workout',
    categoryColor: 'orange' as const,
    text: 'Progressive overload — doing incrementally more each session — is the only proven driver of long-term strength and muscle adaptation.',
    action: 'Log your workout duration and type accurately after training.',
  },
  {
    category: 'Nutrition',
    categoryColor: 'green' as const,
    text: 'Junk food is engineered to override satiety signals. Logging it builds the awareness that must come before behaviour change.',
    action: 'Be honest in your food log — no judgment, only data.',
  },
  {
    category: 'Sleep',
    categoryColor: 'blue' as const,
    text: 'Blue light after 9 PM suppresses melatonin production by up to 50%, delaying sleep onset and reducing recovery quality.',
    action: 'Log your sleep quality rating honestly tonight.',
  },
  {
    category: 'Recovery',
    categoryColor: 'red' as const,
    text: 'Streaks are not about perfection — they are about identity. Consistent daily logging compounds into measurable transformation over months.',
    action: 'Log at least one field today to keep your streak alive.',
  },
] as const;

type InsightColor = 'blue' | 'green' | 'orange' | 'red';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Use local calendar date (not UTC) to avoid timezone-shifted date strings */
function getLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysInMonthFor(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function getMondayOfWeek(d: Date): string {
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return getLocalDateStr(monday);
}

function clampPct(value: number | null | undefined, goal: number | null | undefined): number {
  if (!goal || goal <= 0 || value == null) return 0;
  const n = Math.round((Number(value) / Number(goal)) * 100);
  if (!Number.isFinite(n)) return 0;
  return Math.min(n, 100);
}

/** Collapsed goal cards: % color — red when behind (<35%), amber mid, green strong / complete. */
function progressPctToneClass(pct: number, dim: boolean): string {
  if (dim) return 'text-text-muted';
  const p = Math.min(100, Math.max(0, Math.round(pct)));
  if (p < 35) return 'text-red-600';
  if (p < 70) return 'text-amber-600';
  if (p < 100) return 'text-emerald-600';
  return 'text-emerald-600';
}

function getDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function ringColor(pct: number): string {
  if (pct >= 80) return '#059669';
  if (pct >= 50) return '#d97706';
  return '#dc2626';
}

type GoalMetrics = {
  waterPct: number;
  sleepPct: number;
  workoutDone: boolean;
  workoutPct: number;
  proteinPct: number | null;
  caloriePct: number | null;
  stepsPct: number | null;
  overallDailyPct: number;
  activeDailyPcts: number[];
};

function computeGoalMetrics(entry: DailyEntry | null, profile: Profile): GoalMetrics {
  const sleepGoal = profile.goal_sleep_hours ?? profile.goal_sleep_hours_max;
  const foodMode = profile.food_tracking_mode ?? null;
  const trackProtein = !foodMode || foodMode === 'protein_only' || foodMode === 'both';
  const trackCalories = foodMode === 'calories_only' || foodMode === 'both';
  const trackSteps = (profile.goal_steps_day ?? 0) > 0;

  const waterPct = clampPct(entry?.water_liters, profile.goal_water_liters);
  const sleepPct = clampPct(entry?.sleep_hours, sleepGoal);
  const workoutDone = !!(entry?.workout_done || entry?.cardio_done);
  const workoutPct = workoutDone ? 100 : 0;

  let proteinPct: number | null = null;
  if (trackProtein && profile.goal_protein_g_day) {
    proteinPct = clampPct(
      (entry as DailyEntry & { protein_qty?: number | null })?.protein_qty,
      profile.goal_protein_g_day,
    );
  }

  let caloriePct: number | null = null;
  if (trackCalories && profile.goal_calories_day) {
    const cal = (entry as DailyEntry & { calories_kcal?: number | null })?.calories_kcal;
    if (cal != null) {
      const fg = profile.fitness_goal ?? 'stay_active';
      if (fg === 'lose_weight') {
        const raw = Math.min(100, Math.round((profile.goal_calories_day / Math.max(cal, 1)) * 100));
        caloriePct = Number.isFinite(raw) ? raw : 0;
      } else {
        caloriePct = clampPct(cal, profile.goal_calories_day);
      }
    } else {
      caloriePct = 0;
    }
  }

  const stepsPct =
    trackSteps && profile.goal_steps_day ? clampPct(entry?.steps, profile.goal_steps_day) : null;

  const activeDailyPcts: number[] = [];
  if (profile.goal_water_liters) activeDailyPcts.push(waterPct);
  if (sleepGoal) activeDailyPcts.push(sleepPct);
  if (profile.goal_workout_days_week) activeDailyPcts.push(workoutPct);
  if (proteinPct !== null) activeDailyPcts.push(proteinPct);
  if (caloriePct !== null) activeDailyPcts.push(caloriePct);
  if (stepsPct !== null) activeDailyPcts.push(stepsPct);

  const safePcts = activeDailyPcts.filter((p) => Number.isFinite(p));
  const overallDailyPct =
    safePcts.length > 0
      ? Math.round(safePcts.reduce((a, b) => a + b, 0) / safePcts.length)
      : activeDailyPcts.length > 0
        ? 0
        : entry
          ? Math.min(Math.round(((entry.daily_points ?? 0) / 85) * 100), 100)
          : 0;

  return {
    waterPct,
    sleepPct,
    workoutDone,
    workoutPct,
    proteinPct,
    caloriePct,
    stepsPct,
    overallDailyPct,
    activeDailyPcts,
  };
}

type RemainingLine = { icon: ReactElement; text: string; modalType: EntryType };

function computeRemainingItems(entry: DailyEntry | null, profile: Profile): RemainingLine[] {
  const m = computeGoalMetrics(entry, profile);
  const sleepGoal = profile.goal_sleep_hours ?? profile.goal_sleep_hours_max;
  const foodMode = profile.food_tracking_mode ?? null;
  const trackProtein = !foodMode || foodMode === 'protein_only' || foodMode === 'both';
  const trackCalories = foodMode === 'calories_only' || foodMode === 'both';
  const trackSteps = (profile.goal_steps_day ?? 0) > 0;

  const items: RemainingLine[] = [];

  if (profile.goal_water_liters && (entry?.water_liters ?? 0) < profile.goal_water_liters) {
    const rem = (profile.goal_water_liters - (entry?.water_liters ?? 0)).toFixed(1);
    items.push({
      icon: <Droplets className="w-4 h-4 text-accent-blue" />,
      text: `Drink ${rem} L more water`,
      modalType: 'meal_recovery',
    });
  }
  if (sleepGoal && !entry?.sleep_hours) {
    items.push({
      icon: <Moon className="w-4 h-4 text-accent-purple" />,
      text: "Log last night's sleep",
      modalType: 'sleep',
    });
  }
  if (profile.goal_workout_days_week && !m.workoutDone) {
    items.push({
      icon: <Dumbbell className="w-4 h-4 text-accent-superjoin-orange" />,
      text: "Log today's workout",
      modalType: 'movement',
    });
  }
  if (trackProtein && profile.goal_protein_g_day && m.proteinPct !== null && m.proteinPct < 100) {
    const logged = (entry as DailyEntry & { protein_qty?: number | null })?.protein_qty ?? 0;
    const rem = profile.goal_protein_g_day - logged;
    items.push({
      icon: <Utensils className="w-4 h-4 text-amber-500" />,
      text: `Log ${rem}g more protein`,
      modalType: 'meal_recovery',
    });
  }
  if (trackCalories && profile.goal_calories_day && m.caloriePct !== null && m.caloriePct < 80) {
    items.push({
      icon: <Utensils className="w-4 h-4 text-amber-500" />,
      text:
        profile.fitness_goal === 'lose_weight'
          ? 'Track your calorie intake today'
          : 'Log your calorie intake to hit target',
      modalType: 'meal_recovery',
    });
  }
  if (trackSteps && profile.goal_steps_day && m.stepsPct !== null && m.stepsPct < 100) {
    const logged = entry?.steps ?? 0;
    const rem = profile.goal_steps_day - logged;
    items.push({
      icon: <Footprints className="w-4 h-4 text-amber-500" />,
      text: rem > 0 ? `${rem.toLocaleString()} more steps to reach your goal` : 'Log your steps today',
      modalType: 'movement',
    });
  }

  return items;
}

// ── SVG Circle Ring ────────────────────────────────────────────────────────────

function CircleRing({
  pct,
  size,
  strokeWidth,
  color,
  trackColor = '#e2e8f0',
}: {
  pct: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const safePct = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  const offset = circ * (1 - safePct / 100);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)' }}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.7s ease' }}
      />
    </svg>
  );
}

const INSIGHT_BADGE: Record<InsightColor, string> = {
  blue: 'bg-accent-blue/10 text-accent-blue',
  green: 'bg-accent-green/10 text-accent-green',
  orange: 'bg-accent-superjoin-orange/10 text-accent-superjoin-orange',
  red: 'bg-accent-red/10 text-accent-red',
};

const DASHBOARD_GOALS_LAYOUT_KEY = 'dashboard-goals-layout';

type BoxGoalRow = {
  id: string;
  sortOrder: number;
  title: string;
  Icon: ComponentType<{ className?: string }>;
  pct: number;
  fill: string;
  dim: boolean;
  currentText: string;
  goalText: string;
};

/** Shared mobile + desktop “box” goals UI (matrix + optional bar collapse). */
function GoalsBoxPanel({
  variant,
  showBarCollapse,
  barExpanded,
  onToggleBars,
  rows,
  compositeParts,
  overallDailyPct,
  streakChips,
  avgCaptionDay = 'today',
}: {
  variant: 'mobile' | 'desktop';
  showBarCollapse: boolean;
  barExpanded: boolean;
  onToggleBars: () => void;
  rows: BoxGoalRow[];
  compositeParts: BoxGoalRow[];
  overallDailyPct: number;
  streakChips: ReactNode;
  /** Wording for the tiny caption under Daily average. */
  avgCaptionDay?: 'today' | 'yesterday';
}) {
  const isDesktop = variant === 'desktop';
  const showBars = !showBarCollapse || barExpanded;
  const d = isDesktop
    ? {
        card: 'px-5 py-4 rounded-2xl',
        av: 'text-2xl',
        desc: 'text-[9px] mb-1 leading-tight',
        barTrack: 'h-3.5',
        matrixPct: 'text-xl',
        matrixLabel: 'text-[9px]',
        matrixValue: 'text-sm',
        grid: 'mt-4 grid grid-cols-2 gap-3 max-w-4xl mx-auto',
        barSection: 'space-y-3 rounded-xl border border-white/10 bg-surface-1/30 md:bg-surface-1 px-4 py-3 max-w-4xl mx-auto',
        barRow: 'h-3',
        barLabel: 'text-xs',
        toggle: '',
      }
    : {
        card: 'px-3 py-2.5 rounded-xl',
        av: 'text-lg',
        desc: 'text-[8px] mt-0.5 mb-1 leading-tight',
        barTrack: 'h-3',
        matrixPct: 'text-lg',
        matrixLabel: 'text-[8px]',
        matrixValue: 'text-[11px]',
        grid: 'mt-3 grid grid-cols-2 gap-2',
        barSection: 'space-y-2.5 rounded-xl border border-white/10 bg-surface-1/30 md:bg-surface-1 px-3 py-2.5',
        barRow: 'h-2.5',
        barLabel: 'text-[11px]',
        toggle: 'mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/12 bg-surface-1/40 md:bg-surface-1 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-2/60 active:scale-[0.99]',
      };

  return (
    <div className={isDesktop ? 'space-y-4' : 'space-y-3'}>
      <div className={d.card}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Daily average</p>
          <p className={`${d.av} font-semibold tabular-nums ${progressPctToneClass(overallDailyPct, false)}`}>
            {overallDailyPct}
            <span className="text-xs font-semibold opacity-80">%</span>
          </p>
        </div>
        <p className={`text-text-muted/75 ${d.desc}`}>
          {avgCaptionDay === 'yesterday'
            ? "Average of each goal's % toward that day's targets."
            : "Average of each goal's % toward today's targets."}
        </p>
        <div className={`relative ${d.barTrack} w-full overflow-hidden rounded-full bg-surface-3/90`}>
          <div
            className="absolute left-0 top-0 flex h-full overflow-hidden rounded-full transition-[width] duration-500"
            style={{ width: `${Math.min(100, overallDailyPct)}%` }}
          >
            {compositeParts.length > 0 ? (
              compositeParts.map((row) => (
                <div
                  key={row.id}
                  className="h-full min-w-[3px] border-r border-white/25 last:border-r-0"
                  style={{
                    flex: Math.max(1, Number.isFinite(row.pct) ? Math.round(row.pct) : 0),
                    backgroundColor: row.fill,
                  }}
                />
              ))
            ) : (
              <div className="h-full w-full bg-surface-3" />
            )}
          </div>
        </div>

        <div className={d.grid}>
          {rows.map((row) => {
            const RowIcon = row.Icon;
            const pct = Math.min(100, Math.round(row.pct));
            return (
              <div
                key={row.id}
                className={`grid min-h-0 grid-cols-2 grid-rows-2 gap-x-2 gap-y-1.5 rounded-lg border p-2 ${
                  row.dim ? 'border-white/5 bg-surface-2/30 md:bg-surface-2 opacity-80' : 'border-white/10 bg-surface-1/50 md:bg-surface-1'
                }`}
              >
                <div className="flex min-w-0 flex-col justify-center">
                  <span className={`${d.matrixLabel} font-medium uppercase tracking-wide text-text-muted`}>Progress</span>
                  <span
                    className={`${d.matrixPct} tabular-nums leading-none ${row.dim ? 'font-normal' : 'font-semibold'} ${progressPctToneClass(pct, row.dim)}`}
                  >
                    {row.dim ? '—' : `${pct}%`}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col items-end justify-center text-right">
                  <span className={`${d.matrixLabel} font-medium uppercase tracking-wide text-text-muted`}>Metric</span>
                  <div className="flex max-w-full items-center justify-end gap-0.5">
                    <RowIcon
                      className={`h-3.5 w-3.5 shrink-0 ${row.dim ? 'text-text-muted/45' : 'text-text-muted'}`}
                      aria-hidden
                    />
                    <span
                      className={`truncate ${isDesktop ? 'text-xs' : 'text-[10px]'} font-medium leading-tight ${row.dim ? 'text-text-muted' : 'text-text-primary'}`}
                    >
                      {row.title}
                    </span>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col justify-end border-t border-white/5 pt-1">
                  <span className="text-[8px] font-medium text-text-muted">Now</span>
                  <span
                    className={`${d.matrixValue} tabular-nums ${
                      row.dim ? 'font-normal text-text-muted' : 'font-semibold text-text-primary'
                    }`}
                  >
                    {row.currentText}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col items-end justify-end border-t border-white/5 pt-1 text-right">
                  <span className="text-[8px] font-medium text-text-muted">Target</span>
                  <span
                    className={`${d.matrixValue} font-normal tabular-nums ${
                      row.dim ? 'text-text-muted' : row.goalText === 'Not set' ? 'text-text-muted' : 'text-text-secondary'
                    }`}
                  >
                    {row.goalText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {showBarCollapse && (
          <button
            type="button"
            onClick={onToggleBars}
            aria-expanded={barExpanded}
            className={d.toggle}
          >
            {barExpanded ? 'Hide progress bars' : 'Show progress bars'}
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 ${barExpanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
        )}
      </div>

      {showBars && (
        <div className={d.barSection}>
          {rows.map((row) => {
            const RowIcon = row.Icon;
            const pct = Math.min(100, Math.round(row.pct));
            return (
              <div key={`bar-${row.id}`} className={row.dim ? 'opacity-75' : ''}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <RowIcon
                      className={`h-3.5 w-3.5 shrink-0 ${row.dim ? 'text-text-muted/45' : 'text-text-muted'}`}
                      aria-hidden
                    />
                    <span className={`${d.barLabel} font-medium ${row.dim ? 'text-text-muted' : 'text-text-primary'}`}>
                      {row.title}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 ${d.barLabel} tabular-nums ${
                      row.dim ? 'font-normal text-text-muted' : 'font-semibold text-text-secondary'
                    }`}
                  >
                    {row.dim ? '—' : `${pct}%`}
                  </span>
                </div>
                <div className={`${d.barRow} w-full overflow-hidden rounded-full bg-surface-3/90`}>
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: row.dim ? '0%' : `${pct}%`,
                      backgroundColor: row.dim ? '#e2e8f0' : row.fill,
                      minWidth: !row.dim && pct > 0 ? '4px' : undefined,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className={`flex flex-wrap justify-center gap-1.5 ${isDesktop ? 'pt-1' : 'pt-0.5'}`}>{streakChips}</div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function DashboardTab({
  profile,
  onRefresh,
  refreshTrigger = 0,
  onOpenLeaderboard,
}: {
  profile: Profile;
  onRefresh: () => void;
  refreshTrigger?: number;
  onOpenLeaderboard?: () => void;
}) {
  const [todayEntry, setTodayEntry] = useState<DailyEntry | null>(null);
  const [yesterdayEntry, setYesterdayEntry] = useState<DailyEntry | null>(null);
  const [goalsPeriod, setGoalsPeriod] = useState<'today' | 'yesterday'>('today');
  const [goalsPeriodMenuOpen, setGoalsPeriodMenuOpen] = useState(false);
  const goalsPeriodMenuRef = useRef<HTMLDivElement>(null);
  const [weeklyEntries, setWeeklyEntries] = useState<DailyEntry[]>([]);
  const [loggingStreak, setLoggingStreak] = useState(0);
  const [goalCrushStreak, setGoalCrushStreak] = useState(0);
  const [weekLogDays, setWeekLogDays] = useState(0);
  const [weeklyGoalsHit, setWeeklyGoalsHit] = useState<'full' | 'partial' | 'none'>('none');
  const [weeklyPoints, setWeeklyPoints] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [monthRank, setMonthRank] = useState<number | null>(null);
  const [monthlyPoints, setMonthlyPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<EntryType | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  /** Mobile: detailed per-goal bars hidden until user expands */
  const [mobileGoalsExpanded, setMobileGoalsExpanded] = useState(false);
  /** Desktop (md+): circle rings vs box matrix — persisted */
  const [desktopGoalsView, setDesktopGoalsView] = useState<'circles' | 'box'>(() => {
    if (typeof window === 'undefined') return 'box';
    const v = localStorage.getItem(DASHBOARD_GOALS_LAYOUT_KEY);
    return v === 'circles' ? 'circles' : 'box';
  });

  // ── Data loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const today = getLocalDateStr(new Date());
        const yest = new Date();
        yest.setDate(yest.getDate() - 1);
        const yesterdayStr = getLocalDateStr(yest);
        const monday = getMondayOfWeek(new Date());
        const d = new Date();
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const [entryRes, yesterdayRes, weeklyRes, streakRes, lbRes, monthLbRes] = await Promise.all([
          fetch(apiUrl(`/api/entries?date=${today}`), getApiFetchOptions()),
          fetch(apiUrl(`/api/entries?date=${yesterdayStr}`), getApiFetchOptions()),
          fetch(apiUrl(`/api/entries/history?from=${monday}&to=${today}`), getApiFetchOptions()),
          fetch(apiUrl('/api/streaks/me'), getApiFetchOptions()),
          fetch(apiUrl('/api/leaderboard?view=weekly'), getApiFetchOptions()),
          fetch(apiUrl(`/api/leaderboard?view=monthly&month=${monthStr}`), getApiFetchOptions()),
        ]);
        if (cancelled) return;
        const [entryData, yesterdayData, weeklyData, streakData, lbData, monthLbData] = await Promise.all([
          entryRes.json().catch(() => null),
          yesterdayRes.json().catch(() => null),
          weeklyRes.json().catch(() => []),
          streakRes.json().catch(() => ({})),
          lbRes.json().catch(() => ({})),
          monthLbRes.json().catch(() => ({})),
        ]);
        if (cancelled) return;
        setTodayEntry(entryData?.id ? (entryData as DailyEntry) : null);
        setYesterdayEntry(yesterdayData?.id ? (yesterdayData as DailyEntry) : null);
        setWeeklyEntries(Array.isArray(weeklyData) ? (weeklyData as DailyEntry[]) : []);
        setLoggingStreak(streakData.logging_streak ?? 0);
        setGoalCrushStreak(streakData.goal_crush_streak ?? 0);
        setWeekLogDays(streakData.week_log_days ?? 0);
        setWeeklyGoalsHit(streakData.weekly_goals_hit ?? 'none');
        const name = profile.display_name;
        const myEntry = lbData.rankings?.find(
          (r: { user: { display_name: string }; rank: number; score: { total_points: number } }) =>
            r.user.display_name === name,
        );
        setRank(myEntry?.rank ?? null);
        setWeeklyPoints(myEntry?.score?.total_points ?? 0);
        const myMonthEntry = monthLbData.rankings?.find(
          (r: { user: { display_name: string }; rank: number; score: { total_points: number } }) =>
            r.user.display_name === name,
        );
        setMonthRank(myMonthEntry?.rank ?? null);
        setMonthlyPoints(myMonthEntry?.score?.total_points ?? 0);
      } catch (e) {
        console.error('Dashboard load failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [profile.display_name, refreshKey, refreshTrigger]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_GOALS_LAYOUT_KEY, desktopGoalsView);
  }, [desktopGoalsView]);

  useEffect(() => {
    if (!goalsPeriodMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (goalsPeriodMenuRef.current && !goalsPeriodMenuRef.current.contains(e.target as Node)) {
        setGoalsPeriodMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGoalsPeriodMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [goalsPeriodMenuOpen]);

  // ── Computed values ───────────────────────────────────────────────────────────

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (() => {
    const raw = profile.display_name?.trim();
    if (!raw) return 'there';
    return raw.split(/\s+/)[0] || 'there';
  })();
  const dayOfMonth = now.getDate();
  const daysInMonth = daysInMonthFor(now);
  const monthNameLong = now.toLocaleDateString('en-US', { month: 'long' });
  const daysRemainingInMonth = daysInMonth - dayOfMonth + 1;
  const todayLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const sleepGoal = profile.goal_sleep_hours ?? profile.goal_sleep_hours_max;
  const foodMode = profile.food_tracking_mode ?? null;
  const trackProtein = !foodMode || foodMode === 'protein_only' || foodMode === 'both';
  const trackCalories = foodMode === 'calories_only' || foodMode === 'both';
  const trackSteps = (profile.goal_steps_day ?? 0) > 0;
  const showProteinFoodGoal = trackProtein && !!profile.goal_protein_g_day;
  const showCalorieFoodGoal = trackCalories && !!profile.goal_calories_day;
  const dualFoodGoals = showProteinFoodGoal && showCalorieFoodGoal;
  const ringSizeFoodGoals = trackSteps || dualFoodGoals ? 52 : 60;
  const strokeFoodGoals = trackSteps || dualFoodGoals ? 6 : 7;
  /** Circles row: 1–2 food rings (or placeholder) + water + sleep + workout + optional steps */
  const goalRingsGridClass =
    dualFoodGoals && trackSteps
      ? 'grid-cols-6 max-w-md'
      : dualFoodGoals || trackSteps
        ? 'grid-cols-5 max-w-sm'
        : 'grid-cols-4 max-w-xs';

  const todayMetrics = computeGoalMetrics(todayEntry, profile);
  const goalsEntry = goalsPeriod === 'yesterday' ? yesterdayEntry : todayEntry;
  const goalsMetrics = computeGoalMetrics(goalsEntry, profile);

  const {
    waterPct,
    sleepPct,
    workoutDone,
    workoutPct,
    proteinPct,
    caloriePct,
    stepsPct,
    overallDailyPct,
  } = goalsMetrics;

  const hasGoals = todayMetrics.activeDailyPcts.length > 0;
  const remainingItems = computeRemainingItems(todayEntry, profile);
  const allGoalsMet = hasGoals && remainingItems.length === 0;

  const remainingForGoalsView = computeRemainingItems(goalsEntry, profile);
  const allGoalsMetForGoalsView = hasGoals && remainingForGoalsView.length === 0;

  /** Mobile: sorted goal rows with current vs goal text + individual bars + composite summary. */
  type MobileGoalRow = {
    id: string;
    sortOrder: number;
    title: string;
    Icon: ComponentType<{ className?: string }>;
    pct: number;
    fill: string;
    dim: boolean;
    currentText: string;
    goalText: string;
  };
  const mobileGoalRowsUnsorted: MobileGoalRow[] = [];
  if (showProteinFoodGoal) {
    const logged = (goalsEntry as DailyEntry & { protein_qty?: number | null })?.protein_qty ?? 0;
    mobileGoalRowsUnsorted.push({
      id: 'protein',
      sortOrder: 1,
      title: 'Protein',
      Icon: Utensils,
      pct: proteinPct ?? 0,
      fill: '#f59e0b',
      dim: false,
      currentText: `${Math.round(logged)} g`,
      goalText: `${profile.goal_protein_g_day} g`,
    });
  }
  if (showCalorieFoodGoal) {
    const cal = (goalsEntry as DailyEntry & { calories_kcal?: number | null })?.calories_kcal ?? 0;
    mobileGoalRowsUnsorted.push({
      id: 'calories',
      sortOrder: 1,
      title: 'Calories',
      Icon: Utensils,
      pct: caloriePct ?? 0,
      fill: '#ea580c',
      dim: false,
      currentText: `${cal ? Math.round(cal).toLocaleString() : '0'} kcal`,
      goalText: `${(profile.goal_calories_day ?? 0).toLocaleString()} kcal`,
    });
  }
  if (!showProteinFoodGoal && !showCalorieFoodGoal) {
    mobileGoalRowsUnsorted.push({
      id: 'food',
      sortOrder: 1,
      title: 'Food',
      Icon: Utensils,
      pct: 0,
      fill: '#94a3b8',
      dim: true,
      currentText: '—',
      goalText: 'Not set',
    });
  }
  mobileGoalRowsUnsorted.push({
    id: 'water',
    sortOrder: 2,
    title: 'Water',
    Icon: Droplets,
    pct: profile.goal_water_liters ? waterPct : 0,
    fill: '#2563eb',
    dim: !profile.goal_water_liters,
    currentText: profile.goal_water_liters ? `${(goalsEntry?.water_liters ?? 0).toFixed(1)} L` : '—',
    goalText: profile.goal_water_liters ? `${profile.goal_water_liters} L` : 'Not set',
  });
  mobileGoalRowsUnsorted.push({
    id: 'sleep',
    sortOrder: 3,
    title: 'Sleep',
    Icon: Moon,
    pct: sleepGoal ? sleepPct : 0,
    fill: '#7c3aed',
    dim: !sleepGoal,
    currentText:
      sleepGoal && goalsEntry?.sleep_hours != null ? `${Number(goalsEntry.sleep_hours).toFixed(1)} h` : '—',
    goalText: sleepGoal ? `${sleepGoal} h` : 'Not set',
  });
  mobileGoalRowsUnsorted.push({
    id: 'workout',
    sortOrder: 4,
    title: 'Workout',
    Icon: Dumbbell,
    pct: profile.goal_workout_days_week ? workoutPct : 0,
    fill: '#FF6B35',
    dim: !profile.goal_workout_days_week,
    currentText: profile.goal_workout_days_week ? (workoutDone ? 'Logged' : 'Not logged') : '—',
    goalText: profile.goal_workout_days_week
      ? goalsPeriod === 'yesterday'
        ? '1 session'
        : '1 session today'
      : 'Not set',
  });
  if (trackSteps && profile.goal_steps_day) {
    const st = goalsEntry?.steps ?? 0;
    const g = profile.goal_steps_day ?? 0;
    mobileGoalRowsUnsorted.push({
      id: 'steps',
      sortOrder: 5,
      title: 'Steps',
      Icon: Footprints,
      pct: stepsPct ?? 0,
      fill: '#ea580c',
      dim: false,
      currentText: st.toLocaleString(),
      goalText: g.toLocaleString(),
    });
  }
  const mobileGoalRows = [...mobileGoalRowsUnsorted].sort((a, b) => a.sortOrder - b.sortOrder);
  const mobileCompositeParts = mobileGoalRows.filter((r) => !r.dim);

  // Streak status helpers
  const loggingStreakAtRisk = !todayEntry && loggingStreak > 0;
  const loggingStreakSafe = !!todayEntry && loggingStreak > 0;
  // Goal crush at risk: streak is active, goals are set, and not all goals met today
  const goalCrushAtRisk = goalCrushStreak > 0 && hasGoals && !allGoalsMet;
  const goalCrushSafe = goalCrushStreak > 0 && allGoalsMet;

  // Weekly progress
  const weeklyWorkoutDays = weeklyEntries.filter(
    e =>
      e.workout_done ||
      e.cardio_done ||
      (Array.isArray(e.workout_types) && e.workout_types.length > 0) ||
      (e.workout_duration != null && e.workout_duration > 0) ||
      (e.cardio_duration != null && e.cardio_duration > 0) ||
      e.cardio_type != null,
  ).length;
  const weeklyWorkoutMins = weeklyEntries.reduce(
    (sum, e) => sum + (e.workout_duration ?? 0) + (e.cardio_duration ?? 0),
    0,
  );

  const hasWeeklyGoals =
    !!(profile.goal_workout_days_week || profile.goal_workout_mins_week);

  const insight = BLUEPRINT_INSIGHTS[getDayOfYear(new Date()) % BLUEPRINT_INSIGHTS.length];

  const mobileStreakChipsForGoals = (
    <>
      {loggingStreakAtRisk ? (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent-red/10 border border-accent-red/20">
          <Flame className="w-3 h-3 text-accent-red" />
          <span className="text-[10px] font-semibold text-accent-red">{loggingStreak}d · log</span>
        </div>
      ) : loggingStreakSafe ? (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent-orange/10 border border-accent-orange/20">
          <Flame className="w-3 h-3 text-accent-orange" />
          <span className="text-[10px] font-semibold text-accent-orange">{loggingStreak}d</span>
          <CheckCircle2 className="w-2.5 h-2.5 text-accent-green" />
        </div>
      ) : loggingStreak === 0 && !todayEntry ? (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-surface-2 border border-surface-3">
          <Flame className="w-3 h-3 text-text-muted" />
          <span className="text-[10px] font-medium text-text-muted">Start streak</span>
        </div>
      ) : null}
      {goalCrushAtRisk ? (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent-superjoin-orange/10 border border-accent-superjoin-orange/20">
          <Zap className="w-3 h-3 text-accent-superjoin-orange" />
          <span className="text-[10px] font-semibold text-accent-superjoin-orange">{goalCrushStreak}d crush</span>
        </div>
      ) : goalCrushSafe ? (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent-gold/10 border border-accent-gold/20">
          <Zap className="w-3 h-3 text-accent-gold" />
          <span className="text-[10px] font-semibold text-accent-gold">{goalCrushStreak}d crush</span>
          <CheckCircle2 className="w-2.5 h-2.5 text-accent-green" />
        </div>
      ) : goalCrushStreak === 0 && allGoalsMet ? (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent-gold/10 border border-accent-gold/20">
          <Zap className="w-3 h-3 text-accent-gold" />
          <span className="text-[10px] font-semibold text-accent-gold">Crush day</span>
        </div>
      ) : null}
    </>
  );

  const desktopStreakChipsForGoals = (
    <>
      {loggingStreakAtRisk ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-red/10 border border-accent-red/20">
          <Flame className="w-3.5 h-3.5 text-accent-red" />
          <span className="text-xs font-semibold text-accent-red">{loggingStreak}d streak · log now!</span>
        </div>
      ) : loggingStreakSafe ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-orange/10 border border-accent-orange/20">
          <Flame className="w-3.5 h-3.5 text-accent-orange" />
          <span className="text-xs font-semibold text-accent-orange">{loggingStreak}d streak</span>
          <CheckCircle2 className="w-3 h-3 text-accent-green" />
        </div>
      ) : loggingStreak === 0 && !todayEntry ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-2 border border-surface-3">
          <Flame className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-xs font-medium text-text-muted">Start a streak today</span>
        </div>
      ) : null}
      {goalCrushAtRisk ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-superjoin-orange/10 border border-accent-superjoin-orange/20">
          <Zap className="w-3.5 h-3.5 text-accent-superjoin-orange" />
          <span className="text-xs font-semibold text-accent-superjoin-orange">{goalCrushStreak}d crush · finish goals!</span>
        </div>
      ) : goalCrushSafe ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-gold/10 border border-accent-gold/20">
          <Zap className="w-3.5 h-3.5 text-accent-gold" />
          <span className="text-xs font-semibold text-accent-gold">{goalCrushStreak}d goal crush</span>
          <CheckCircle2 className="w-3 h-3 text-accent-green" />
        </div>
      ) : goalCrushStreak === 0 && allGoalsMet ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-gold/10 border border-accent-gold/20">
          <Zap className="w-3.5 h-3.5 text-accent-gold" />
          <span className="text-xs font-semibold text-accent-gold">Goal crush day!</span>
        </div>
      ) : null}
    </>
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleLogSuccess = () => {
    setModalType(null);
    onRefresh();
    setRefreshKey(k => k + 1);
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-5" role="status" aria-busy="true" aria-label="Loading dashboard">
        <div className="space-y-3">
          <div className="hidden md:block skeleton-shimmer h-10 w-56 rounded-lg" />
          <div className="skeleton-shimmer h-11 w-full max-w-2xl rounded-xl md:h-32 md:rounded-2xl" />
        </div>
        <div className="skeleton-shimmer h-32 rounded-2xl md:h-72" />
        <div className="skeleton-shimmer h-36 rounded-2xl" />
        <div className="skeleton-shimmer h-40 rounded-2xl" />
        <div className="skeleton-shimmer h-20 rounded-2xl" />
        <div className="hidden md:block skeleton-shimmer h-32 rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5 animate-fade-up">

        {/* ── Greeting + month league (one block so mobile layout doesn’t inherit stray gaps) ── */}
        <div className="space-y-3 md:space-y-4">
          {/* Greeting — desktop only (no “Good morning/evening” on mobile) */}
          <div className="hidden md:block">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-text-primary">
                {greeting}, {firstName}
              </h2>
            </div>
          </div>

          {/* Month league: mobile = slim inline strip; desktop = hero card ───────── */}
          <div>
          {/* Mobile: slim strip — same gradient title as desktop hero + meta · rank · CTA */}
          <div className="md:hidden relative overflow-hidden rounded-xl border border-accent-superjoin-orange/30 bg-surface-1 shadow-md shadow-accent-superjoin-orange/10 px-3 py-2.5">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_100%_-20%,rgba(249,115,22,0.2),transparent_55%),radial-gradient(ellipse_80%_50%_at_0%_100%,rgba(251,191,36,0.07),transparent_50%)]"
              aria-hidden
            />
            <div className="relative flex items-center gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black leading-tight tracking-tight truncate">
                  <span className="bg-gradient-to-r from-accent-superjoin-orange via-amber-500 to-amber-600 bg-clip-text text-transparent">
                    {monthNameLong}
                  </span>
                  <span className="text-text-primary"> league</span>
                  <span className="font-semibold text-text-muted"> · </span>
                  <span className="font-bold tabular-nums text-accent-superjoin-orange">
                    {dayOfMonth}/{daysInMonth}
                  </span>
                  <span className="font-normal text-text-muted"> · </span>
                  <span className="font-semibold text-text-primary">{daysRemainingInMonth}d left</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {monthRank != null ? (
                  <span className="text-sm font-black tabular-nums text-accent-superjoin-orange">#{monthRank}</span>
                ) : (
                  <span className="text-xs font-semibold text-text-muted">—</span>
                )}
                {onOpenLeaderboard && (
                  <button
                    type="button"
                    onClick={onOpenLeaderboard}
                    className="inline-flex items-center gap-0.5 rounded-md border border-white/15 bg-surface-0/40 md:bg-surface-0 px-2 py-1 text-[10px] font-medium text-text-muted transition hover:border-accent-superjoin-orange/30 hover:bg-accent-superjoin-orange/10 hover:text-accent-superjoin-orange active:scale-[0.98]"
                  >
                    League
                    <ArrowRight className="h-2.5 w-2.5 shrink-0" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Desktop: existing hero card */}
          <div className="hidden md:block relative overflow-hidden rounded-2xl border-2 border-accent-superjoin-orange/35 bg-surface-1 shadow-lg shadow-accent-superjoin-orange/15 w-full min-w-0">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_100%_-20%,rgba(249,115,22,0.22),transparent_55%),radial-gradient(ellipse_80%_50%_at_0%_100%,rgba(251,191,36,0.08),transparent_50%)]"
              aria-hidden
            />
            <div className="relative flex flex-row items-center justify-between gap-6 p-5 min-w-0">
              <div className="flex gap-3 min-w-0 flex-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-superjoin-orange/20 border border-accent-superjoin-orange/35 shadow-inner">
                  <Trophy className="h-6 w-6 text-accent-superjoin-orange" aria-hidden />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-superjoin-orange/90">
                    {"This month's league"}
                  </p>
                  <h3 className="text-2xl xl:text-3xl font-black tracking-tight leading-none">
                    <span className="bg-gradient-to-r from-accent-superjoin-orange via-amber-500 to-amber-600 bg-clip-text text-transparent">
                      {monthNameLong}
                    </span>
                    <span className="text-text-primary"> league</span>
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-bold tabular-nums text-accent-superjoin-orange shrink-0">
                      Day {dayOfMonth}/{daysInMonth}
                    </span>
                    <span className="text-text-muted/70 shrink-0">·</span>
                    <span className="font-semibold text-text-primary whitespace-nowrap">
                      {daysRemainingInMonth} {daysRemainingInMonth === 1 ? 'day' : 'days'} left
                    </span>
                  </div>
                  <p className="text-xs text-text-muted whitespace-nowrap">{todayLabel}</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 items-end shrink-0 min-w-[9.5rem] text-right">
                <div className="flex flex-col items-end leading-none">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Your rank</span>
                  {monthRank != null ? (
                    <span className="mt-0.5 text-3xl lg:text-4xl font-black tabular-nums leading-none text-accent-superjoin-orange drop-shadow-sm">
                      #{monthRank}
                    </span>
                  ) : (
                    <span className="mt-0.5 text-lg font-bold text-text-muted">—</span>
                  )}
                </div>
                {onOpenLeaderboard && (
                  <button
                    type="button"
                    onClick={onOpenLeaderboard}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/15 bg-surface-0/30 md:bg-surface-0 px-2.5 py-1.5 text-xs font-medium text-text-muted transition hover:border-accent-superjoin-orange/30 hover:bg-accent-superjoin-orange/10 hover:text-accent-superjoin-orange active:scale-[0.98]"
                  >
                    Leaderboard
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* ── Section 2: Daily Completion Ring ─────────────────────────────────── */}
        <div
          className={`glass-card p-3 md:p-6 transition-colors duration-200 ${
            goalsPeriod === 'yesterday'
              ? 'border-violet-300/40 bg-gradient-to-br from-violet-50/95 via-slate-50/80 to-indigo-50/70 md:from-violet-50 md:via-slate-50 md:to-indigo-50 shadow-md shadow-violet-500/[0.07]'
              : ''
          }`}
        >
          <div className="mb-3 flex flex-col gap-2 md:mb-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <div className="relative min-w-0" ref={goalsPeriodMenuRef}>
                  <button
                    type="button"
                    id="dashboard-goals-period"
                    aria-haspopup="listbox"
                    aria-expanded={goalsPeriodMenuOpen}
                    aria-label="Choose day for goals"
                    onClick={() => setGoalsPeriodMenuOpen((o) => !o)}
                    className={`inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-lg border border-transparent py-0.5 pl-0 pr-1 text-left text-sm font-semibold transition-colors hover:border-white/10 hover:bg-surface-1/50 md:text-base ${
                      goalsPeriod === 'yesterday' ? 'text-violet-950' : 'text-text-primary'
                    }`}
                  >
                    <span className="truncate">
                      {goalsPeriod === 'yesterday' ? "Yesterday's goals" : "Today's Goals"}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 md:h-[1.125rem] md:w-[1.125rem] ${
                        goalsPeriodMenuOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden
                    />
                  </button>
                  {goalsPeriodMenuOpen && (
                    <div
                      role="listbox"
                      aria-labelledby="dashboard-goals-period"
                      className={`absolute left-0 top-[calc(100%+4px)] z-50 min-w-[12.5rem] overflow-hidden rounded-xl border py-1 shadow-lg ${
                        goalsPeriod === 'yesterday'
                          ? 'border-violet-300/40 bg-violet-50/98 md:bg-violet-50 backdrop-blur-sm md:backdrop-blur-none'
                          : 'border-white/15 bg-surface-0/98 md:bg-surface-0 backdrop-blur-sm md:backdrop-blur-none shadow-black/10'
                      }`}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={goalsPeriod === 'today'}
                        onClick={() => {
                          setGoalsPeriod('today');
                          setGoalsPeriodMenuOpen(false);
                        }}
                        className={`flex w-full items-center px-3 py-2.5 text-left text-sm font-semibold md:text-base transition-colors ${
                          goalsPeriod === 'today'
                            ? 'bg-accent-superjoin-orange/12 text-accent-superjoin-orange'
                            : 'text-text-primary hover:bg-surface-2/80'
                        }`}
                      >
                        {"Today's Goals"}
                      </button>
                      <button
                        type="button"
                        role="option"
                        aria-selected={goalsPeriod === 'yesterday'}
                        onClick={() => {
                          setGoalsPeriod('yesterday');
                          setGoalsPeriodMenuOpen(false);
                        }}
                        className={`flex w-full items-center px-3 py-2.5 text-left text-sm font-semibold md:text-base transition-colors ${
                          goalsPeriod === 'yesterday'
                            ? 'bg-violet-200/50 text-violet-950'
                            : 'text-text-primary hover:bg-violet-100/60'
                        }`}
                      >
                        {"Yesterday's goals"}
                      </button>
                    </div>
                  )}
                </div>
                {profile.fitness_goal && (
                  <span
                    className={`text-[10px] md:text-xs font-semibold px-2 py-0.5 md:px-2.5 rounded-full ${
                      FITNESS_GOAL_BADGES[profile.fitness_goal]?.color ?? 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                  >
                    {FITNESS_GOAL_BADGES[profile.fitness_goal]?.label}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              {allGoalsMetForGoalsView && (
                <span className="flex shrink-0 items-center gap-1 text-[10px] md:text-xs font-semibold text-accent-green bg-accent-green/10 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  All goals hit!
                </span>
              )}
              <div className="hidden md:inline-flex rounded-lg border border-white/10 bg-surface-1 p-0.5 shadow-sm" role="group" aria-label="Goals layout">
                <button
                  type="button"
                  aria-label="Box layout"
                  onClick={() => setDesktopGoalsView('box')}
                  className={`inline-flex items-center justify-center rounded-md p-2 transition-colors ${
                    desktopGoalsView === 'box'
                      ? 'bg-accent-superjoin-orange/15 text-accent-superjoin-orange shadow-sm border border-accent-superjoin-orange/25'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Circle progress layout"
                  onClick={() => setDesktopGoalsView('circles')}
                  className={`inline-flex items-center justify-center rounded-md p-2 transition-colors ${
                    desktopGoalsView === 'circles'
                      ? 'bg-accent-superjoin-orange/15 text-accent-superjoin-orange shadow-sm border border-accent-superjoin-orange/25'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <Circle className="h-4 w-4 shrink-0" aria-hidden />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile: box UI + optional bar collapse */}
          <div className="md:hidden">
            <GoalsBoxPanel
              variant="mobile"
              showBarCollapse
              barExpanded={mobileGoalsExpanded}
              onToggleBars={() => setMobileGoalsExpanded((o) => !o)}
              rows={mobileGoalRows}
              compositeParts={mobileCompositeParts}
              overallDailyPct={overallDailyPct}
              streakChips={goalsPeriod === 'yesterday' ? null : mobileStreakChipsForGoals}
              avgCaptionDay={goalsPeriod === 'yesterday' ? 'yesterday' : 'today'}
            />
          </div>

          {/* Desktop: box layout (no show/hide — bars always visible) */}
          <div className={desktopGoalsView === 'box' ? 'hidden md:block' : 'hidden'}>
            <GoalsBoxPanel
              variant="desktop"
              showBarCollapse={false}
              barExpanded
              onToggleBars={() => {}}
              rows={mobileGoalRows}
              compositeParts={mobileCompositeParts}
              overallDailyPct={overallDailyPct}
              streakChips={goalsPeriod === 'yesterday' ? null : desktopStreakChipsForGoals}
              avgCaptionDay={goalsPeriod === 'yesterday' ? 'yesterday' : 'today'}
            />
          </div>

          <div
            className={`hidden flex-col items-center gap-6 ${desktopGoalsView === 'circles' ? 'md:flex' : 'md:hidden'}`}
          >
            {/* Big overall ring */}
            <div className="relative">
              <CircleRing
                pct={overallDailyPct}
                size={164}
                strokeWidth={16}
                color={ringColor(overallDailyPct)}
                trackColor="#e2e8f0"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-semibold text-text-primary leading-none tabular-nums">
                  {overallDailyPct}%
                </span>
                <span className="text-xs font-medium text-text-muted mt-1">
                  {goalsPeriod === 'yesterday' ? 'that day' : 'complete'}
                </span>
              </div>
            </div>

            {/* Streak status row (today only — streaks are current, not historical) */}
            {goalsPeriod !== 'yesterday' && (
              <div className="flex items-center justify-center gap-2.5 w-full flex-wrap">{desktopStreakChipsForGoals}</div>
            )}

            {/* Category mini rings */}
            <div className={`grid gap-3 w-full ${goalRingsGridClass}`}>
              {/* Protein ring (when tracking + goal set) */}
              {showProteinFoodGoal && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="relative">
                    <CircleRing
                      pct={proteinPct ?? 0}
                      size={ringSizeFoodGoals}
                      strokeWidth={strokeFoodGoals}
                      color="#f59e0b"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Utensils className="w-4 h-4 text-text-muted" />
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-text-secondary">Protein</span>
                  <span className="text-[11px] font-semibold text-text-primary tabular-nums">{proteinPct ?? 0}%</span>
                  <span className="text-[10px] leading-tight text-center tabular-nums">
                    <span className="font-semibold text-text-primary">
                      {(goalsEntry as DailyEntry & { protein_qty?: number | null })?.protein_qty ?? 0}g
                    </span>
                    <span className="font-normal text-text-muted"> / </span>
                    <span className="font-normal text-text-muted">{profile.goal_protein_g_day}g</span>
                  </span>
                </div>
              )}

              {/* Calories ring (when tracking + goal set) */}
              {showCalorieFoodGoal && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="relative">
                    <CircleRing
                      pct={caloriePct ?? 0}
                      size={ringSizeFoodGoals}
                      strokeWidth={strokeFoodGoals}
                      color="#ea580c"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Utensils className="w-4 h-4 text-text-muted" />
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-text-secondary">Calories</span>
                  <span className="text-[11px] font-semibold text-text-primary tabular-nums">{caloriePct ?? 0}%</span>
                  <span className="text-[10px] leading-tight text-center tabular-nums">
                    <span className="font-semibold text-text-primary">
                      {(goalsEntry as DailyEntry & { calories_kcal?: number | null })?.calories_kcal ?? 0} kcal
                    </span>
                    <span className="font-normal text-text-muted"> / </span>
                    <span className="font-normal text-text-muted">
                      {(profile.goal_calories_day ?? 0).toLocaleString()} kcal
                    </span>
                  </span>
                </div>
              )}

              {/* Food placeholder when neither macro goal is set */}
              {!showProteinFoodGoal && !showCalorieFoodGoal && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="relative opacity-30">
                    <svg width={ringSizeFoodGoals} height={ringSizeFoodGoals} viewBox="0 0 60 60">
                      <circle cx={30} cy={30} r={26.5} fill="none" stroke="#e2e8f0" strokeWidth={7} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Utensils className="w-4 h-4 text-text-muted" />
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-text-secondary">Food</span>
                  <span className="text-[11px] text-text-muted">–</span>
                </div>
              )}

              {/* Water */}
              <div className="flex flex-col items-center gap-1.5">
                <div className={`relative ${!profile.goal_water_liters ? 'opacity-30' : ''}`}>
                  {profile.goal_water_liters ? (
                    <CircleRing pct={waterPct} size={ringSizeFoodGoals} strokeWidth={strokeFoodGoals} color="#2563eb" />
                  ) : (
                    <svg width={ringSizeFoodGoals} height={ringSizeFoodGoals} viewBox="0 0 60 60">
                      <circle cx={30} cy={30} r={26.5} fill="none" stroke="#e2e8f0" strokeWidth={7} />
                    </svg>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Droplets className="w-4 h-4 text-text-muted" />
                  </div>
                </div>
                <span className="text-[11px] font-medium text-text-secondary">Water</span>
                {profile.goal_water_liters ? (
                  <>
                    <span className="text-[11px] font-semibold text-text-primary tabular-nums">{waterPct}%</span>
                    <span className="text-[10px] leading-tight text-center tabular-nums">
                      <span className="font-semibold text-text-primary">
                        {(goalsEntry?.water_liters ?? 0).toFixed(1)}
                      </span>
                      <span className="font-normal text-text-muted"> / </span>
                      <span className="font-normal text-text-muted">{profile.goal_water_liters}L</span>
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-text-muted">–</span>
                )}
              </div>

              {/* Sleep */}
              <div className="flex flex-col items-center gap-1.5">
                <div className={`relative ${!sleepGoal ? 'opacity-30' : ''}`}>
                  {sleepGoal ? (
                    <CircleRing pct={sleepPct} size={ringSizeFoodGoals} strokeWidth={strokeFoodGoals} color="#7c3aed" />
                  ) : (
                    <svg width={ringSizeFoodGoals} height={ringSizeFoodGoals} viewBox="0 0 60 60">
                      <circle cx={30} cy={30} r={26.5} fill="none" stroke="#e2e8f0" strokeWidth={7} />
                    </svg>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Moon className="w-4 h-4 text-text-muted" />
                  </div>
                </div>
                <span className="text-[11px] font-medium text-text-secondary">Sleep</span>
                {sleepGoal ? (
                  <>
                    <span className="text-[11px] font-semibold text-text-primary tabular-nums">{sleepPct}%</span>
                    <span className="text-[10px] leading-tight text-center tabular-nums">
                      <span className="font-semibold text-text-primary">{(goalsEntry?.sleep_hours ?? 0)}h</span>
                      <span className="font-normal text-text-muted"> / </span>
                      <span className="font-normal text-text-muted">{sleepGoal}h</span>
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-text-muted">–</span>
                )}
              </div>

              {/* Workout */}
              <div className="flex flex-col items-center gap-1.5">
                <div className={`relative ${!profile.goal_workout_days_week ? 'opacity-30' : ''}`}>
                  {profile.goal_workout_days_week ? (
                    <CircleRing pct={workoutPct} size={ringSizeFoodGoals} strokeWidth={strokeFoodGoals} color="#FF6B35" />
                  ) : (
                    <svg width={ringSizeFoodGoals} height={ringSizeFoodGoals} viewBox="0 0 60 60">
                      <circle cx={30} cy={30} r={26.5} fill="none" stroke="#e2e8f0" strokeWidth={7} />
                    </svg>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Dumbbell className="w-4 h-4 text-text-muted" />
                  </div>
                </div>
                <span className="text-[11px] font-medium text-text-secondary">Workout</span>
                {profile.goal_workout_days_week ? (
                  <>
                    <span className="text-[11px] font-semibold text-text-primary tabular-nums">
                      {workoutDone ? '100%' : '0%'}
                    </span>
                    <span className="text-[10px] leading-tight text-center">
                      <span className="font-semibold text-text-primary">{workoutDone ? '1' : '0'}</span>
                      <span className="font-normal text-text-muted"> / </span>
                      <span className="font-normal text-text-muted">
                        {goalsPeriod === 'yesterday' ? '1 session' : '1 today'}
                      </span>
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-text-muted">–</span>
                )}
              </div>

              {/* Steps — only shown when goal_steps_day is set */}
              {trackSteps && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="relative">
                    <CircleRing pct={stepsPct ?? 0} size={52} strokeWidth={6} color="#f59e0b" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Footprints className="w-3.5 h-3.5 text-text-muted" />
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-text-secondary">Steps</span>
                  <span className="text-[11px] font-semibold text-text-primary tabular-nums">{stepsPct ?? 0}%</span>
                  <span className="text-[10px] leading-tight text-center tabular-nums">
                    <span className="font-semibold text-text-primary">
                      {(goalsEntry?.steps ?? 0).toLocaleString()}
                    </span>
                    <span className="font-normal text-text-muted"> / </span>
                    <span className="font-normal text-text-muted">
                      {(profile.goal_steps_day ?? 0).toLocaleString()}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 3: Remaining Today ───────────────────────────────────────── */}
        {hasGoals && (
          <div className="glass-card p-5">
            <h3 className="font-semibold text-text-primary flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-accent-gold" />
              {allGoalsMet ? 'All done for today' : 'Remaining today'}
            </h3>
            {allGoalsMet ? (
              <p className="text-sm text-text-secondary">
                {
                  "You've completed all your daily goals. Great work — rest up and do it again tomorrow."
                }
              </p>
            ) : (
              <ul className="space-y-2.5">
                {remainingItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 py-0.5">
                    <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center shrink-0">
                      {item.icon}
                    </div>
                    <span className="text-sm text-text-secondary flex-1 min-w-0 leading-snug">{item.text}</span>
                    <button
                      type="button"
                      onClick={() => setModalType(item.modalType)}
                      className="shrink-0 inline-flex h-8 min-w-[5.25rem] items-center justify-center rounded-xl border border-accent-superjoin-orange/35 bg-transparent px-5 text-sm font-medium text-accent-superjoin-orange transition-colors hover:border-accent-superjoin-orange/55 hover:bg-accent-superjoin-orange/[0.08] active:scale-[0.98] touch-manipulation"
                    >
                      Log
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Section 4: This Week ─────────────────────────────────────────────── */}
        <div className="glass-card p-5">
          <h3 className="font-semibold text-text-primary flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-text-muted" />
            This week
          </h3>
          <div className="space-y-4">
            {/* Points + rank row */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">
                <span className="font-semibold text-text-primary">{weeklyPoints}</span> pts this week
              </span>
              {rank != null && (
                <span className="text-xs font-semibold text-accent-superjoin-orange bg-accent-superjoin-orange/10 px-2.5 py-0.5 rounded-full">
                  Rank #{rank}
                </span>
              )}
            </div>

            {/* Workout days */}
            {profile.goal_workout_days_week ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-text-secondary">Workout days</span>
                  <span className="text-xs font-semibold text-text-muted">
                    {weeklyWorkoutDays}/{profile.goal_workout_days_week}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min((weeklyWorkoutDays / profile.goal_workout_days_week) * 100, 100)}%`,
                      backgroundColor: '#FF6B35',
                    }}
                  />
                </div>
              </div>
            ) : null}

            {/* Workout minutes */}
            {profile.goal_workout_mins_week ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-text-secondary">Workout minutes</span>
                  <span className="text-xs font-semibold text-text-muted">
                    {weeklyWorkoutMins}/{profile.goal_workout_mins_week} min
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-green transition-all duration-700"
                    style={{
                      width: `${Math.min((weeklyWorkoutMins / profile.goal_workout_mins_week) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            {!hasWeeklyGoals && (
              <p className="text-sm text-text-muted">
                Set your weekly goals in{' '}
                <span className="font-medium text-text-secondary">Profile &amp; Goals</span> to track progress here.
              </p>
            )}
          </div>
        </div>

        {/* ── Rank Trajectory (monthly league) — desktop/tablet only; saves mobile scroll ── */}
        {monthRank != null && (
          <div className="hidden md:block">
            <div className="glass-card p-5">
              <h3 className="font-semibold text-text-primary flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-accent-superjoin-orange" />
                Rank Trajectory
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-accent-superjoin-orange/10 border border-accent-superjoin-orange/20 flex items-center justify-center shrink-0">
                  <span className="text-lg font-bold text-accent-superjoin-orange">#{monthRank}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {monthRank === 1 ? (
                    <p className="text-sm font-medium text-text-primary">{"You're at the top!"}</p>
                  ) : (
                    <p className="text-sm text-text-secondary">
                      <span className="font-semibold text-text-primary">Rank #{monthRank}</span> this month
                    </p>
                  )}
                  <p className="text-xs text-text-muted mt-0.5">
                    {monthlyPoints} pts · {profile.fitness_goal ? FITNESS_GOAL_BADGES[profile.fitness_goal]?.label : 'No goal set'}
                  </p>
                </div>
              </div>
              {!hasGoals && (
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Set daily goals in Profile &amp; Goals to get personalized rank-up guidance.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Section 5: Streak tiles ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Logging Streak */}
          <div className="glass-card p-4 flex flex-col items-center text-center gap-1">
            <Flame className="w-4 h-4 text-accent-orange mb-0.5" />
            <p className="text-xl font-bold text-text-primary">{loggingStreak}</p>
            <p className="text-[11px] text-text-muted leading-tight">Log streak</p>
            <p className="text-[10px] text-text-muted leading-tight opacity-70">days</p>
          </div>

          {/* This Week — shows weekly goal hit status if goals are set, otherwise days logged */}
          <div className="glass-card p-4 flex flex-col items-center text-center gap-1">
            <TrendingUp className="w-4 h-4 text-accent-green mb-0.5" />
            {hasWeeklyGoals ? (
              <>
                <p className={`text-xl font-bold leading-none ${
                  weeklyGoalsHit === 'full'
                    ? 'text-accent-green'
                    : weeklyGoalsHit === 'partial'
                      ? 'text-accent-superjoin-orange'
                      : 'text-text-muted'
                }`}>
                  {weeklyGoalsHit === 'full' ? '✓' : weekLogDays}
                </p>
                <p className="text-[11px] text-text-muted leading-tight">This week</p>
                <p className="text-[10px] leading-tight opacity-70 truncate w-full text-center">
                  {weeklyGoalsHit === 'full'
                    ? 'All goals hit'
                    : weeklyGoalsHit === 'partial'
                      ? 'In progress'
                      : `${weekLogDays}/7 days`}
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-text-primary">{weekLogDays}<span className="text-sm font-normal text-text-muted">/7</span></p>
                <p className="text-[11px] text-text-muted leading-tight">This week</p>
                <p className="text-[10px] text-text-muted leading-tight opacity-70">days logged</p>
              </>
            )}
          </div>

          {/* Goal Crush Streak */}
          <div className={`glass-card p-4 flex flex-col items-center text-center gap-1 ${goalCrushStreak === 0 ? 'opacity-60' : ''}`}>
            <Zap className={`w-4 h-4 mb-0.5 ${goalCrushStreak > 0 ? 'text-accent-gold' : 'text-text-muted'}`} />
            <p className={`text-xl font-bold ${goalCrushStreak > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
              {goalCrushStreak}
            </p>
            <p className="text-[11px] text-text-muted leading-tight">Goal crush</p>
            <p className="text-[10px] text-text-muted leading-tight opacity-70">days</p>
          </div>
        </div>

        {/* ── Section 6: Blueprint insight — md+ only (hidden on mobile) ───────── */}
        <div className="hidden md:block">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${INSIGHT_BADGE[insight.categoryColor]}`}>
                {insight.category}
              </span>
              <span className="text-xs text-text-muted">Blueprint · Bryan Johnson</span>
            </div>
            <p className="text-sm text-text-primary font-medium leading-relaxed">
              &ldquo;{insight.text}&rdquo;
            </p>
            <div className="flex items-start gap-2 mt-4 pt-3 border-t border-surface-3">
              <ArrowRight className="w-3.5 h-3.5 text-accent-superjoin-orange mt-0.5 flex-shrink-0" />
              <p className="text-xs text-text-secondary">{insight.action}</p>
            </div>
          </div>
        </div>

      </div>

      {/* ── Entry modal ──────────────────────────────────────────────────────────── */}
      {modalType && (
        <LogEntryModal
          entryType={modalType}
          profile={profile}
          onClose={() => setModalType(null)}
          onSuccess={handleLogSuccess}
        />
      )}
    </>
  );
}
