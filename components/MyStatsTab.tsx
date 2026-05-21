'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Target, Activity, Utensils, Moon, Pencil, Check, X, Calendar, Ruler, Scale } from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import type { Profile, FitnessGoal, FoodTrackingMode, WorkoutGoalType } from '@/lib/types';
import { parseGoalWorkoutTypes } from '@/lib/workout-goals';
import { formatProteinRecommendationLine } from '@/lib/protein-recommendations';
import { getGoalHabitTips } from '@/lib/goal-habit-tips';
import {
  clampGoalWorkoutMinsWeek,
  RECOMMENDED_SLEEP_HOURS_BY_GOAL,
  RECOMMENDED_WATER_LITERS_BY_GOAL,
  RECOMMENDED_WORKOUT_DAYS_WEEK_BY_GOAL,
  formatRecommendedWaterLine,
  formatRecommendedSleepLine,
  formatRecommendedWorkoutSummaryLine,
  recommendedWorkoutHoursMinsParts,
} from '@/lib/goal-defaults';
import { dicebearAvatarUrl, dicebearAvatarPickerSeeds, resolveAvatarUrl } from '@/lib/avatar-url';
import { FITNESS_GOAL_THEMES } from '@/lib/fitness-goal-theme';
import { TabContentLoader } from '@/components/LoadingScreen';
import { FITNESS_GOAL_POINTS_HINTS, foodModePointsSummary } from '@/lib/scoring-copy';

const FITNESS_GOAL_BADGES: Record<FitnessGoal, { label: string; color: string }> = Object.fromEntries(
  (Object.entries(FITNESS_GOAL_THEMES) as [FitnessGoal, { label: string; badgeClass: string }][]).map(
    ([k, v]) => [k, { label: v.label, color: v.badgeClass }],
  ),
) as Record<FitnessGoal, { label: string; color: string }>;

const FITNESS_GOAL_CALORIE_COLORS: Record<FitnessGoal, string> = {
  lose_weight: 'bg-rose-100 text-rose-700',
  gain_muscle: 'bg-emerald-100 text-emerald-700',
  gain_weight: 'bg-emerald-100 text-emerald-700',
  stay_active: 'bg-amber-100 text-amber-700',
  general_wellness: 'bg-violet-100 text-violet-700',
};

const FITNESS_GOAL_DETAILS: Record<FitnessGoal, {
  emoji: string;
  who: string;
  calorieModeLabel: string;
  calorieModeHint: string;
  calorieModeColor: string;
}> = {
  lose_weight: {
    emoji: '🔥',
    who: 'I want to burn fat',
    calorieModeLabel: FITNESS_GOAL_POINTS_HINTS.lose_weight.calorieModeLabel,
    calorieModeHint: FITNESS_GOAL_POINTS_HINTS.lose_weight.calorieModeHint,
    calorieModeColor: FITNESS_GOAL_CALORIE_COLORS.lose_weight,
  },
  gain_muscle: {
    emoji: '💪',
    who: 'I want to build lean muscle',
    calorieModeLabel: FITNESS_GOAL_POINTS_HINTS.gain_muscle.calorieModeLabel,
    calorieModeHint: FITNESS_GOAL_POINTS_HINTS.gain_muscle.calorieModeHint,
    calorieModeColor: FITNESS_GOAL_CALORIE_COLORS.gain_muscle,
  },
  gain_weight: {
    emoji: '📈',
    who: 'I want to add overall mass',
    calorieModeLabel: FITNESS_GOAL_POINTS_HINTS.gain_weight.calorieModeLabel,
    calorieModeHint: FITNESS_GOAL_POINTS_HINTS.gain_weight.calorieModeHint,
    calorieModeColor: FITNESS_GOAL_CALORIE_COLORS.gain_weight,
  },
  stay_active: {
    emoji: '🏃',
    who: 'I want to stay fit and consistent',
    calorieModeLabel: FITNESS_GOAL_POINTS_HINTS.stay_active.calorieModeLabel,
    calorieModeHint: FITNESS_GOAL_POINTS_HINTS.stay_active.calorieModeHint,
    calorieModeColor: FITNESS_GOAL_CALORIE_COLORS.stay_active,
  },
  general_wellness: {
    emoji: '🧘',
    who: 'I want to feel better overall',
    calorieModeLabel: FITNESS_GOAL_POINTS_HINTS.general_wellness.calorieModeLabel,
    calorieModeHint: FITNESS_GOAL_POINTS_HINTS.general_wellness.calorieModeHint,
    calorieModeColor: FITNESS_GOAL_CALORIE_COLORS.general_wellness,
  },
};

const WORKOUT_TYPES: { value: WorkoutGoalType; label: string; emoji: string }[] = [
  { value: 'strength',      label: 'Strength',        emoji: '🏋️' },
  { value: 'running',       label: 'Running',         emoji: '🏃' },
  { value: 'team_sports',   label: 'Team Sports',     emoji: '⚽' },
  { value: 'racket_sports', label: 'Racket Sports',   emoji: '🏸' },
  { value: 'martial_arts',  label: 'Martial Arts',    emoji: '🥊' },
  { value: 'cycling',       label: 'Cycling',         emoji: '🚴' },
  { value: 'swimming',      label: 'Swimming',        emoji: '🏊' },
  { value: 'yoga',          label: 'Yoga / Flex',     emoji: '🧘' },
  { value: 'crossfit',      label: 'CrossFit / HIIT', emoji: '⚡' },
  { value: 'walking',       label: 'Walking',         emoji: '🚶' },
  { value: 'cardio_mix',    label: 'Mixed Cardio',    emoji: '🔄' },
];

