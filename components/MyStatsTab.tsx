'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Target, Activity, Utensils, Moon, Pencil, User } from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import type { Profile } from '@/lib/types';

function cmToFeetInch(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

function formatHeight(cm: number): string {
  const { feet, inches } = cmToFeetInch(cm);
  return `${cm} cm (${feet}'${inches}")`;
}

export function MyStatsTab({ profile, onSuccess }: { profile: Profile; onSuccess?: () => void }) {
  const [weightHistory, setWeightHistory] = useState<{ week_start: string; weight_kg: number }[]>([]);
  const [entryHistory, setEntryHistory] = useState<{ date: string; daily_points: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalsSaving, setGoalsSaving] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);
  const [goals, setGoals] = useState({
    goal_workout_mins_week: profile.goal_workout_mins_week ?? '',
    goal_workout_days_week: profile.goal_workout_days_week ?? '',
    goal_steps_day: profile.goal_steps_day ?? '',
    goal_sleep_hours: profile.goal_sleep_hours ?? profile.goal_sleep_hours_min ?? '',
    goal_water_liters: profile.goal_water_liters ?? '',
    goal_home_cooked_per_week: profile.goal_home_cooked_per_week ?? '',
  });

  const hasAnyGoals = [
    profile.goal_workout_mins_week,
    profile.goal_workout_days_week,
    profile.goal_steps_day,
    profile.goal_sleep_hours ?? profile.goal_sleep_hours_min,
    profile.goal_water_liters,
    profile.goal_home_cooked_per_week,
  ].some((v) => v != null && String(v) !== '');

  useEffect(() => {
    setGoals({
      goal_workout_mins_week: profile.goal_workout_mins_week ?? '',
      goal_workout_days_week: profile.goal_workout_days_week ?? '',
      goal_steps_day: profile.goal_steps_day ?? '',
      goal_sleep_hours: profile.goal_sleep_hours ?? profile.goal_sleep_hours_min ?? '',
      goal_water_liters: profile.goal_water_liters ?? '',
      goal_home_cooked_per_week: profile.goal_home_cooked_per_week ?? '',
    });
  }, [profile]);

  const loadData = () => {
    const from = new Date();
    from.setDate(from.getDate() - 90);
    const to = new Date().toISOString().slice(0, 10);
    const fromStr = from.toISOString().slice(0, 10);
    Promise.all([
      fetch(apiUrl('/api/weight/history'), getApiFetchOptions()).then((r) => r.json()),
      fetch(apiUrl(`/api/entries/history?from=${fromStr}&to=${to}`), getApiFetchOptions()).then((r) => r.json()),
    ]).then(([wh, eh]) => {
      setWeightHistory(wh ?? []);
      setEntryHistory((eh ?? []).map((e: { date: string; daily_points: number }) => ({ date: e.date, daily_points: e.daily_points ?? 0 })));
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoalsSaving(true);
    const payload: Record<string, number | null> = {};
    const num = (v: string | number) => (v === '' || v == null ? null : Number(v));
    payload.goal_workout_mins_week = num(goals.goal_workout_mins_week);
    payload.goal_workout_days_week = num(goals.goal_workout_days_week);
    payload.goal_steps_day = num(goals.goal_steps_day);
    payload.goal_sleep_hours = num(goals.goal_sleep_hours);
    payload.goal_water_liters = num(goals.goal_water_liters);
    payload.goal_home_cooked_per_week = num(goals.goal_home_cooked_per_week);
    const res = await fetch(apiUrl('/api/users/me'), getApiFetchOptions({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
    setGoalsSaving(false);
    if (res.ok) {
      setEditingGoals(false);
      onSuccess?.();
    }
  };

  if (loading) return <div className="animate-pulse text-text-muted">Loading your stats…</div>;

  const bmi = profile.current_weight && profile.height_cm
    ? (profile.current_weight / Math.pow(profile.height_cm / 100, 2)).toFixed(1)
    : null;

  const workoutGoals = [
    { key: 'goal_workout_mins_week', label: 'Workout mins/week', value: goals.goal_workout_mins_week, set: (v: string) => setGoals((g) => ({ ...g, goal_workout_mins_week: v })), placeholder: '150', min: 0, max: 600 },
    { key: 'goal_workout_days_week', label: 'Workout days/week', value: goals.goal_workout_days_week, set: (v: string) => setGoals((g) => ({ ...g, goal_workout_days_week: v })), placeholder: '3', min: 0, max: 7 },
    { key: 'goal_steps_day', label: 'Steps/day', value: goals.goal_steps_day, set: (v: string) => setGoals((g) => ({ ...g, goal_steps_day: v })), placeholder: '10000', min: 0, max: 100000 },
  ];
  const foodGoals = [
    { key: 'goal_water_liters', label: 'Water (L/day)', value: goals.goal_water_liters, set: (v: string) => setGoals((g) => ({ ...g, goal_water_liters: v })), placeholder: '2.5', min: 0, max: 10, step: 0.5 },
    { key: 'goal_home_cooked_per_week', label: 'Home-cooked meals/week', value: goals.goal_home_cooked_per_week, set: (v: string) => setGoals((g) => ({ ...g, goal_home_cooked_per_week: v })), placeholder: '10', min: 0, max: 21 },
  ];
  const sleepGoals = [
    { key: 'goal_sleep_hours', label: 'Sleep (hours/night)', value: goals.goal_sleep_hours, set: (v: string) => setGoals((g) => ({ ...g, goal_sleep_hours: v })), placeholder: '7.5', min: 4, max: 12, step: 0.5 },
  ];

  return (
    <div className="space-y-0 animate-fade-up">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary">Profile & Goals</h2>
        <p className="text-sm text-text-secondary">Private — weight and BMI are never shown on the leaderboard.</p>
      </div>

      {/* ═══ PROFILE ═══ */}
      <section className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-primary-orange/30 via-primary-orange/20 to-transparent" aria-hidden />
        <div className="pl-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
            <User className="w-4 h-4 text-primary-orange" />
            Profile
          </h3>
          <div className="glass-card p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Display name</p>
                <p className="text-base font-semibold text-text-primary mt-0.5">{profile.display_name}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Age</p>
                <p className="text-base font-semibold text-text-primary mt-0.5">{profile.age} years</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Height</p>
                <p className="text-base font-semibold text-text-primary mt-0.5">{formatHeight(profile.height_cm)}</p>
              </div>
              {profile.current_weight != null && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Current weight</p>
                  <p className="text-base font-semibold text-text-primary mt-0.5">{profile.current_weight} kg</p>
                </div>
              )}
              {bmi != null && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium">BMI</p>
                  <p className="text-base font-semibold text-text-primary mt-0.5">{bmi}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ GOALS ═══ */}
      <section className="relative mt-10">
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-accent-green/30 via-accent-green/20 to-transparent" aria-hidden />
        <div className="pl-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-muted">
              <Target className="w-4 h-4 text-accent-green" />
              Goals
            </h3>
            {hasAnyGoals && !editingGoals && (
              <button
                type="button"
                onClick={() => setEditingGoals(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-accent-green hover:text-accent-green/80 transition-colors"
                aria-label="Edit goals"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
          </div>

          {(editingGoals || !hasAnyGoals) ? (
            <form onSubmit={handleSaveGoals} className="glass-card p-5 space-y-6">
              <div className="space-y-6">
                {/* Workout bucket */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-[#FF6B35]" />
                    <span className="text-sm font-semibold text-text-primary">Workout</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {workoutGoals.map((g) => (
                      <div key={g.key}>
                        <label className="block text-xs font-medium text-text-muted mb-1">{g.label}</label>
                        <input
                          type="number"
                          min={g.min}
                          max={g.max}
                          step={(g as { step?: number }).step}
                          placeholder={g.placeholder}
                          value={g.value}
                          onChange={(e) => g.set(e.target.value)}
                          className="input-field w-full"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Food bucket */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Utensils className="w-4 h-4 text-accent-gold" />
                    <span className="text-sm font-semibold text-text-primary">Food</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {foodGoals.map((g) => (
                      <div key={g.key}>
                        <label className="block text-xs font-medium text-text-muted mb-1">{g.label}</label>
                        <input
                          type="number"
                          min={g.min}
                          max={g.max}
                          step={(g as { step?: number }).step ?? 1}
                          placeholder={g.placeholder}
                          value={g.value}
                          onChange={(e) => g.set(e.target.value)}
                          className="input-field w-full"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sleep bucket */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Moon className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-semibold text-text-primary">Sleep</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sleepGoals.map((g) => (
                      <div key={g.key}>
                        <label className="block text-xs font-medium text-text-muted mb-1">{g.label}</label>
                        <input
                          type="number"
                          min={g.min}
                          max={g.max}
                          step={(g as { step?: number }).step ?? 0.5}
                          placeholder={g.placeholder}
                          value={g.value}
                          onChange={(e) => g.set(e.target.value)}
                          className="input-field w-full"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={goalsSaving} className="btn-primary flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  {goalsSaving ? 'Saving…' : 'Save goals'}
                </button>
                {hasAnyGoals && (
                  <button type="button" onClick={() => setEditingGoals(false)} className="btn-ghost">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="glass-card p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FF6B35]/10 flex items-center justify-center shrink-0">
                    <Activity className="w-5 h-5 text-[#FF6B35]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Workout</p>
                    <ul className="text-sm text-text-primary space-y-0.5">
                      {profile.goal_workout_mins_week != null && <li>{profile.goal_workout_mins_week} min/week</li>}
                      {profile.goal_workout_days_week != null && <li>{profile.goal_workout_days_week} days/week</li>}
                      {profile.goal_steps_day != null && <li>{profile.goal_steps_day.toLocaleString()} steps/day</li>}
                      {!profile.goal_workout_mins_week && !profile.goal_workout_days_week && !profile.goal_steps_day && <li className="text-text-muted">—</li>}
                    </ul>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-gold/10 flex items-center justify-center shrink-0">
                    <Utensils className="w-5 h-5 text-accent-gold" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Food</p>
                    <ul className="text-sm text-text-primary space-y-0.5">
                      {profile.goal_water_liters != null && <li>{profile.goal_water_liters} L water/day</li>}
                      {profile.goal_home_cooked_per_week != null && <li>{profile.goal_home_cooked_per_week} home-cooked/week</li>}
                      {!profile.goal_water_liters && !profile.goal_home_cooked_per_week && <li className="text-text-muted">—</li>}
                    </ul>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <Moon className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Sleep</p>
                    <p className="text-sm text-text-primary">
                      {(profile.goal_sleep_hours ?? profile.goal_sleep_hours_min) != null
                        ? `${profile.goal_sleep_hours ?? profile.goal_sleep_hours_min} h/night`
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══ WEIGHT & POINTS HISTORY ═══ */}
      <section className="relative mt-14 pb-8">
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-accent-gold/30 via-accent-gold/20 to-transparent" aria-hidden />
        <div className="pl-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-muted mb-5">
            <Target className="w-4 h-4 text-accent-gold" />
            Weight & Points History
          </h3>
          <p className="text-sm text-text-secondary mb-6">
            Log weight from <strong>New Entry</strong> when you log a day. It updates your weekly weigh-in and current weight.
          </p>

          {weightHistory.length > 0 && (
            <div className="glass-card p-5 mb-8 overflow-visible">
              <h4 className="font-medium text-text-primary mb-3">Weight (weekly)</h4>
              <div className="w-full min-h-[200px]" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={[...weightHistory].reverse().map((w) => ({ ...w, name: w.week_start }))} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <XAxis dataKey="week_start" tick={{ fontSize: 10 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={35} />
                    <Tooltip />
                    <Line type="monotone" dataKey="weight_kg" stroke="var(--accent-green)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {entryHistory.length > 0 && (
            <div className="glass-card p-5 overflow-visible">
              <h4 className="font-medium text-text-primary mb-3">Daily points (last 90 days)</h4>
              <div className="w-full min-h-[200px]" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={entryHistory.slice(0, 90).reverse()} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={35} />
                    <Tooltip />
                    <Line type="monotone" dataKey="daily_points" stroke="var(--accent-gold)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {weightHistory.length === 0 && entryHistory.length === 0 && (
            <div className="glass-card p-8 text-center">
              <p className="text-sm text-text-muted">No weight or points history yet. Start logging from <strong>New Entry</strong>.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
