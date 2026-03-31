'use client';

import { useState, useRef, useEffect } from 'react';
import type { FitnessGoal, FoodTrackingMode, WorkoutGoalType } from '@/lib/types';
import { parseGoalWorkoutTypes } from '@/lib/workout-goals';
import { recommendedProteinGDay, formatProteinRecommendationLine } from '@/lib/protein-recommendations';
import { getGoalHabitTips } from '@/lib/goal-habit-tips';
import {
  CALORIE_MULTIPLIERS_PER_KG,
  RECOMMENDED_SLEEP_HOURS_BY_GOAL,
  RECOMMENDED_WATER_LITERS_BY_GOAL,
  RECOMMENDED_WORKOUT_DAYS_WEEK_BY_GOAL,
  RECOMMENDED_WORKOUT_MINS_WEEK_BY_GOAL,
  formatRecommendedSleepLine,
  formatRecommendedWaterLine,
  formatRecommendedWorkoutWeeklyVolumeLine,
  formatRecommendedWorkoutDaysLine,
} from '@/lib/goal-defaults';

interface GoalSetupWizardProps {
  isNewUser: boolean;
  /** Pre-filled profile data for existing users editing goals */
  existingProfile?: {
    display_name?: string;
    fitness_goal?: FitnessGoal | null;
    food_tracking_mode?: FoodTrackingMode | null;
    goal_protein_g_day?: number | null;
    goal_calories_day?: number | null;
    goal_sleep_hours?: number | null;
    goal_water_liters?: number | null;
    goal_workout_mins_week?: number | null;
    goal_workout_days_week?: number | null;
    goal_workout_types?: WorkoutGoalType[] | null;
    /** @deprecated migrated to goal_workout_types */
    goal_workout_type?: WorkoutGoalType | null;
    current_weight?: number | null;
    height_cm?: number | null;
    age?: number | null;
    gender?: string | null;
  };
  onComplete: (profile: Record<string, unknown>) => void;
  onCancel?: () => void;
}

const FITNESS_GOALS: {
  value: FitnessGoal;
  label: string;
  emoji: string;
  who: string;
  description: string;
  calorieMode: 'cut' | 'surplus' | 'flexible';
  calorieModeLabel: string;
  calorieModeHint: string;
  scoring: string;
  color: string;
}[] = [
  {
    value: 'lose_weight',
    label: 'Lose Weight',
    emoji: '🔥',
    who: 'I want to burn fat',
    description: 'You eat in a calorie deficit to shed body fat while keeping as much muscle as possible. Regular cardio and moderate protein are key.',
    calorieMode: 'cut',
    calorieModeLabel: 'Calorie deficit',
    calorieModeHint: 'Points awarded for staying at or under your daily calorie target.',
    scoring: 'Food points: stay ≤ your calorie budget → full points',
    color: 'rose',
  },
  {
    value: 'gain_muscle',
    label: 'Gain Muscle',
    emoji: '💪',
    who: 'I want to build lean muscle',
    description: 'You eat in a small calorie surplus with high protein to support strength training. The goal is more muscle, not just more weight.',
    calorieMode: 'surplus',
    calorieModeLabel: 'Calorie surplus',
    calorieModeHint: 'Points awarded for hitting ≥ 90% of your calorie AND protein targets.',
    scoring: 'Food points: hit ≥ 90% of calorie + protein targets → full points',
    color: 'indigo',
  },
  {
    value: 'gain_weight',
    label: 'Gain Weight',
    emoji: '📈',
    who: 'I want to add overall mass',
    description: 'You eat a larger calorie surplus to gain both muscle and body weight — useful if you are underweight or in a hard bulk phase.',
    calorieMode: 'surplus',
    calorieModeLabel: 'Calorie surplus',
    calorieModeHint: 'Points awarded for hitting or exceeding your calorie fuel target.',
    scoring: 'Food points: meet or exceed your calorie target → full points',
    color: 'emerald',
  },
  {
    value: 'stay_active',
    label: 'Stay Active',
    emoji: '🏃',
    who: 'I want to stay fit and consistent',
    description: 'No aggressive cut or bulk — you want to keep moving, stay healthy, and build reliable daily habits around exercise and nutrition.',
    calorieMode: 'flexible',
    calorieModeLabel: 'Maintenance calories',
    calorieModeHint: 'Eat around your maintenance level. Points scale with what you log — suited for people who are not actively cutting or bulking.',
    scoring: 'Food points: log any food data to earn points',
    color: 'amber',
  },
  {
    value: 'general_wellness',
    label: 'General Wellness',
    emoji: '🧘',
    who: 'I want to feel better overall',
    description: 'Your focus is sleep quality, hydration, stress, and general health — not a specific physique goal. Gentle movement and balanced eating.',
    calorieMode: 'flexible',
    calorieModeLabel: 'Balanced eating',
    calorieModeHint: 'Scoring rewards balanced habits — food variety, sleep and hydration — not hitting a specific macro target.',
    scoring: 'Food points: log any food data to earn points',
    color: 'violet',
  },
];