// ─── helpers ────────────────────────────────────────────────────────────────

function cmToFeetInch(cm: number) {
  const totalIn = cm / 2.54;
  return { feet: Math.floor(totalIn / 12), inches: Math.round(totalIn % 12) };
}

function minsToHoursDisplay(mins: number): string {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/** "2025-01-24" → "24 Jan '25" */
function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDate();
  const mon = d.toLocaleString('en', { month: 'short' });
  const yr = String(d.getFullYear()).slice(2);
  return `${day} ${mon} '${yr}`;
}

/** Goals editor: inputs with depth, inset highlight, and focus ring. */
const GOALS_INPUT =
  'w-full rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 px-3.5 py-2.5 text-sm text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(15,23,42,0.05)] outline-none transition placeholder:text-slate-400 focus:border-primary-orange/50 focus:ring-2 focus:ring-primary-orange/20 focus:shadow-[0_0_0_3px_rgba(255,107,53,0.1),inset_0_1px_0_rgba(255,255,255,0.95)]';

function GoalFormTip({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'coral' | 'sky' | 'amber' | 'indigo';
  children: ReactNode;
}) {
  const shell = {
    coral:
      'border-orange-200/75 bg-gradient-to-br from-orange-50/95 via-white to-white',
    sky: 'border-sky-200/75 bg-gradient-to-br from-sky-50/90 via-white to-white',
    amber:
      'border-amber-200/75 bg-gradient-to-br from-amber-50/90 via-white to-white',
    indigo:
      'border-indigo-200/75 bg-gradient-to-br from-indigo-50/90 via-white to-white',
  }[tone];
  const titleCls = {
    coral: 'text-orange-900/90',
    sky: 'text-sky-900/90',
    amber: 'text-amber-900/90',
    indigo: 'text-indigo-900/90',
  }[tone];
  return (
    <div className={`rounded-xl border px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ${shell}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${titleCls}`}>{title}</p>
      <p className="text-[11px] text-text-secondary leading-relaxed">{children}</p>
    </div>
  );
}

// ─── component ──────────────────────────────────────────────────────────────

