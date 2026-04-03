'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import type { CardioType, FitnessGoal, Profile } from '@/lib/types';
import { recommendedProteinGDay } from '@/lib/protein-recommendations';
import { CALORIE_MULTIPLIERS_PER_KG } from '@/lib/goal-defaults';
import { DateCarousel } from '@/components/entry/DateCarousel';
import { isWithinAllowedPastRange } from '@/lib/entryDateWindow';
import { SliderField } from '@/components/entry/SliderField';
import { WorkoutSection } from '@/components/entry/WorkoutSection';
import { parseGoalWorkoutTypes } from '@/lib/workout-goals';

function safeFitnessGoal(profile: Profile): FitnessGoal {
  const g = profile.fitness_goal;
  if (g && g in CALORIE_MULTIPLIERS_PER_KG) return g;
  return 'stay_active';
}

export function getProteinTargetGrams(profile: Profile): number {
  if (profile.goal_protein_g_day != null && profile.goal_protein_g_day > 0) {
    return profile.goal_protein_g_day;
  }
  const weightKg = profile.current_weight ?? profile.starting_weight ?? 70;
  return recommendedProteinGDay(weightKg, safeFitnessGoal(profile));
}

function getCalorieTargetKcal(profile: Profile): number {
  if (profile.goal_calories_day != null && profile.goal_calories_day > 0) {
    return profile.goal_calories_day;
  }
  const weightKg = profile.current_weight ?? profile.starting_weight ?? 70;
  const fg = safeFitnessGoal(profile);
  const mult = CALORIE_MULTIPLIERS_PER_KG[fg];
  return Math.round(weightKg * mult);
}

function calorieFieldLabel(profile: Profile): string {
  const target = getCalorieTargetKcal(profile);
  const t = target.toLocaleString();
  const fg = safeFitnessGoal(profile);
  if (fg === 'lose_weight') return `Calories — stay under ~${t} kcal`;
  if (fg === 'gain_weight' || fg === 'gain_muscle') return `Calories — target ~${t} kcal/day`;
  return `Calories — log ~${t} kcal/day`;
}

export type EntryType = 'full' | 'movement' | 'meal_recovery' | 'sleep' | 'weight';

const ENTRY_TITLES: Record<EntryType, string> = {
  full: 'Log full day',
  movement: 'Log Movement',
  meal_recovery: 'Food',
  sleep: 'Sleep',
  weight: 'Weight',
};

const CTA_TEXT: Record<EntryType, string> = {
  movement: 'Log Movement 💪',
  meal_recovery: 'Log Food 🥗',
  sleep: 'Log Sleep 😴',
  weight: 'Save Weight',
  full: 'Smash it! 🎯',
};

function pointsSuccessLine(delta: number, total: number): string {
  if (delta === 0) return `${total} pts today (unchanged)`;
  if (delta < total) return `+${delta} pts from this log · ${total} pts today`;
  return `+${delta} pts`;
}

const SUCCESS_MSG: Record<EntryType, (delta: number, total: number) => string> = {
  movement: (delta, total) => `🔥 Crushed it! ${pointsSuccessLine(delta, total)}`,
  meal_recovery: (delta, total) => `🥗 Fuelled up! ${pointsSuccessLine(delta, total)}`,
  sleep: (delta, total) => `😴 Rest logged! ${pointsSuccessLine(delta, total)}`,
  weight: (_delta, _total) => '⚖️ Weight saved — not part of daily activity points',
  full: (delta, total) => `🏆 Full day locked in! ${pointsSuccessLine(delta, total)}`,
};

const WIZARD_STEPS = ['date', 'movement', 'food', 'sleep'] as const;
type WizardStep = (typeof WIZARD_STEPS)[number];

interface LogEntryModalProps {
  entryType: EntryType;
  profile: Profile;
  onClose: () => void;
  onSuccess: () => void;
}