const WORKOUT_TYPES: { value: WorkoutGoalType; label: string; description: string; emoji: string }[] = [
  { value: 'strength',     label: 'Strength Training', emoji: '🏋️', description: 'Gym, barbells, machines, bodyweight' },
  { value: 'running',      label: 'Running',           emoji: '🏃', description: 'Outdoor / treadmill running and jogging' },
  { value: 'team_sports',  label: 'Team Sports',       emoji: '⚽', description: 'Cricket, football, basketball, volleyball, hockey' },
  { value: 'racket_sports',label: 'Racket Sports',     emoji: '🏸', description: 'Badminton, tennis, squash, table tennis' },
  { value: 'martial_arts', label: 'Martial Arts',      emoji: '🥊', description: 'Jiujitsu, boxing, wrestling, MMA, karate' },
  { value: 'cycling',      label: 'Cycling',           emoji: '🚴', description: 'Road cycling, spinning, mountain biking' },
  { value: 'swimming',     label: 'Swimming',          emoji: '🏊', description: 'Laps, open water, water polo' },
  { value: 'yoga',         label: 'Yoga / Flexibility',emoji: '🧘', description: 'Yoga, pilates, stretching, mobility' },
  { value: 'crossfit',     label: 'CrossFit / HIIT',   emoji: '⚡', description: 'CrossFit, boot camp, HIIT circuits' },
  { value: 'walking',      label: 'Walking',           emoji: '🚶', description: 'Daily walking, light hiking, trekking' },
  { value: 'cardio_mix',   label: 'Mixed Cardio',      emoji: '🔄', description: 'Mix of cardio modalities — nothing fixed' },
];

