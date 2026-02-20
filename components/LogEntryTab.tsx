'use client';

import { useState, useEffect, useMemo } from 'react';
import { Activity, Target, Trophy } from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import { CalendarHistogram } from './CalendarHistogram';
import type { Profile } from '@/lib/types';

type ProjectionResponse = {
  rank: number;
  is_first: boolean;
  days_to_first: number | null;
  expected_daily_points: number;
  message?: string;
};

type EntryRow = {
  date: string;
  workout_done?: boolean | null;
  workout_duration?: number | null;
  workout_types?: string[] | null;
  cardio_done?: boolean | null;
  cardio_duration?: number | null;
  cardio_type?: string | null;
  steps?: number | null;
  sleep_hours?: number | null;
};

function hasWorkout(e: EntryRow): boolean {
  return e.workout_done === true || e.cardio_done === true || (e.steps != null && Number(e.steps) > 0);
}

function workoutMins(e: EntryRow): number {
  const w = (e.workout_done && e.workout_duration) ? e.workout_duration : 0;
  const c = (e.cardio_done && e.cardio_duration) ? e.cardio_duration : 0;
  return w + c;
}

function label(s: string): string {
  return s.replace(/_/g, ' ');
}

const COLOR_WORKOUT = '#FF6B35';
const COLOR_CARDIO = '#0d9488';
const COLOR_STEPS = '#2563eb';

function entryType(e: EntryRow): 'workout' | 'cardio' | 'steps' {
  if (e.workout_done === true) return 'workout';
  if (e.cardio_done === true) return 'cardio';
  return 'steps';
}

function entryBorderColor(e: EntryRow): string {
  return entryType(e) === 'workout' ? COLOR_WORKOUT : entryType(e) === 'cardio' ? COLOR_CARDIO : COLOR_STEPS;
}

function getThisWeekRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function getThisMonthRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function LogEntryTab({ profile, onSuccess, refreshTrigger = 0 }: { profile: Profile; onSuccess: () => void; refreshTrigger?: number }) {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState<ProjectionResponse | null>(null);

  const workoutEntries = useMemo(
    () => [...entries].filter(hasWorkout).sort((a, b) => b.date.localeCompare(a.date)),
    [entries]
  );

  useEffect(() => {
    let cancelled = false;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 60);
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);
    fetch(apiUrl(`/api/entries/history?from=${from}&to=${to}`), getApiFetchOptions())
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        if (!cancelled) setEntries(list);
      })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/api/leaderboard/projection'), getApiFetchOptions())
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setProjection(data); })
      .catch(() => { if (!cancelled) setProjection(null); });
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const { week: weekRange, month: monthRange } = useMemo(() => ({
    week: getThisWeekRange(),
    month: getThisMonthRange(),
  }), []);

  const goalProgress = useMemo(() => {
    const weekEntries = entries.filter((e) => e.date >= weekRange.from && e.date <= weekRange.to);
    const monthEntries = entries.filter((e) => e.date >= monthRange.from && e.date <= monthRange.to);
    const goalWkMins = profile.goal_workout_mins_week ?? 0;
    const goalWkDays = profile.goal_workout_days_week ?? 0;
    const dailyMinsTarget = goalWkMins > 0 ? goalWkMins / 7 : 0;
    const goalSteps = profile.goal_steps_day ?? 0;
    const goalSleep = profile.goal_sleep_hours ?? profile.goal_sleep_hours_min ?? null;

    const workoutMetWeek = goalWkDays > 0
      ? weekEntries.filter((e) => e.workout_done === true || e.cardio_done === true).length
      : goalWkMins > 0
        ? weekEntries.filter((e) => workoutMins(e) >= dailyMinsTarget).length
        : 0;
    const workoutMetMonth = goalWkDays > 0
      ? monthEntries.filter((e) => e.workout_done === true || e.cardio_done === true).length
      : goalWkMins > 0
        ? monthEntries.filter((e) => workoutMins(e) >= dailyMinsTarget).length
        : 0;
    const stepsMetWeek = goalSteps > 0 ? weekEntries.filter((e) => (e.steps ?? 0) >= goalSteps).length : 0;
    const stepsMetMonth = goalSteps > 0 ? monthEntries.filter((e) => (e.steps ?? 0) >= goalSteps).length : 0;
    const sleepMetWeek = goalSleep != null
      ? weekEntries.filter((e) => e.sleep_hours != null && Math.abs(e.sleep_hours - goalSleep) <= 0.5).length
      : 0;
    const sleepMetMonth = goalSleep != null
      ? monthEntries.filter((e) => e.sleep_hours != null && Math.abs(e.sleep_hours - goalSleep) <= 0.5).length
      : 0;

    const weekDays = 7;
    const monthDays = Math.ceil((new Date(monthRange.to).getTime() - new Date(monthRange.from).getTime()) / (24 * 60 * 60 * 1000)) + 1;

    return {
      workout: { week: { met: workoutMetWeek, total: weekDays }, month: { met: workoutMetMonth, total: monthDays }, hasGoal: goalWkMins > 0 || goalWkDays > 0 },
      steps: { week: { met: stepsMetWeek, total: weekDays }, month: { met: stepsMetMonth, total: monthDays }, hasGoal: goalSteps > 0 },
      sleep: { week: { met: sleepMetWeek, total: weekDays }, month: { met: sleepMetMonth, total: monthDays }, hasGoal: goalSleep != null },
    };
  }, [entries, profile, weekRange, monthRange]);

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Workout history</h2>
        <p className="text-sm text-text-secondary">
          Calendar shows <strong>Workout</strong>, <strong>Food</strong>, and <strong>Sleep</strong> — the three pillars. Use <strong>New Entry</strong> in the header to log.
        </p>
      </div>

      <div className="glass-card p-5">
        <CalendarHistogram refreshTrigger={refreshTrigger} goals={profile} />
      </div>

      {(goalProgress.workout.hasGoal || goalProgress.steps.hasGoal || goalProgress.sleep.hasGoal) && (
        <div className="glass-card p-5">
          <h3 className="font-medium text-text-primary flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-accent-blue" />
            Goal progress
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            {goalProgress.workout.hasGoal && (
              <div>
                <div className="text-text-muted font-medium mb-1">Workout</div>
                <p className="text-text-primary">This week: goal met on <strong>{goalProgress.workout.week.met}</strong> of {goalProgress.workout.week.total} days</p>
                <p className="text-text-secondary text-xs mt-0.5">This month: goal met on <strong>{goalProgress.workout.month.met}</strong> of {goalProgress.workout.month.total} days</p>
              </div>
            )}
            {goalProgress.steps.hasGoal && (
              <div>
                <div className="text-text-muted font-medium mb-1">Steps</div>
                <p className="text-text-primary">This week: goal met on <strong>{goalProgress.steps.week.met}</strong> of {goalProgress.steps.week.total} days</p>
                <p className="text-text-secondary text-xs mt-0.5">This month: goal met on <strong>{goalProgress.steps.month.met}</strong> of {goalProgress.steps.month.total} days</p>
              </div>
            )}
            {goalProgress.sleep.hasGoal && (
              <div>
                <div className="text-text-muted font-medium mb-1">Sleep</div>
                <p className="text-text-primary">This week: goal met on <strong>{goalProgress.sleep.week.met}</strong> of {goalProgress.sleep.week.total} days</p>
                <p className="text-text-secondary text-xs mt-0.5">This month: goal met on <strong>{goalProgress.sleep.month.met}</strong> of {goalProgress.sleep.month.total} days</p>
              </div>
            )}
          </div>
          {projection && (
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-sm">
              <Trophy className="w-4 h-4 text-accent-gold shrink-0" />
              {projection.is_first ? (
                <span className="text-text-primary">You&apos;re #1 on the all-time leaderboard. Keep it up!</span>
              ) : projection.days_to_first != null && projection.days_to_first > 0 ? (
                <span className="text-text-primary">
                  If you keep hitting your goal (~{projection.expected_daily_points} pts/day), about <strong>{projection.days_to_first}</strong> days to reach #1. You&apos;re currently #{projection.rank}.
                </span>
              ) : (
                <span className="text-text-primary">
                  Keep hitting your goals — you&apos;re gaining. Currently #{projection.rank} on the all-time leaderboard.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {projection && !(goalProgress.workout.hasGoal || goalProgress.steps.hasGoal || goalProgress.sleep.hasGoal) && (
        <div className="glass-card p-5">
          <h3 className="font-medium text-text-primary flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-accent-gold" />
            Leaderboard
          </h3>
          <p className="text-sm text-text-secondary">
            {projection.is_first ? (
              <>You&apos;re #1 on the all-time leaderboard. Keep it up!</>
            ) : projection.days_to_first != null && projection.days_to_first > 0 ? (
              <>If you keep hitting your goal (~{projection.expected_daily_points} pts/day), about <strong>{projection.days_to_first}</strong> days to reach #1. You&apos;re currently #{projection.rank}.</>
            ) : (
              <>Keep hitting your goals — you&apos;re gaining. Currently #{projection.rank} on the all-time leaderboard.</>
            )}
          </p>
        </div>
      )}

      <div className="glass-card p-5">
        <h3 className="font-medium text-text-primary flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#FF6B35]" />
          Workout days
        </h3>
        {loading ? (
          <div className="animate-pulse text-text-muted text-sm">Loading…</div>
        ) : workoutEntries.length === 0 ? (
          <p className="text-sm text-text-muted">No workout or cardio logged in the last 60 days.</p>
        ) : (
          <ul className="space-y-2">
            {workoutEntries.slice(0, 30).map((e) => (
              <li
                key={e.date}
                className="flex items-center justify-between text-sm py-2 pl-3 border-b border-white/10 last:border-0 rounded-r-lg border-l-4"
                style={{ borderLeftColor: entryBorderColor(e) }}
              >
                <span className="text-text-primary font-medium">
                  {new Date(e.date + 'Z').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="flex items-center gap-2 text-text-secondary">
                  {e.workout_done === true && (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLOR_WORKOUT }} aria-hidden />
                      Workout {e.workout_duration ? `${e.workout_duration} min` : ''} {e.workout_types?.length ? `(${e.workout_types.map(label).join(', ')})` : ''}
                    </span>
                  )}
                  {e.cardio_done === true && (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLOR_CARDIO }} aria-hidden />
                      Cardio {e.cardio_duration ? `${e.cardio_duration} min` : ''} {e.cardio_type ? label(e.cardio_type) : ''}
                    </span>
                  )}
                  {!e.workout_done && !e.cardio_done && e.steps != null && Number(e.steps) > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLOR_STEPS }} aria-hidden />
                      {e.steps.toLocaleString()} steps
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {workoutEntries.length > 30 && (
          <p className="text-xs text-text-muted mt-2">Showing last 30 workout days.</p>
        )}
      </div>
    </div>
  );
}