export function LogEntryModal({ entryType, profile, onClose, onSuccess }: LogEntryModalProps) {
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const [date, setDate] = useState(today);
  const [wizardStep, setWizardStep] = useState(0);

  const [workout_duration, setWorkoutDuration] = useState(0);
  const [cardio_duration, setCardioDuration] = useState(0);
  const [cardio_type, setCardioType] = useState<CardioType | ''>('');
  const [steps, setSteps] = useState<number | null>(null);

  const [water_liters, setWaterLiters] = useState(0);
  const [protein_qty, setProteinQty] = useState(0);
  const [calories_kcal, setCaloriesKcal] = useState(0);
  const [sleep_hours, setSleepHours] = useState(7);
  /** False until slider moves or sleep step is shown; sleep-only modal starts true so default 7h still saves. */
  const [sleepCommitted, setSleepCommitted] = useState(() => entryType === 'sleep');

  const [weight_kg, setWeightKg] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const proteinTarget = getProteinTargetGrams(profile);
  const proteinMax = Math.max(150, proteinTarget + 30);
  const calorieTarget = getCalorieTargetKcal(profile);
  const calorieMax = Math.min(6000, Math.max(800, calorieTarget + 1000));

  const foodMode = profile.food_tracking_mode ?? 'protein_only';
  const showProtein = foodMode === 'protein_only' || foodMode === 'both';
  const showCalories = foodMode === 'calories_only' || foodMode === 'both';
  const stepsGoalActive = (profile.goal_steps_day ?? 0) > 0;

  const isWizard = entryType === 'full';
  const currentStep = WIZARD_STEPS[wizardStep];

  useEffect(() => {
    if (isWizard && currentStep === 'sleep') setSleepCommitted(true);
  }, [isWizard, currentStep]);

  const buildPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = { date };
    const includeMovement = entryType === 'full' || entryType === 'movement';
    const includeFood = entryType === 'full' || entryType === 'meal_recovery';
    const includeSleep = entryType === 'full' || entryType === 'sleep';
    const includeWeight = entryType === 'weight';

    if (includeMovement) {
      if (workout_duration > 0) {
        payload.workout_done = true;
        payload.workout_duration = workout_duration;
      }
      if (cardio_duration > 0 || cardio_type) {
        payload.cardio_done = true;
        if (cardio_duration > 0) payload.cardio_duration = cardio_duration;
        if (cardio_type) payload.cardio_type = cardio_type;
      }
      if (stepsGoalActive && steps != null && steps > 0) payload.steps = steps;
    }
    if (includeFood) {
      if (water_liters > 0) payload.water_liters = water_liters;
      if (showProtein && protein_qty > 0) {
        payload.protein_meal = true;
        payload.protein_qty = protein_qty;
      }
      if (showCalories && calories_kcal > 0) {
        payload.calories_kcal = Math.round(calories_kcal);
      }
    }
    if (includeSleep && sleepCommitted && sleep_hours > 0) {
      payload.sleep_hours = sleep_hours;
    }
    if (includeWeight && weight_kg != null && weight_kg > 0) {
      payload.weight_kg = weight_kg;
    }
    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWithinAllowedPastRange(date)) {
      setMessage({ type: 'error', text: 'Date must be today or up to 4 days in the past.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await fetch(apiUrl('/api/entries'), getApiFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    }));
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage({ type: 'error', text: data.error || 'Failed to save' });
      return;
    }
    const total = data.daily_points ?? 0;
    const delta =
      typeof data.points_delta === 'number' ? data.points_delta : total;
    setMessage({ type: 'ok', text: SUCCESS_MSG[entryType](delta, total) });
    onSuccess();
    setTimeout(onClose, 1200);
  };

  const isLastStep = isWizard && wizardStep === WIZARD_STEPS.length - 1;

  const renderFoodStep = () => {
    const pt = Math.max(proteinTarget, 1);
    return (
    <div className="space-y-6 py-2">
      <SliderField label="Water" value={water_liters} min={0} max={5} step={0.25} onChange={setWaterLiters} unit=" L" />
      <p className="text-[11px] text-text-muted -mt-2">
        Food fields follow your goal:{' '}
        {foodMode === 'both' ? 'protein + calories' : foodMode === 'calories_only' ? 'calories only' : 'protein only'}.
      </p>
      {showProtein && (
        <SliderField
          label={`Protein — target ~${proteinTarget}g/day`}
          value={protein_qty}
          min={0}
          max={proteinMax}
          step={5}
          onChange={setProteinQty}
          unit=" g"
          suffix={protein_qty > 0 ? ` (${Math.round((protein_qty / pt) * 100)}%)` : ''}
        />
      )}
      {showCalories && (
        <SliderField
          label={calorieFieldLabel(profile)}
          value={calories_kcal}
          min={0}
          max={calorieMax}
          step={25}
          onChange={setCaloriesKcal}
          unit=" kcal"
        />
      )}
    </div>
    );
  };

  const renderStepContent = () => {
    if (isWizard && currentStep === 'date') {
      return (
        <div className="space-y-4 py-4">
          <p className="text-sm text-text-muted text-center">Which day are you logging?</p>
          <DateCarousel value={date} onChange={setDate} />
        </div>
      );
    }

    if ((isWizard && currentStep === 'movement') || entryType === 'movement') {
      const goalTypesForMovement = parseGoalWorkoutTypes(profile.goal_workout_types);
      return (
        <WorkoutSection
          goalWorkoutTypes={goalTypesForMovement}
          stepsGoalActive={stepsGoalActive}
          workoutDuration={workout_duration}
          onWorkoutDuration={setWorkoutDuration}
          cardioType={cardio_type}
          onCardioType={setCardioType}
          cardioDuration={cardio_duration}
          onCardioDuration={setCardioDuration}
          steps={steps}
          onSteps={setSteps}
          className="py-2"
        />
      );
    }

    if ((isWizard && currentStep === 'food') || entryType === 'meal_recovery') {
      return renderFoodStep();
    }

    if ((isWizard && currentStep === 'sleep') || entryType === 'sleep') {
      return (
        <div className="py-2">
          <SliderField
            label="Sleep hours"
            value={sleep_hours}
            min={4}
            max={12}
            step={0.5}
            onChange={(v) => {
              setSleepHours(v);
              setSleepCommitted(true);
            }}
            unit=" h"
          />
        </div>
      );
    }

    if (entryType === 'weight') {
      const displayWeight = weight_kg ?? (profile.current_weight ?? 70);
      return (
        <div className="space-y-3 py-2">
          <SliderField
            label="Weight"
            value={displayWeight}
            min={30}
            max={150}
            step={0.5}
            onChange={(v) => setWeightKg(v)}
            unit=" kg"
          />
          {isWizard && (
            <button type="button" onClick={() => setWeightKg(null)} className="text-sm text-text-muted underline block">
              Leave blank
            </button>
          )}
        </div>
      );
    }

    return null;
  };

  const renderSuccessMessage = () => {
    if (!message) return null;
    if (message.type === 'error') {
      return (
        <div className="rounded-xl p-3 bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">{message.text}</p>
        </div>
      );
    }
    return (
      <div className="rounded-xl p-4 text-center bg-gradient-to-br from-primary-orange/10 via-accent-gold/10 to-accent-green/10 border border-primary-orange/20">
        <p className="text-xl mb-1">{message.text.split(' ')[0]}</p>
        <p className="font-bold text-text-primary">{message.text.slice(message.text.indexOf(' ') + 1)}</p>
      </div>
    );
  };

  const renderQuickLog = () => (
    <form onSubmit={handleSubmit} className="p-4 sm:px-5 pb-6 edge-safe-bottom space-y-5 overflow-y-auto flex-1">
      <p className="text-xs text-text-muted">Only fill what you did — everything else stays blank.</p>
      <DateCarousel value={date} onChange={setDate} />
      {renderStepContent()}
      {renderSuccessMessage()}
      <button
        type="submit"
        disabled={saving || !isWithinAllowedPastRange(date)}
        className="btn-primary w-full min-h-[52px] text-base font-bold"
      >
        {saving ? 'Saving…' : CTA_TEXT[entryType]}
      </button>
    </form>
  );

  const WIZARD_LABELS: Record<WizardStep, string> = {
    date: 'Date',
    movement: 'Movement',
    food: 'Food',
    sleep: 'Sleep',
  };

  const renderWizard = () => (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
      <div className="px-4 sm:px-5 pt-1 pb-3 flex items-center gap-1.5">
        {WIZARD_STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-1.5 flex-1 min-w-0">
            <div
              className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                i < wizardStep
                  ? 'bg-accent-green text-white'
                  : i === wizardStep
                    ? 'bg-primary-orange text-white'
                    : 'bg-black/8 text-text-muted'
              }`}
            >
              {i < wizardStep ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] font-medium truncate ${i === wizardStep ? 'text-text-primary' : 'text-text-muted'}`}>
              {WIZARD_LABELS[step]}
            </span>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={`flex-1 h-px ${i < wizardStep ? 'bg-accent-green/40' : 'bg-black/10'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-5">
        {renderStepContent()}
      </div>

      <div className="px-4 sm:px-5 pb-5 pt-3 edge-safe-bottom space-y-3 shrink-0 border-t border-black/5">
        {renderSuccessMessage()}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWizardStep((s) => Math.max(0, s - 1))}
            disabled={wizardStep === 0}
            className="btn-ghost min-h-[52px] flex-1 flex items-center justify-center gap-1 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          {!isLastStep ? (
            <button
              type="button"
              onClick={() => setWizardStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1))}
              className="btn-primary min-h-[52px] flex-1 flex items-center justify-center gap-1 font-bold"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={saving || !isWithinAllowedPastRange(date)}
              className="btn-primary min-h-[52px] flex-1 text-base font-bold"
            >
              {saving ? 'Saving…' : CTA_TEXT.full}
            </button>
          )}
        </div>
      </div>
    </form>
  );

  const modal = (
    <div className="modal-overlay entry-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content entry-modal-content flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-black/5 rounded-t-2xl px-4 sm:px-5 py-4 edge-safe-top flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-text-primary">{ENTRY_TITLES[entryType]}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] rounded-xl hover:bg-black/5 text-text-muted flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {isWizard ? renderWizard() : renderQuickLog()}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
