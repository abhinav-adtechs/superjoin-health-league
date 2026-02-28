'use client';

import { useState, useEffect } from 'react';
import {
  Flame,
  Target,
  TrendingUp,
  Dumbbell,
  Droplets,
  Moon,
  Activity,
  Plus,
  CheckCircle2,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import { LogEntryModal, type EntryType } from './LogEntryModal';
import type { Profile, DailyEntry } from '@/lib/types';

// ── Blueprint Insights ─────────────────────────────────────────────────────────
// Specific, actionable directives from Bryan Johnson's Blueprint protocol.
// Rotates daily — not vague motivation.
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

function getMondayOfWeek(d: Date): string {
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return getLocalDateStr(monday);
}

function clampPct(value: number | null | undefined, goal: number | null | undefined): number {
  if (!goal || goal <= 0 || value == null) return 0;
  return Math.min(Math.round((value / goal) * 100), 100);
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
  const offset = circ * (1 - Math.min(Math.max(pct, 0), 100) / 100);
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

// ── Insight badge colors ───────────────────────────────────────────────────────

const INSIGHT_BADGE: Record<InsightColor, string> = {
  blue: 'bg-accent-blue/10 text-accent-blue',
  green: 'bg-accent-green/10 text-accent-green',
  orange: 'bg-accent-superjoin-orange/10 text-accent-superjoin-orange',
  red: 'bg-accent-red/10 text-accent-red',
};

// ── Main Component ─────────────────────────────────────────────────────────────

export function DashboardTab({
  profile,
  onRefresh,
  refreshTrigger = 0,
}: {
  profile: Profile;
  onRefresh: () => void;
  refreshTrigger?: number;
}) {
  const [todayEntry, setTodayEntry] = useState<DailyEntry | null>(null);
  const [weeklyEntries, setWeeklyEntries] = useState<DailyEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [weeklyPoints, setWeeklyPoints] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<EntryType | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Data loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const today = getLocalDateStr(new Date());
      const monday = getMondayOfWeek(new Date());
      const [entryRes, weeklyRes, streakRes, lbRes] = await Promise.all([
        fetch(apiUrl(`/api/entries?date=${today}`), getApiFetchOptions()),
        fetch(apiUrl(`/api/entries/history?from=${monday}&to=${today}`), getApiFetchOptions()),
        fetch(apiUrl('/api/streaks/me'), getApiFetchOptions()),
        fetch(apiUrl('/api/leaderboard?view=weekly'), getApiFetchOptions()),
      ]);
      if (cancelled) return;
      const [entryData, weeklyData, streakData, lbData] = await Promise.all([
        entryRes.json().catch(() => null),
        weeklyRes.json().catch(() => []),
        streakRes.json().catch(() => ({})),
        lbRes.json().catch(() => ({})),
      ]);
      setTodayEntry(entryData?.id ? (entryData as DailyEntry) : null);
      setWeeklyEntries(Array.isArray(weeklyData) ? (weeklyData as DailyEntry[]) : []);
      setStreak(streakData.current_streak_days ?? 0);
      const myEntry = lbData.rankings?.find(
        (r: { user: { display_name: string }; rank: number; score: { total_points: number } }) =>
          r.user.display_name === profile.display_name,
      );
      setRank(myEntry?.rank ?? null);
      setWeeklyPoints(myEntry?.score?.total_points ?? 0);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [profile.display_name, refreshKey, refreshTrigger]);

  // ── Computed values ───────────────────────────────────────────────────────────

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile.display_name.split(' ')[0];
  const daysActive = Math.max(
    1,
    Math.floor((Date.now() - new Date(profile.joined_at).getTime()) / (1000 * 60 * 60 * 24)),
  );
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Daily goal percentages
  const stepsPct = clampPct(todayEntry?.steps, profile.goal_steps_day);
  const waterPct = clampPct(todayEntry?.water_liters, profile.goal_water_liters);
  const sleepGoal = profile.goal_sleep_hours ?? profile.goal_sleep_hours_max;
  const sleepPct = clampPct(todayEntry?.sleep_hours, sleepGoal);
  const workoutDone = !!(todayEntry?.workout_done || todayEntry?.cardio_done);
  const workoutPct = workoutDone ? 100 : 0;

  // Overall daily completion: average of all goals that are set
  const activeDailyPcts: number[] = [];
  if (profile.goal_steps_day) activeDailyPcts.push(stepsPct);
  if (profile.goal_water_liters) activeDailyPcts.push(waterPct);
  if (sleepGoal) activeDailyPcts.push(sleepPct);
  if (profile.goal_workout_days_week) activeDailyPcts.push(workoutPct);

  const overallDailyPct =
    activeDailyPcts.length > 0
      ? Math.round(activeDailyPcts.reduce((a, b) => a + b, 0) / activeDailyPcts.length)
      : todayEntry
        ? Math.min(Math.round((todayEntry.daily_points / 98) * 100), 100)
        : 0;

  const hasGoals = activeDailyPcts.length > 0;

  // Remaining today
  type RemainingItem = { icon: JSX.Element; text: string; modalType: EntryType };
  const remainingItems: RemainingItem[] = [];

  if (profile.goal_steps_day && (todayEntry?.steps ?? 0) < profile.goal_steps_day) {
    const rem = profile.goal_steps_day - (todayEntry?.steps ?? 0);
    remainingItems.push({
      icon: <Activity className="w-4 h-4 text-accent-green" />,
      text: `Walk ${rem.toLocaleString()} more steps`,
      modalType: 'movement',
    });
  }
  if (profile.goal_water_liters && (todayEntry?.water_liters ?? 0) < profile.goal_water_liters) {
    const rem = (profile.goal_water_liters - (todayEntry?.water_liters ?? 0)).toFixed(1);
    remainingItems.push({
      icon: <Droplets className="w-4 h-4 text-accent-blue" />,
      text: `Drink ${rem} L more water`,
      modalType: 'meal_recovery',
    });
  }
  if (sleepGoal && !todayEntry?.sleep_hours) {
    remainingItems.push({
      icon: <Moon className="w-4 h-4 text-accent-purple" />,
      text: "Log last night's sleep",
      modalType: 'sleep',
    });
  }
  if (profile.goal_workout_days_week && !workoutDone) {
    remainingItems.push({
      icon: <Dumbbell className="w-4 h-4 text-accent-superjoin-orange" />,
      text: "Log today's workout",
      modalType: 'movement',
    });
  }

  const allGoalsMet = hasGoals && remainingItems.length === 0;

  // Weekly progress
  // workout_done is only set when duration > 0 in the modal; also check workout_types
  // and cardio signals so days aren't undercounted
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
  const weeklyHomeCookedMeals = weeklyEntries.reduce(
    (sum, e) => sum + (e.home_cooked_meals ?? 0),
    0,
  );

  const hasWeeklyGoals =
    !!(profile.goal_workout_days_week || profile.goal_workout_mins_week || profile.goal_home_cooked_per_week);

  // Blueprint insight of the day
  const insight = BLUEPRINT_INSIGHTS[getDayOfYear(new Date()) % BLUEPRINT_INSIGHTS.length];

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleLogSuccess = () => {
    setModalType(null);
    onRefresh();
    setRefreshKey(k => k + 1);
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-10 w-56 rounded-lg bg-surface-2" />
        <div className="h-72 rounded-2xl bg-surface-2" />
        <div className="h-36 rounded-2xl bg-surface-2" />
        <div className="h-40 rounded-2xl bg-surface-2" />
        <div className="h-20 rounded-2xl bg-surface-2" />
        <div className="h-32 rounded-2xl bg-surface-2" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5 animate-fade-up">

        {/* ── Section 1: Greeting ──────────────────────────────────────────────── */}
        <div>
          <h2 className="text-2xl font-bold text-text-primary">
            {greeting}, {firstName}
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            {todayLabel} · Day {daysActive} in the league
          </p>
        </div>

        {/* ── Section 2: Daily Completion Ring + CTA ───────────────────────────── */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-text-primary">Today&apos;s Goals</h3>
            {allGoalsMet && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-green bg-accent-green/10 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                All goals hit!
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-6">
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
                <span className="text-3xl font-bold text-text-primary leading-none">
                  {overallDailyPct}%
                </span>
                <span className="text-xs text-text-muted mt-1">complete</span>
              </div>
            </div>

            {/* Category mini rings */}
            <div className="grid grid-cols-4 gap-3 w-full max-w-xs">
              {/* Steps */}
              <div className="flex flex-col items-center gap-1.5">
                <div className={`relative ${!profile.goal_steps_day ? 'opacity-30' : ''}`}>
                  {profile.goal_steps_day ? (
                    <CircleRing pct={stepsPct} size={60} strokeWidth={7} color="#059669" />
                  ) : (
                    <svg width={60} height={60} viewBox="0 0 60 60">
                      <circle cx={30} cy={30} r={26.5} fill="none" stroke="#e2e8f0" strokeWidth={7} />
                    </svg>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-text-muted" />
                  </div>
                </div>
                <span className="text-[11px] font-medium text-text-secondary">Steps</span>
                <span className="text-[11px] text-text-muted">
                  {profile.goal_steps_day ? `${stepsPct}%` : '–'}
                </span>
              </div>

              {/* Water */}
              <div className="flex flex-col items-center gap-1.5">
                <div className={`relative ${!profile.goal_water_liters ? 'opacity-30' : ''}`}>
                  {profile.goal_water_liters ? (
                    <CircleRing pct={waterPct} size={60} strokeWidth={7} color="#2563eb" />
                  ) : (
                    <svg width={60} height={60} viewBox="0 0 60 60">
                      <circle cx={30} cy={30} r={26.5} fill="none" stroke="#e2e8f0" strokeWidth={7} />
                    </svg>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Droplets className="w-4 h-4 text-text-muted" />
                  </div>
                </div>
                <span className="text-[11px] font-medium text-text-secondary">Water</span>
                <span className="text-[11px] text-text-muted">
                  {profile.goal_water_liters ? `${waterPct}%` : '–'}
                </span>
              </div>

              {/* Sleep */}
              <div className="flex flex-col items-center gap-1.5">
                <div className={`relative ${!sleepGoal ? 'opacity-30' : ''}`}>
                  {sleepGoal ? (
                    <CircleRing pct={sleepPct} size={60} strokeWidth={7} color="#7c3aed" />
                  ) : (
                    <svg width={60} height={60} viewBox="0 0 60 60">
                      <circle cx={30} cy={30} r={26.5} fill="none" stroke="#e2e8f0" strokeWidth={7} />
                    </svg>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Moon className="w-4 h-4 text-text-muted" />
                  </div>
                </div>
                <span className="text-[11px] font-medium text-text-secondary">Sleep</span>
                <span className="text-[11px] text-text-muted">
                  {sleepGoal ? `${sleepPct}%` : '–'}
                </span>
              </div>

              {/* Workout */}
              <div className="flex flex-col items-center gap-1.5">
                <div className={`relative ${!profile.goal_workout_days_week ? 'opacity-30' : ''}`}>
                  {profile.goal_workout_days_week ? (
                    <CircleRing pct={workoutPct} size={60} strokeWidth={7} color="#FF6B35" />
                  ) : (
                    <svg width={60} height={60} viewBox="0 0 60 60">
                      <circle cx={30} cy={30} r={26.5} fill="none" stroke="#e2e8f0" strokeWidth={7} />
                    </svg>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Dumbbell className="w-4 h-4 text-text-muted" />
                  </div>
                </div>
                <span className="text-[11px] font-medium text-text-secondary">Workout</span>
                <span className="text-[11px] text-text-muted">
                  {profile.goal_workout_days_week ? (workoutDone ? 'Done' : '0%') : '–'}
                </span>
              </div>
            </div>
          </div>

          {/* Inline log CTA */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setModalType('full')}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-accent-superjoin-orange hover:bg-primary-orange-dark active:scale-[0.98] transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              {todayEntry ? "Update Today's Entry" : "Start Today's Log"}
            </button>
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
                You&apos;ve completed all your daily goals. Great work — rest up and do it again tomorrow.
              </p>
            ) : (
              <ul className="space-y-3">
                {remainingItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <span className="text-sm text-text-secondary flex-1">{item.text}</span>
                    <button
                      type="button"
                      onClick={() => setModalType(item.modalType)}
                      className="text-xs font-semibold text-accent-superjoin-orange hover:underline flex-shrink-0 transition-opacity"
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

            {/* Home-cooked meals */}
            {profile.goal_home_cooked_per_week ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-text-secondary">Home-cooked meals</span>
                  <span className="text-xs font-semibold text-text-muted">
                    {weeklyHomeCookedMeals}/{profile.goal_home_cooked_per_week}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-blue transition-all duration-700"
                    style={{
                      width: `${Math.min((weeklyHomeCookedMeals / profile.goal_home_cooked_per_week) * 100, 100)}%`,
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

        {/* ── Section 5: Stat chips ────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-4 flex flex-col items-center text-center gap-1">
            <Target className="w-4 h-4 text-text-muted mb-0.5" />
            <p className="text-xl font-bold text-text-primary">{todayEntry?.daily_points ?? 0}</p>
            <p className="text-[11px] text-text-muted leading-tight">Today&apos;s pts</p>
          </div>
          <div className="glass-card p-4 flex flex-col items-center text-center gap-1">
            <Flame className="w-4 h-4 text-accent-orange mb-0.5" />
            <p className="text-xl font-bold text-text-primary">{streak}</p>
            <p className="text-[11px] text-text-muted leading-tight">Day streak</p>
          </div>
          <div className="glass-card p-4 flex flex-col items-center text-center gap-1">
            <TrendingUp className="w-4 h-4 text-accent-green mb-0.5" />
            <p className="text-xl font-bold text-text-primary">{rank != null ? `#${rank}` : '—'}</p>
            <p className="text-[11px] text-text-muted leading-tight">This week</p>
          </div>
        </div>

        {/* ── Section 6: Blueprint Insight of the Day ──────────────────────────── */}
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