export function MyStatsTab({ profile, onSuccess }: { profile: Profile; onSuccess?: () => void }) {
  const [weightHistory, setWeightHistory] = useState<{ week_start: string; weight_kg: number }[]>([]);
  const [entryHistory, setEntryHistory] = useState<{ date: string; daily_points: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // profile edit
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(profile.avatar_url ?? '');
  const [profileFields, setProfileFields] = useState({
    display_name: profile.display_name,
    age: String(profile.age),
    height_cm: String(profile.height_cm),
    gender: profile.gender,
  });

  // goals
  const [goalsSaving, setGoalsSaving] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);
  const workoutMinsStored = profile.goal_workout_mins_week ?? null;
  const [goalWorkoutHours, setGoalWorkoutHours] = useState(
    workoutMinsStored != null ? String(Math.floor(workoutMinsStored / 60)) : ''
  );
  const [goalWorkoutMins, setGoalWorkoutMins] = useState(
    workoutMinsStored != null ? String(workoutMinsStored % 60) : ''
  );
  const [goals, setGoals] = useState({
    goal_workout_days_week: profile.goal_workout_days_week ?? '',
    goal_sleep_hours: profile.goal_sleep_hours ?? profile.goal_sleep_hours_min ?? '',
    goal_water_liters: profile.goal_water_liters ?? '',
    goal_protein_g_day: profile.goal_protein_g_day ?? '',
    goal_calories_day: profile.goal_calories_day ?? '',
    goal_steps_day: profile.goal_steps_day ?? '',
  });
  const [trackStepsOptIn, setTrackStepsOptIn] = useState(!!(profile.goal_steps_day));
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>(profile.fitness_goal ?? 'stay_active');
  const [foodMode, setFoodMode] = useState<FoodTrackingMode>(profile.food_tracking_mode ?? 'protein_only');
  const [workoutTypes, setWorkoutTypes] = useState<WorkoutGoalType[]>(() => {
    const w = parseGoalWorkoutTypes(profile.goal_workout_types);
    return w.length > 0 ? w : ['cardio_mix'];
  });

  function toggleWorkoutType(t: WorkoutGoalType) {
    setWorkoutTypes((prev) => {
      const next = prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t];
      // Auto-fill 8,000 steps when walking is added (if no step goal yet)
      if (t === 'walking' && !prev.includes('walking') && !goals.goal_steps_day) {
        setGoals((g) => ({ ...g, goal_steps_day: '8000' }));
      }
      return next;
    });
  }
  const [goalChangeWarning, setGoalChangeWarning] = useState(false);
  const [goalsFieldError, setGoalsFieldError] = useState<string | null>(null);
  const [goalsSavedToast, setGoalsSavedToast] = useState(false);

  const hasAnyGoals = [
    profile.goal_workout_mins_week,
    profile.goal_workout_days_week,
    profile.goal_sleep_hours ?? profile.goal_sleep_hours_min,
    profile.goal_water_liters,
    profile.goal_protein_g_day,
    profile.goal_calories_day,
  ].some((v) => v != null && String(v) !== '');

  useEffect(() => {
    const m = profile.goal_workout_mins_week ?? null;
    setGoalWorkoutHours(m != null ? String(Math.floor(m / 60)) : '');
    setGoalWorkoutMins(m != null ? String(m % 60) : '');
    setGoals({
      goal_workout_days_week: profile.goal_workout_days_week ?? '',
      goal_sleep_hours: profile.goal_sleep_hours ?? profile.goal_sleep_hours_min ?? '',
      goal_water_liters: profile.goal_water_liters ?? '',
      goal_protein_g_day: profile.goal_protein_g_day ?? '',
      goal_calories_day: profile.goal_calories_day ?? '',
      goal_steps_day: profile.goal_steps_day ?? '',
    });
    setFitnessGoal(profile.fitness_goal ?? 'stay_active');
    setFoodMode(profile.food_tracking_mode ?? 'protein_only');
    {
      const w = parseGoalWorkoutTypes(profile.goal_workout_types);
      setWorkoutTypes(w.length > 0 ? w : ['cardio_mix']);
    }
    setProfileFields({
      display_name: profile.display_name,
      age: String(profile.age),
      height_cm: String(profile.height_cm),
      gender: profile.gender,
    });
    setSelectedAvatar(profile.avatar_url ?? '');
  }, [profile]);

  useEffect(() => {
    if (workoutTypes.length > 0) setGoalsFieldError(null);
  }, [workoutTypes]);

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - 90);
    const to = new Date().toISOString().slice(0, 10);
    const fromStr = from.toISOString().slice(0, 10);
    Promise.all([
      fetch(apiUrl('/api/weight/history'), getApiFetchOptions()).then((r) => r.json()),
      fetch(apiUrl(`/api/entries/history?from=${fromStr}&to=${to}`), getApiFetchOptions()).then((r) => r.json()),
    ]).then(([wh, eh]) => {
      setWeightHistory(wh ?? []);
      setEntryHistory((eh ?? []).map((e: { date: string; daily_points: number }) => ({
        date: e.date,
        label: fmtDate(e.date),
        daily_points: e.daily_points ?? 0,
      })));
      setLoading(false);
    });
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    const payload: Record<string, unknown> = {
      display_name: profileFields.display_name.trim(),
      age: Number(profileFields.age),
      height_cm: Number(profileFields.height_cm),
      gender: profileFields.gender,
      avatar_url: selectedAvatar || null,
    };
    const res = await fetch(apiUrl('/api/users/me'), getApiFetchOptions({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    setProfileSaving(false);
    if (res.ok) { setEditingProfile(false); onSuccess?.(); }
  };

  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (workoutTypes.length === 0) {
      setGoalsFieldError('Select at least one workout type.');
      return;
    }
    setGoalsFieldError(null);
    setGoalsSaving(true);
    const num = (v: string | number) => (v === '' || v == null ? null : Number(v));
    const totalWorkoutMinsRaw = (goalWorkoutHours !== '' || goalWorkoutMins !== '')
      ? (Number(goalWorkoutHours || 0) * 60 + Number(goalWorkoutMins || 0)) : null;
    const totalWorkoutMins =
      totalWorkoutMinsRaw != null && Number.isFinite(totalWorkoutMinsRaw)
        ? clampGoalWorkoutMinsWeek(totalWorkoutMinsRaw)
        : null;
    const payload: Record<string, unknown> = {
      fitness_goal: fitnessGoal,
      food_tracking_mode: foodMode,
      goal_workout_types: workoutTypes,
      goal_workout_mins_week: totalWorkoutMins,
      goal_workout_days_week: num(goals.goal_workout_days_week),
      goal_sleep_hours: num(goals.goal_sleep_hours),
      goal_water_liters: num(goals.goal_water_liters),
      goal_protein_g_day: foodMode !== 'calories_only' ? num(goals.goal_protein_g_day) : null,
      goal_calories_day: foodMode !== 'protein_only' ? num(goals.goal_calories_day) : null,
      goal_steps_day: (workoutTypes.includes('walking') || trackStepsOptIn) ? num(goals.goal_steps_day) : null,
    };
    const res = await fetch(apiUrl('/api/users/me'), getApiFetchOptions({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    setGoalsSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setGoalsFieldError(typeof (d as { error?: string }).error === 'string' ? (d as { error: string }).error : 'Could not save goals');
      return;
    }
    setGoalsFieldError(null);
    setEditingGoals(false);
    setGoalChangeWarning(false);
    setGoalsSavedToast(true);
    window.setTimeout(() => setGoalsSavedToast(false), 5500);
    onSuccess?.();
  };

  if (loading) return <TabContentLoader message="Loading your stats…" />;

  const weightKgForGoals = profile.current_weight ?? profile.starting_weight ?? 70;

  const habitTipsForGoal = getGoalHabitTips(fitnessGoal);
  const goalBadgeLabel = FITNESS_GOAL_BADGES[fitnessGoal].label;
  const recWorkoutParts = recommendedWorkoutHoursMinsParts(fitnessGoal);

  const bmi = profile.current_weight && profile.height_cm
    ? (profile.current_weight / Math.pow(profile.height_cm / 100, 2)).toFixed(1) : null;

  const { feet, inches } = cmToFeetInch(profile.height_cm);
  const seeds = dicebearAvatarPickerSeeds(profile.display_name);
  const autoAvatarSrc = resolveAvatarUrl({
    userId: profile.id,
    displayName: profile.display_name,
    avatarUrl: null,
  });
  const currentAvatarSrc = editingProfile
    ? (selectedAvatar || autoAvatarSrc)
    : resolveAvatarUrl({
        userId: profile.id,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
      });

  const weightChartData = [...weightHistory].reverse().map((w) => ({
    ...w,
    label: fmtDate(w.week_start),
  }));

  const editBtnCls = 'flex items-center gap-1.5 text-xs font-medium transition-colors px-3 py-1.5 rounded-lg border';

  return (
    <div className="space-y-8 animate-fade-up">

      {/* ══════════════════════════════════════
          PROFILE CARD
      ══════════════════════════════════════ */}
      <div className="glass-card overflow-hidden">
        {/* Banner — Edit profile sits in the gradient */}
        <div className="h-24 sm:h-28 bg-gradient-to-r from-primary-orange/25 via-primary-orange/10 to-indigo-100/30 relative">
          {!editingProfile && (
            <button
              type="button"
              onClick={() => setEditingProfile(true)}
              className={`absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 ${editBtnCls} text-primary-orange border-primary-orange/20 hover:bg-primary-orange/5 hover:border-primary-orange/30`}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit profile
            </button>
          )}
        </div>

        <div className="px-4 sm:px-6 pb-5">
          {/* Avatar row */}
          <div className="flex items-end -mt-12 sm:-mt-14 mb-4">
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl ring-4 ring-white shadow-lg overflow-hidden bg-gradient-to-br from-primary-orange to-primary-orange-dark flex items-center justify-center text-white text-2xl sm:text-3xl font-bold">
                {currentAvatarSrc.startsWith('http')
                  ? <img src={currentAvatarSrc} alt={profile.display_name} className="w-full h-full object-cover" />
                  : <span>{getInitials(profile.display_name)}</span>
                }
              </div>
            </div>
          </div>

          {editingProfile ? (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Avatar picker */}
              <div>
                <p className="text-xs font-medium text-text-muted mb-2">Choose your avatar</p>
                <div className="flex gap-2 flex-wrap">
                  {seeds.map((seed) => {
                    const url = dicebearAvatarUrl(seed);
                    const active = selectedAvatar === url;
                    return (
                      <button
                        key={seed}
                        type="button"
                        onClick={() => setSelectedAvatar(url)}
                        className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                          active ? 'border-primary-orange shadow-md scale-105' : 'border-transparent hover:border-primary-orange/30'
                        }`}
                      >
                        <img src={url} alt={seed} className="w-full h-full object-cover bg-slate-100" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-text-muted mb-1">Display name</label>
                  <input type="text" value={profileFields.display_name}
                    onChange={(e) => setProfileFields((p) => ({ ...p, display_name: e.target.value }))}
                    className="input-field" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Age</label>
                  <input type="number" min={10} max={120} value={profileFields.age}
                    onChange={(e) => setProfileFields((p) => ({ ...p, age: e.target.value }))}
                    className="input-field" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Gender</label>
                  <select value={profileFields.gender}
                    onChange={(e) => setProfileFields((p) => ({ ...p, gender: e.target.value as Profile['gender'] }))}
                    className="input-field">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-text-muted mb-1">Height (cm)</label>
                  <input type="number" min={1} max={300} step={0.1} value={profileFields.height_cm}
                    onChange={(e) => setProfileFields((p) => ({ ...p, height_cm: e.target.value }))}
                    className="input-field" required />
                </div>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed rounded-lg bg-surface-1 border border-white/10 px-3 py-2">
                Weight isn&apos;t edited here — it updates when you choose{' '}
                <span className="font-medium text-text-secondary">Log weight</span> from the + menu when adding an entry.
              </p>
              <div className="flex gap-2">
                <button type="submit" disabled={profileSaving} className="btn-primary flex items-center gap-2 text-sm">
                  <Check className="w-3.5 h-3.5" />
                  {profileSaving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setEditingProfile(false)} className="btn-ghost text-sm flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h3 className="text-xl font-bold text-text-primary leading-tight">{profile.display_name}</h3>
              <p className="text-sm text-text-muted capitalize mb-4">{profile.gender}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-white p-3.5 sm:p-4 shadow-sm ring-1 ring-amber-900/[0.04]">
                  <div className="inline-flex rounded-xl bg-amber-500/15 p-2 text-amber-700">
                    <Calendar className="size-4 shrink-0" strokeWidth={2.25} />
                  </div>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-amber-900/70">Age</p>
                  <p className="mt-0.5 text-[1.65rem] sm:text-[1.75rem] font-bold tabular-nums tracking-tight text-amber-950 leading-none">{profile.age}</p>
                  <p className="text-[11px] font-medium text-amber-800/75">years</p>
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-white p-3.5 sm:p-4 shadow-sm ring-1 ring-sky-900/[0.04]">
                  <div className="inline-flex rounded-xl bg-sky-500/15 p-2 text-sky-700">
                    <Ruler className="size-4 shrink-0" strokeWidth={2.25} />
                  </div>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-sky-900/70">Height</p>
                  <p className="mt-0.5 text-[1.65rem] sm:text-[1.75rem] font-bold tabular-nums tracking-tight text-sky-950 leading-none">{profile.height_cm}</p>
                  <p className="text-[11px] font-medium text-sky-800/75">
                    cm <span className="text-sky-700/80">·</span> {feet}&apos;{inches}&quot;
                  </p>
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-white p-3.5 sm:p-4 shadow-sm ring-1 ring-emerald-900/[0.04]">
                  <div className="inline-flex rounded-xl bg-emerald-500/15 p-2 text-emerald-700">
                    <Scale className="size-4 shrink-0" strokeWidth={2.25} />
                  </div>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-emerald-900/70">Weight</p>
                  <p className="mt-0.5 text-[1.65rem] sm:text-[1.75rem] font-bold tabular-nums tracking-tight text-emerald-950 leading-none">
                    {profile.current_weight != null ? profile.current_weight : '—'}
                  </p>
                  <p className="text-[11px] font-medium text-emerald-800/75">kg</p>
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-white p-3.5 sm:p-4 shadow-sm ring-1 ring-violet-900/[0.04]">
                  <div className="inline-flex rounded-xl bg-violet-500/15 p-2 text-violet-700">
                    <Activity className="size-4 shrink-0" strokeWidth={2.25} />
                  </div>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-violet-900/70">BMI</p>
                  <p className={`mt-0.5 text-[1.65rem] sm:text-[1.75rem] font-bold tabular-nums tracking-tight leading-none ${bmi ? 'text-violet-950' : 'text-violet-400'}`}>
                    {bmi ?? '—'}
                  </p>
                  <p className="text-[11px] font-medium text-violet-800/75">index</p>
                </div>
              </div>
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-[11px] leading-snug text-text-muted">
                <Scale className="size-3.5 shrink-0 mt-0.5 text-primary-orange/70" strokeWidth={2.25} />
                <span>
                  You can&apos;t edit weight here — it updates when you choose{' '}
                  <span className="font-semibold text-text-secondary">Log weight</span> from the + menu when adding an entry.
                </span>
              </p>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          GOALS CARD
      ══════════════════════════════════════ */}
      <div className="rounded-2xl border-2 border-accent-green/25 bg-gradient-to-br from-accent-green/5 via-white to-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-accent-green/10 bg-accent-green/5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-green/15 flex items-center justify-center">
              <Target className="w-4 h-4 text-accent-green" />
            </div>
            <span className="font-semibold text-text-primary">My Goals</span>
            {/* Fitness goal badge */}
            {profile.fitness_goal && (
              <span className={`ml-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${FITNESS_GOAL_BADGES[profile.fitness_goal]?.color ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {FITNESS_GOAL_BADGES[profile.fitness_goal]?.label ?? profile.fitness_goal}
              </span>
            )}
          </div>
          {hasAnyGoals && !editingGoals && (
            <button
              type="button"
              onClick={() => setEditingGoals(true)}
              className={`${editBtnCls} text-accent-green border-accent-green/20 hover:bg-accent-green/5 hover:border-accent-green/30`}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>

        <div className="p-4 sm:p-6">
          {goalsSavedToast && (
            <div
              className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 flex items-start gap-3 animate-fade-up"
              role="status"
            >
              <span className="text-xl leading-none" aria-hidden>✨</span>
              <div>
                <p className="text-sm font-semibold text-emerald-900">Let&apos;s get set — go!</p>
                <p className="text-xs text-emerald-800/90 mt-0.5 leading-relaxed">
                  Your goals are saved. Small steps today, big momentum tomorrow.
                </p>
              </div>
            </div>
          )}
          {(editingGoals || !hasAnyGoals) ? (
            <form onSubmit={handleSaveGoals} className="space-y-6">
              {/* Fitness Goal */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-text-primary">Fitness Goal</span>
                </div>
                <p className="text-xs text-text-muted mb-3">
                  This changes your nutrition point cap and calorie/protein rules (v3: 75 pts/day water-only, 90 with full tracking).
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(FITNESS_GOAL_BADGES) as FitnessGoal[]).map((g) => {
                    const badge = FITNESS_GOAL_BADGES[g];
                    const detail = FITNESS_GOAL_DETAILS[g];
                    const selected = fitnessGoal === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          if (g !== profile.fitness_goal) setGoalChangeWarning(true);
                          setFitnessGoal(g);
                        }}
                        className={`rounded-xl px-3 py-2.5 text-left transition-all border ${
                          selected
                            ? badge.color + ' border-current shadow-sm'
                            : 'bg-surface-1 border-white/10 hover:bg-surface-2 text-text-secondary'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base flex-shrink-0">{detail.emoji}</span>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold block leading-tight">{badge.label}</span>
                              <span className="text-[11px] opacity-70 block leading-tight">{detail.who}</span>
                            </div>
                          </div>
                          {selected && <span className="text-xs opacity-80 flex-shrink-0">✓</span>}
                        </div>
                        {selected && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${detail.calorieModeColor}`}>
                              {detail.calorieModeLabel}
                            </span>
                            <span className="text-[10px] opacity-70">{detail.calorieModeHint}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {goalChangeWarning && (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚠️ Changing your fitness goal only affects entries from today. Past points are preserved.
                  </p>
                )}
              </div>

              {/* Workout — section tip + card */}
              <div className="rounded-2xl border border-orange-200/70 bg-gradient-to-br from-white via-orange-50/25 to-white p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF6B35]/12 text-[#FF6B35] shadow-sm ring-1 ring-[#FF6B35]/20">
                    <Activity className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-sm font-semibold text-text-primary">Workout</h3>
                    <p className="text-[11px] text-text-muted mt-0.5">Types, duration, and days per week</p>
                  </div>
                </div>
                <GoalFormTip title="Training for your goal" tone="coral">
                  {habitTipsForGoal.workout}
                </GoalFormTip>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1.5">
                    Workout types <span className="font-normal text-text-muted">(select all that apply)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WORKOUT_TYPES.map((t) => (
                      <button key={t.value} type="button"
                        onClick={() => toggleWorkoutType(t.value)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-all ${
                          workoutTypes.includes(t.value)
                            ? 'bg-[#FF6B35] text-white border-[#FF6B35] shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200/90 shadow-sm hover:border-[#FF6B35]/40 hover:bg-orange-50/60'
                        }`}>
                        <span aria-hidden>{t.emoji}</span>{t.label}
                      </button>
                    ))}
                  </div>
                  {goalsFieldError && (
                    <p className="mt-2 text-xs text-red-600" role="alert">
                      {goalsFieldError}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-text-primary mb-1.5">Duration per week</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1 min-w-0">
                        <input type="number" min={0} max={20} placeholder={String(recWorkoutParts.hours)} value={goalWorkoutHours}
                          onChange={(e) => setGoalWorkoutHours(e.target.value)}
                          className={`${GOALS_INPUT} pr-9 tabular-nums`} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 pointer-events-none">h</span>
                      </div>
                      <div className="relative flex-1 min-w-0">
                        <input type="number" min={0} max={59} placeholder={String(recWorkoutParts.mins)} value={goalWorkoutMins}
                          onChange={(e) => setGoalWorkoutMins(e.target.value)}
                          className={`${GOALS_INPUT} pr-11 tabular-nums`} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 pointer-events-none">min</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1.5">Days / week</label>
                    <input type="number" min={0} max={7} placeholder={String(RECOMMENDED_WORKOUT_DAYS_WEEK_BY_GOAL[fitnessGoal])} value={goals.goal_workout_days_week}
                      onChange={(e) => setGoals((g) => ({ ...g, goal_workout_days_week: e.target.value }))}
                      className={`${GOALS_INPUT} tabular-nums`} />
                  </div>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed rounded-lg bg-orange-50/50 border border-orange-100/80 px-3 py-2.5 mt-1">
                  {formatRecommendedWorkoutSummaryLine(fitnessGoal, goalBadgeLabel)}
                </p>

                {/* Steps goal — auto-shown for walkers, opt-in for others */}
                {workoutTypes.includes('walking') ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🚶</span>
                      <p className="text-xs font-semibold text-amber-900">Daily step goal</p>
                      <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">Walking</span>
                    </div>
                    <p className="text-[11px] text-amber-800/80">Steps are tracked as part of your walking goal. Progress shows on your dashboard.</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1000"
                        max="30000"
                        step="500"
                        placeholder="8000"
                        value={goals.goal_steps_day}
                        onChange={(e) => setGoals((g) => ({ ...g, goal_steps_day: e.target.value }))}
                        className={`w-28 ${GOALS_INPUT} tabular-nums`}
                      />
                      <span className="text-xs text-amber-800">steps / day</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-surface-1/50 px-4 py-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={trackStepsOptIn}
                        onChange={(e) => {
                          setTrackStepsOptIn(e.target.checked);
                          if (e.target.checked && !goals.goal_steps_day) {
                            setGoals((g) => ({ ...g, goal_steps_day: '8000' }));
                          }
                          if (!e.target.checked) setGoals((g) => ({ ...g, goal_steps_day: '' }));
                        }}
                        className="mt-0.5 w-4 h-4 accent-orange-500 rounded shrink-0"
                      />
                      <div>
                        <p className="text-xs font-semibold text-text-primary">Track daily steps</p>
                        <p className="text-[11px] text-text-muted mt-0.5">Add a step count goal and see progress on your dashboard</p>
                      </div>
                    </label>
                    {trackStepsOptIn && (
                      <div className="mt-2.5 flex items-center gap-2 pl-7">
                        <input
                          type="number"
                          min="1000"
                          max="30000"
                          step="500"
                          placeholder="8000"
                          value={goals.goal_steps_day}
                          onChange={(e) => setGoals((g) => ({ ...g, goal_steps_day: e.target.value }))}
                          className={`w-28 ${GOALS_INPUT} tabular-nums`}
                        />
                        <span className="text-xs text-text-muted">steps / day</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Food — hydration + nutrition tips */}
              <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/30 via-white to-white p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-700 shadow-sm ring-1 ring-amber-900/10">
                    <Utensils className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-sm font-semibold text-text-primary">Food tracking</h3>
                    <p className="text-[11px] text-text-muted mt-0.5">Hydration, protein, and calories — {FITNESS_GOAL_BADGES[fitnessGoal].label}</p>
                  </div>
                </div>
                <GoalFormTip title="Hydration" tone="sky">
                  {habitTipsForGoal.water}
                </GoalFormTip>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-2">What to track</label>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { value: 'protein_only', label: 'Protein only' },
                      { value: 'calories_only', label: 'Calories only' },
                      { value: 'both',          label: 'Both' },
                    ] as { value: FoodTrackingMode; label: string }[]).map((m) => (
                      <button key={m.value} type="button"
                        onClick={() => setFoodMode(m.value)}
                        className={`px-3 py-2 rounded-full text-xs font-medium border transition-all ${
                          foodMode === m.value
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200/90 shadow-sm hover:border-amber-400/50 hover:bg-amber-50/50'
                        }`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <GoalFormTip title="Nutrition for your goal" tone="amber">
                  {habitTipsForGoal.food}
                </GoalFormTip>
                <p className="text-[11px] text-text-muted leading-relaxed rounded-lg bg-amber-50/60 border border-amber-100/80 px-3 py-2.5">
                  {foodModePointsSummary(foodMode)}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1.5">Water (L / day)</label>
                    <input type="number" min={0} max={10} step={0.5} placeholder={String(RECOMMENDED_WATER_LITERS_BY_GOAL[fitnessGoal])}
                      value={goals.goal_water_liters}
                      onChange={(e) => setGoals((g) => ({ ...g, goal_water_liters: e.target.value }))}
                      className={`${GOALS_INPUT} tabular-nums`} />
                    <p className="mt-2 text-[11px] text-text-muted leading-relaxed rounded-lg bg-sky-50/50 border border-sky-100/80 px-3 py-2.5">
                      {formatRecommendedWaterLine(fitnessGoal, goalBadgeLabel)}
                    </p>
                  </div>
                  {(foodMode === 'protein_only' || foodMode === 'both') && (
                    <div>
                      <label className="block text-xs font-semibold text-text-primary mb-1.5">Protein goal (g / day)</label>
                      <input type="number" min={30} max={400} placeholder="140"
                        value={goals.goal_protein_g_day}
                        onChange={(e) => setGoals((g) => ({ ...g, goal_protein_g_day: e.target.value }))}
                        className={`${GOALS_INPUT} tabular-nums`} />
                      <p className="mt-2 text-[11px] text-text-muted leading-relaxed rounded-lg bg-surface-1 border border-white/10 px-2.5 py-2">
                        {formatProteinRecommendationLine(weightKgForGoals, fitnessGoal)}
                      </p>
                    </div>
                  )}
                  {(foodMode === 'calories_only' || foodMode === 'both') && (
                    <div>
                      <label className="block text-xs font-semibold text-text-primary mb-1.5">
                        Calorie {fitnessGoal === 'lose_weight' ? 'budget (stay under)' : 'target (kcal / day)'}
                      </label>
                      <input type="number" min={1000} max={5000} step={50} placeholder="2200"
                        value={goals.goal_calories_day}
                        onChange={(e) => setGoals((g) => ({ ...g, goal_calories_day: e.target.value }))}
                        className={`${GOALS_INPUT} tabular-nums`} />
                    </div>
                  )}
                </div>
              </div>

              {/* Sleep */}
              <div className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/35 via-white to-white p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/12 text-indigo-700 shadow-sm ring-1 ring-indigo-900/10">
                    <Moon className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-sm font-semibold text-text-primary">Sleep</h3>
                    <p className="text-[11px] text-text-muted mt-0.5">Nightly hours you&apos;re aiming for</p>
                  </div>
                </div>
                <GoalFormTip title="Rest & recovery" tone="indigo">
                  {habitTipsForGoal.sleep}
                </GoalFormTip>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1.5">Hours / night</label>
                  <input type="number" min={4} max={12} step={0.5} placeholder={String(RECOMMENDED_SLEEP_HOURS_BY_GOAL[fitnessGoal])}
                    value={goals.goal_sleep_hours}
                    onChange={(e) => setGoals((g) => ({ ...g, goal_sleep_hours: e.target.value }))}
                    className={`${GOALS_INPUT} max-w-[10rem] tabular-nums`} />
                  <p className="mt-2 text-[11px] text-text-muted leading-relaxed rounded-lg bg-indigo-50/50 border border-indigo-100/80 px-3 py-2.5 max-w-[calc(100vw-2rem)] sm:max-w-md">
                    {formatRecommendedSleepLine(fitnessGoal, goalBadgeLabel)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={goalsSaving} className="btn-primary flex items-center gap-2 text-sm">
                  <Check className="w-3.5 h-3.5" />
                  {goalsSaving ? 'Saving…' : 'Save goals'}
                </button>
                {hasAnyGoals && (
                  <button type="button" onClick={() => { setEditingGoals(false); setGoalChangeWarning(false); setGoalsFieldError(null); }} className="btn-ghost text-sm">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Workout */}
              <div className="rounded-xl border border-[#FF6B35]/20 bg-[#FF6B35]/5 p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#FF6B35]/15 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-[#FF6B35]" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B35]">Workout</span>
                </div>
                <ul className="space-y-1.5">
                  {(profile.goal_workout_types?.length ?? 0) > 0 && (
                    <li className="text-sm font-semibold text-text-primary">
                      {(profile.goal_workout_types ?? [])
                        .map((v) => WORKOUT_TYPES.find((t) => t.value === v)?.label ?? v)
                        .join(' · ')}
                    </li>
                  )}
                  {profile.goal_workout_mins_week != null && (
                    <li className="text-sm text-text-secondary">
                      {minsToHoursDisplay(profile.goal_workout_mins_week)} / week
                    </li>
                  )}
                  {profile.goal_workout_days_week != null && (
                    <li className="text-sm text-text-secondary">{profile.goal_workout_days_week} days/week</li>
                  )}
                  {profile.goal_steps_day != null && (
                    <li className="text-sm text-text-secondary">
                      🚶 {profile.goal_steps_day.toLocaleString()} steps/day
                    </li>
                  )}
                  {!profile.goal_workout_mins_week &&
                    !profile.goal_workout_days_week &&
                    !(profile.goal_workout_types?.length ?? 0) && (
                    <li className="text-sm text-text-muted">Not set</li>
                  )}
                </ul>
              </div>

              {/* Food */}
              <div className="rounded-xl border border-amber-300/30 bg-amber-50/60 p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <Utensils className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Food</span>
                  {profile.food_tracking_mode && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-medium capitalize">
                      {profile.food_tracking_mode.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {profile.goal_water_liters != null && (
                    <li className="text-sm text-text-secondary">{profile.goal_water_liters} L water/day</li>
                  )}
                  {profile.goal_protein_g_day != null && (
                    <li className="text-sm font-semibold text-text-primary">
                      {profile.goal_protein_g_day} g <span className="text-xs font-normal text-text-muted">protein/day</span>
                      {(profile.current_weight ?? profile.starting_weight) != null &&
                        (profile.current_weight ?? profile.starting_weight)! > 0 && (
                        <span className="block text-[11px] font-normal text-text-muted mt-0.5">
                          ≈{' '}
                          {(profile.goal_protein_g_day / (profile.current_weight ?? profile.starting_weight)!).toFixed(1)}
                          {' g/kg × '}
                          {(profile.current_weight ?? profile.starting_weight)!.toFixed(1)} kg
                        </span>
                      )}
                    </li>
                  )}
                  {profile.goal_calories_day != null && (
                    <li className="text-sm text-text-secondary">
                      {profile.goal_calories_day.toLocaleString()} kcal/day
                    </li>
                  )}
                  {!profile.goal_water_liters && !profile.goal_protein_g_day && !profile.goal_calories_day && (
                    <li className="text-sm text-text-muted">Not set</li>
                  )}
                </ul>
              </div>

              {/* Sleep */}
              <div className="rounded-xl border border-indigo-300/30 bg-indigo-50/60 p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                    <Moon className="w-4 h-4 text-indigo-500" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">Sleep</span>
                </div>
                <p className="text-sm font-semibold text-text-primary">
                  {(profile.goal_sleep_hours ?? profile.goal_sleep_hours_min) != null
                    ? <>{profile.goal_sleep_hours ?? profile.goal_sleep_hours_min} h <span className="text-xs font-normal text-text-muted">/ night</span></>
                    : <span className="font-normal text-text-muted">Not set</span>
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          WEIGHT & POINTS HISTORY
      ══════════════════════════════════════ */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-muted mb-2">
          <Target className="w-4 h-4 text-accent-gold" />
          Weight & Points History
        </h3>
        <p className="text-xs text-text-muted mb-5">
          Log weight via <strong>New Entry</strong> — updates your weekly weigh-in and current weight above.
        </p>

        {weightHistory.length > 0 && (
          <div className="glass-card p-5 mb-6">
            <h4 className="font-medium text-text-primary mb-3">Weight (weekly)</h4>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weightChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={38} />
                  <Tooltip formatter={(v) => [`${v} kg`, 'Weight']} labelFormatter={(l) => l} />
                  <Line type="monotone" dataKey="weight_kg" stroke="var(--accent-green)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {entryHistory.length > 0 && (
          <div className="glass-card p-5">
            <h4 className="font-medium text-text-primary mb-3">Daily points (last 90 days)</h4>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={entryHistory.slice(0, 90).reverse()} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} width={38} />
                  <Tooltip formatter={(v) => [`${v} pts`, 'Points']} labelFormatter={(l) => l} />
                  <Line type="monotone" dataKey="daily_points" stroke="var(--accent-gold)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {weightHistory.length === 0 && entryHistory.length === 0 && (
          <div className="glass-card p-8 text-center">
            <p className="text-sm text-text-muted">No history yet. Start logging from <strong>New Entry</strong>.</p>
          </div>
        )}
      </div>
    </div>
  );
}