function colorClasses(color: string, selected: boolean) {
  const map: Record<string, { border: string; bg: string; badge: string }> = {
    rose:   { border: 'border-rose-400',   bg: 'bg-rose-50',   badge: 'bg-rose-100 text-rose-700' },
    indigo: { border: 'border-indigo-400', bg: 'bg-indigo-50', badge: 'bg-indigo-100 text-indigo-700' },
    emerald:{ border: 'border-emerald-400',bg: 'bg-emerald-50',badge: 'bg-emerald-100 text-emerald-700' },
    amber:  { border: 'border-amber-400',  bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700' },
    violet: { border: 'border-violet-400', bg: 'bg-violet-50', badge: 'bg-violet-100 text-violet-700' },
  };
  const c = map[color] ?? map.amber;
  return selected
    ? `${c.border} ${c.bg} border-2`
    : 'border border-gray-200 bg-white hover:border-gray-300';
}

export default function GoalSetupWizard({ isNewUser, existingProfile, onComplete, onCancel }: GoalSetupWizardProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebratePayload, setCelebratePayload] = useState<Record<string, unknown> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!celebratePayload) return;
    const id = window.setTimeout(() => {
      onCompleteRef.current(celebratePayload);
      setCelebratePayload(null);
    }, 3200);
    return () => window.clearTimeout(id);
  }, [celebratePayload]);

  // Step 1 fields
  const [displayName, setDisplayName] = useState(existingProfile?.display_name ?? '');
  const [age, setAge] = useState(existingProfile?.age ? String(existingProfile.age) : '');
  const [gender, setGender] = useState(existingProfile?.gender ?? '');
  const [heightCm, setHeightCm] = useState(existingProfile?.height_cm ? String(existingProfile.height_cm) : '');
  const [weightKg, setWeightKg] = useState(existingProfile?.current_weight ? String(existingProfile.current_weight) : '');
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>(existingProfile?.fitness_goal ?? 'stay_active');

  // Step 2 fields
  const weight = parseFloat(weightKg) || 70;
  const suggestedProtein = recommendedProteinGDay(weight, fitnessGoal);
  const suggestedCalories = Math.round(weight * CALORIE_MULTIPLIERS_PER_KG[fitnessGoal]);

  const [foodMode, setFoodMode] = useState<FoodTrackingMode>(existingProfile?.food_tracking_mode ?? 'protein_only');
  const [proteinGoal, setProteinGoal] = useState(existingProfile?.goal_protein_g_day ? String(existingProfile.goal_protein_g_day) : '');
  const [calorieGoal, setCalorieGoal] = useState(existingProfile?.goal_calories_day ? String(existingProfile.goal_calories_day) : '');
  const [sleepHours, setSleepHours] = useState(existingProfile?.goal_sleep_hours ? String(existingProfile.goal_sleep_hours) : '');
  const [waterLiters, setWaterLiters] = useState(existingProfile?.goal_water_liters ? String(existingProfile.goal_water_liters) : '');
  const [workoutMins, setWorkoutMins] = useState(existingProfile?.goal_workout_mins_week ? String(existingProfile.goal_workout_mins_week) : '');
  const [workoutDays, setWorkoutDays] = useState(existingProfile?.goal_workout_days_week ? String(existingProfile.goal_workout_days_week) : '');
  const [workoutTypes, setWorkoutTypes] = useState<WorkoutGoalType[]>(() => {
    const fromProfile = parseGoalWorkoutTypes(
      existingProfile?.goal_workout_types ?? existingProfile?.goal_workout_type
    );
    return fromProfile.length > 0 ? fromProfile : ['cardio_mix'];
  });

  function toggleWorkoutType(t: WorkoutGoalType) {
    setWorkoutTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function applyGoalDefaults(goal: FitnessGoal) {
    setFitnessGoal(goal);
    const w = parseFloat(weightKg) || 70;
    if (!sleepHours) setSleepHours(String(RECOMMENDED_SLEEP_HOURS_BY_GOAL[goal]));
    if (!waterLiters) setWaterLiters(String(RECOMMENDED_WATER_LITERS_BY_GOAL[goal]));
    if (!workoutMins) setWorkoutMins(String(RECOMMENDED_WORKOUT_MINS_WEEK_BY_GOAL[goal]));
    if (!workoutDays) setWorkoutDays(String(RECOMMENDED_WORKOUT_DAYS_WEEK_BY_GOAL[goal]));
    if (!proteinGoal) setProteinGoal(String(recommendedProteinGDay(w, goal)));
    if (!calorieGoal) setCalorieGoal(String(Math.round(w * CALORIE_MULTIPLIERS_PER_KG[goal])));
  }

  function handleGoalSelect(goal: FitnessGoal) {
    applyGoalDefaults(goal);
  }

  function validateStep1(): string | null {
    if (isNewUser && !displayName.trim()) return 'Display name is required';
    if (isNewUser && (!age || isNaN(Number(age)) || Number(age) < 10 || Number(age) > 120)) return 'Enter a valid age (10–120)';
    if (isNewUser && !['male', 'female', 'other'].includes(gender)) return 'Please select your gender';
    if (isNewUser && (!heightCm || isNaN(Number(heightCm)) || Number(heightCm) < 50 || Number(heightCm) > 300)) return 'Enter a valid height (50–300 cm)';
    if (!weightKg || isNaN(Number(weightKg)) || Number(weightKg) < 20 || Number(weightKg) > 500) return 'Enter a valid weight (20–500 kg)';
    return null;
  }

  async function handleFinish() {
    const protein = parseFloat(proteinGoal) || suggestedProtein;
    const calories = parseFloat(calorieGoal) || suggestedCalories;
    const sleep = parseFloat(sleepHours) || RECOMMENDED_SLEEP_HOURS_BY_GOAL[fitnessGoal];
    const water = parseFloat(waterLiters) || RECOMMENDED_WATER_LITERS_BY_GOAL[fitnessGoal];
    const mins = parseInt(workoutMins) || RECOMMENDED_WORKOUT_MINS_WEEK_BY_GOAL[fitnessGoal];
    const days = parseInt(workoutDays) || RECOMMENDED_WORKOUT_DAYS_WEEK_BY_GOAL[fitnessGoal];

    if (workoutTypes.length === 0) {
      setError('Select at least one workout type.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (isNewUser) {
        const res = await fetch('/api/users/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_name: displayName.trim(),
            age: Number(age),
            gender,
            height_cm: Number(heightCm),
            current_weight: Number(weightKg),
            fitness_goal: fitnessGoal,
            food_tracking_mode: foodMode,
            goal_protein_g_day: foodMode !== 'calories_only' ? protein : null,
            goal_calories_day: foodMode !== 'protein_only' ? calories : null,
            goal_sleep_hours: sleep,
            goal_water_liters: water,
            goal_workout_mins_week: mins,
            goal_workout_days_week: days,
            goal_workout_types: workoutTypes,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          setError(d.error ?? 'Setup failed');
          setSaving(false);
          return;
        }
        const data = await res.json();
        setSaving(false);
        setCelebratePayload(data);
        return;
      } else {
        const res = await fetch('/api/users/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_weight: Number(weightKg),
            fitness_goal: fitnessGoal,
            food_tracking_mode: foodMode,
            goal_protein_g_day: foodMode !== 'calories_only' ? protein : null,
            goal_calories_day: foodMode !== 'protein_only' ? calories : null,
            goal_sleep_hours: sleep,
            goal_water_liters: water,
            goal_workout_mins_week: mins,
            goal_workout_days_week: days,
            goal_workout_types: workoutTypes,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          setError(d.error ?? 'Update failed');
          setSaving(false);
          return;
        }
        const data = await res.json();
        setSaving(false);
        setCelebratePayload(data);
        return;
      }
    } catch {
      setError('Network error, please try again');
      setSaving(false);
    }
  }

  if (celebratePayload) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-emerald-50/40 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="text-5xl mb-5 select-none" aria-hidden>
          ✨
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          {isNewUser ? "You're all set!" : 'Goals saved!'}
        </h2>
        <p className="mt-4 text-lg sm:text-xl font-semibold text-indigo-600">
          Let&apos;s get set — go!
        </p>
        <p className="mt-3 text-sm text-gray-600 max-w-md leading-relaxed">
          {isNewUser
            ? 'Your targets are locked in. Small, steady wins beat perfect weeks — we’re cheering you on.'
            : 'Nice work updating your plan. Keep showing up — consistency is the secret sauce.'}
        </p>
        <p className="mt-8 text-xs text-gray-400">Heading to your dashboard…</p>
      </div>
    );
  }

  const habitTips = getGoalHabitTips(fitnessGoal);

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {isNewUser ? 'Set Up Your Health Goals' : 'Update Your Goals'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Step {step} of 2</p>
          <div className="mt-3 flex gap-2 justify-center">
            <div className={`h-1.5 w-16 rounded-full ${step >= 1 ? 'bg-indigo-500' : 'bg-gray-200'}`} />
            <div className={`h-1.5 w-16 rounded-full ${step >= 2 ? 'bg-indigo-500' : 'bg-gray-200'}`} />
          </div>
        </div>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Basic info — only for new users */}
            {isNewUser && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <h2 className="font-semibold text-gray-800">About you</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name in the leaderboard"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="e.g. 28"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                    <input
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      placeholder="e.g. 175"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="e.g. 72"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Weight for existing users */}
            {!isNewUser && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Weight (kg)</label>
                <input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="e.g. 72"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <p className="mt-1 text-xs text-gray-500">Used to auto-suggest protein and calorie targets</p>
              </div>
            )}

            {/* Fitness goal cards */}
            <div>
              <h2 className="font-semibold text-gray-800 mb-1">What is your primary fitness goal?</h2>
              <p className="text-xs text-gray-500 mb-3">This affects how your food points are calculated — not just a label.</p>
              <div className="grid grid-cols-1 gap-3">
                {FITNESS_GOALS.map((g) => {
                  const selected = fitnessGoal === g.value;
                  const calChipCls =
                    g.calorieMode === 'cut'
                      ? 'bg-rose-100 text-rose-700'
                      : g.calorieMode === 'surplus'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-600';
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => handleGoalSelect(g.value)}
                      className={`rounded-xl p-4 text-left transition-all ${colorClasses(g.color, selected)}`}
                    >
                      {/* Header row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{g.emoji}</span>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm leading-tight">{g.label}</p>
                            <p className="text-[11px] text-gray-500 leading-tight">{g.who}</p>
                          </div>
                        </div>
                        {selected && (
                          <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs flex-shrink-0">✓</span>
                        )}
                      </div>

                      {/* Description — visible only when selected */}
                      {selected && (
                        <p className="mt-2.5 text-xs text-gray-600 leading-relaxed">{g.description}</p>
                      )}

                      {/* Scoring chip — always visible */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${calChipCls}`}>
                          {g.calorieModeLabel}
                        </span>
                        <span className="text-[10px] text-gray-500">{g.calorieModeHint}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const err = validateStep1();
                  if (err) { setError(err); return; }
                  setError(null);
                  // Pre-fill step 2 defaults
                  const w = parseFloat(weightKg) || 70;
                  if (!sleepHours) setSleepHours(String(RECOMMENDED_SLEEP_HOURS_BY_GOAL[fitnessGoal]));
                  if (!waterLiters) setWaterLiters(String(RECOMMENDED_WATER_LITERS_BY_GOAL[fitnessGoal]));
                  if (!workoutMins) setWorkoutMins(String(RECOMMENDED_WORKOUT_MINS_WEEK_BY_GOAL[fitnessGoal]));
                  if (!workoutDays) setWorkoutDays(String(RECOMMENDED_WORKOUT_DAYS_WEEK_BY_GOAL[fitnessGoal]));
                  if (!proteinGoal) setProteinGoal(String(recommendedProteinGDay(w, fitnessGoal)));
                  if (!calorieGoal) setCalorieGoal(String(Math.round(w * CALORIE_MULTIPLIERS_PER_KG[fitnessGoal])));
                  setStep(2);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
              >
                Next: Set Daily Targets →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Sleep */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <span>🌙</span> Sleep Goal
              </h2>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Hours per night</label>
                <input
                  type="number"
                  min="4"
                  max="12"
                  step="0.5"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                  className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {formatRecommendedSleepLine(fitnessGoal, FITNESS_GOALS.find((g) => g.value === fitnessGoal)?.label ?? 'your goal')}
                </p>
                <div className="rounded-lg bg-indigo-50/90 border border-indigo-100 px-3 py-2.5 mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800/90 mb-1">Good sleep</p>
                  <p className="text-[11px] text-indigo-900/85 leading-relaxed">{habitTips.sleep}</p>
                </div>
              </div>
            </div>

            {/* Water */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <span>💧</span> Water Goal
              </h2>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Litres per day</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  step="0.5"
                  value={waterLiters}
                  onChange={(e) => setWaterLiters(e.target.value)}
                  className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {formatRecommendedWaterLine(fitnessGoal, FITNESS_GOALS.find((g) => g.value === fitnessGoal)?.label ?? 'your goal')}
                </p>
                <div className="rounded-lg bg-sky-50/90 border border-sky-100 px-3 py-2.5 mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800/90 mb-1">Hydration</p>
                  <p className="text-[11px] text-sky-900/85 leading-relaxed">{habitTips.water}</p>
                </div>
              </div>
            </div>

            {/* Workout */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <span>💪</span> Workout Goal
              </h2>
              <div className="rounded-lg bg-amber-50/90 border border-amber-100 px-3 py-2.5 mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/90 mb-1">Training for your goal</p>
                <p className="text-[11px] text-amber-900/85 leading-relaxed">{habitTips.workout}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Workout types <span className="text-gray-400">(select all that apply)</span></label>
                <div className="flex flex-wrap gap-2">
                  {WORKOUT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => toggleWorkoutType(t.value)}
                      title={t.description}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        workoutTypes.includes(t.value)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{t.emoji}</span>{t.label}
                    </button>
                  ))}
                </div>
                {workoutTypes.length > 0 && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    {workoutTypes
                      .map((v) => WORKOUT_TYPES.find((x) => x.value === v)?.description)
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Days per week</label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={workoutDays}
                    onChange={(e) => setWorkoutDays(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formatRecommendedWorkoutDaysLine(fitnessGoal, FITNESS_GOALS.find((g) => g.value === fitnessGoal)?.label ?? 'your goal')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Minutes per week</label>
                  <input
                    type="number"
                    min="30"
                    max="600"
                    step="10"
                    value={workoutMins}
                    onChange={(e) => setWorkoutMins(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formatRecommendedWorkoutWeeklyVolumeLine(fitnessGoal, FITNESS_GOALS.find((g) => g.value === fitnessGoal)?.label ?? 'your goal')}
                  </p>
                </div>
              </div>
            </div>

            {/* Food tracking */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <span>🥗</span> Food Tracking Mode
              </h2>
              <div className="space-y-2">
                {([
                  { value: 'protein_only', label: 'Track Protein Only', description: 'Set a daily protein gram target' },
                  { value: 'calories_only', label: 'Track Calories Only', description: 'Set a daily calorie budget (direction-aware)' },
                  { value: 'both', label: 'Track Both', description: 'Protein + calories — earn points independently for each' },
                ] as { value: FoodTrackingMode; label: string; description: string }[]).map((m) => (
                  <label
                    key={m.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      foodMode === m.value ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="food_mode"
                      value={m.value}
                      checked={foodMode === m.value}
                      onChange={() => setFoodMode(m.value)}
                      className="mt-0.5 accent-indigo-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{m.label}</p>
                      <p className="text-xs text-gray-500">{m.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Protein target */}
              {(foodMode === 'protein_only' || foodMode === 'both') && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Daily protein target (g)</label>
                  <input
                    type="number"
                    min="30"
                    max="400"
                    value={proteinGoal}
                    onChange={(e) => setProteinGoal(e.target.value)}
                    className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                    {formatProteinRecommendationLine(weight, fitnessGoal)}
                  </p>
                </div>
              )}

              {/* Calorie target */}
              {(foodMode === 'calories_only' || foodMode === 'both') && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Daily calorie {fitnessGoal === 'lose_weight' ? 'budget (stay under)' : 'target (hit or exceed)'}
                  </label>
                  <input
                    type="number"
                    min="1000"
                    max="5000"
                    step="50"
                    value={calorieGoal}
                    onChange={(e) => setCalorieGoal(e.target.value)}
                    className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Based on your weight ({weightKg || '?'} kg), we suggest {suggestedCalories} kcal/day
                    ({CALORIE_MULTIPLIERS_PER_KG[fitnessGoal]} kcal/kg)
                  </p>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setError(null); setStep(1); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : isNewUser ? 'Start Tracking →' : 'Save Goals →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
