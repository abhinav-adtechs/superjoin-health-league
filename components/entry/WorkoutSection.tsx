'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronUp, Footprints, Bike, Waves, Mountain, Circle, Activity, MoreHorizontal } from 'lucide-react';
import type { CardioType, WorkoutGoalType } from '@/lib/types';
import { getMovementLogSectionVisibility } from '@/lib/workout-goals';
import { SliderField } from './SliderField';
import { StepsStepper } from './StepsStepper';

const CARDIO_OPTIONS: { id: CardioType; label: string; icon: typeof Activity }[] = [
  { id: 'running', label: 'Running', icon: Footprints },
  { id: 'cycling', label: 'Cycling', icon: Bike },
  { id: 'swimming', label: 'Swimming', icon: Waves },
  { id: 'walking', label: 'Walking', icon: Footprints },
  { id: 'hiking', label: 'Hiking', icon: Mountain },
  { id: 'football', label: 'Football', icon: Circle },
  { id: 'cricket', label: 'Cricket', icon: Circle },
  { id: 'basketball', label: 'Basketball', icon: Circle },
  { id: 'badminton', label: 'Badminton', icon: Activity },
  { id: 'tennis', label: 'Tennis', icon: Activity },
  { id: 'sports', label: 'Sports', icon: Activity },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
];

/** One accordion: strength minutes + cardio type/duration (both earn points; Movement pools cardio + steps). */
type TopSection = 'session' | 'steps';

interface WorkoutSectionProps {
  goalWorkoutTypes?: WorkoutGoalType[] | null;
  /** Steps logger only when user has a daily step goal set (goal_steps_day). */
  stepsGoalActive: boolean;
  workoutDuration: number;
  onWorkoutDuration: (v: number) => void;
  cardioType: CardioType | '';
  onCardioType: (v: CardioType | '') => void;
  cardioDuration: number;
  onCardioDuration: (v: number) => void;
  steps: number | null;
  onSteps: (v: number | null) => void;
  className?: string;
}

export function WorkoutSection({
  goalWorkoutTypes = null,
  stepsGoalActive,
  workoutDuration,
  onWorkoutDuration,
  cardioType,
  onCardioType,
  cardioDuration,
  onCardioDuration,
  steps,
  onSteps,
  className = '',
}: WorkoutSectionProps) {
  const vis = useMemo(
    () => getMovementLogSectionVisibility(goalWorkoutTypes ?? [], stepsGoalActive),
    [goalWorkoutTypes, stepsGoalActive],
  );

  const showSession = vis.showTraining || vis.showCardio;

  const defaultOpen = useMemo((): TopSection => {
    if (showSession) return 'session';
    return 'steps';
  }, [showSession, vis.showSteps]);

  const [openTop, setOpenTop] = useState<TopSection | null>(null);

  useEffect(() => {
    setOpenTop((prev) => {
      if (prev === null) return defaultOpen;
      if (prev === 'session' && !showSession) return vis.showSteps ? 'steps' : defaultOpen;
      if (prev === 'steps' && !vis.showSteps) return showSession ? 'session' : defaultOpen;
      return prev;
    });
  }, [defaultOpen, showSession, vis.showSteps]);

  const toggleTop = (section: TopSection) => {
    setOpenTop((prev) => (prev === section ? null : section));
  };

  const openSection: TopSection = openTop ?? defaultOpen;

  const hasTraining = workoutDuration > 0;
  const hasCardio = cardioDuration > 0 || !!cardioType;
  const hasSession = hasTraining || hasCardio;
  const hasSteps = steps != null && steps > 0;

  const renderTopSection = (
    id: TopSection,
    emoji: string,
    label: string,
    hasData: boolean,
    children: React.ReactNode,
  ) => {
    const isOpen = openSection === id;
    return (
      <div
        className={`rounded-xl border-2 overflow-hidden transition-all ${
          isOpen
            ? 'border-primary-orange/40 bg-white shadow-sm'
            : hasData
              ? 'border-accent-green/40 bg-white'
              : 'border-black/8 bg-surface-0/40'
        }`}
      >
        <button
          type="button"
          onClick={() => toggleTop(id)}
          className="w-full flex items-center justify-between px-3 py-2.5 touch-manipulation"
        >
          <span className="flex items-center gap-2 font-semibold text-sm text-text-primary">
            <span className="text-xl leading-none">{emoji}</span>
            {label}
            {hasData && !isOpen && (
              <span className="text-[10px] font-bold text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded-full">
                Logged
              </span>
            )}
          </span>
          {isOpen
            ? <ChevronUp className="w-3.5 h-3.5 text-text-muted shrink-0" />
            : <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
          }
        </button>
        {isOpen && (
          <div className="px-3 pb-3 space-y-2">
            {children}
          </div>
        )}
      </div>
    );
  };

  const hasAnyData = hasSession || hasSteps;

  const clearAll = () => {
    onWorkoutDuration(0);
    onCardioType('');
    onCardioDuration(0);
    onSteps(null);
    setOpenTop(defaultOpen);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-[11px] text-text-muted leading-snug px-0.5">
        {showSession && (
          <>
            <span className="font-medium text-text-secondary">Workout &amp; cardio</span>
            {' — '}
            Training minutes → Workout (max 20 pts). Cardio duration
            {vis.showSteps ? ' + step count' : ''} → Movement (max 25 pts); cardio and steps share that Movement cap.
          </>
        )}
        {!showSession && vis.showSteps && (
          <>
            <span className="font-medium text-text-secondary">Steps</span> — Movement points (max 25) when you track a daily step goal.
          </>
        )}
      </p>
      {hasAnyData && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-text-muted hover:text-red-500 transition-colors touch-manipulation px-2 py-1 rounded-lg hover:bg-red-50"
          >
            Clear all
          </button>
        </div>
      )}
      {showSession &&
        renderTopSection('session', '💪', 'Workout & cardio', hasSession, (
          <div className="space-y-5">
            {vis.showTraining && (
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">Strength / training</p>
                <SliderField
                  label="Workout minutes"
                  value={workoutDuration}
                  min={0}
                  max={120}
                  step={5}
                  onChange={onWorkoutDuration}
                  unit=" min"
                />
              </div>
            )}
            {vis.showCardio && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">Cardio session</p>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Cardio type</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCardioType('');
                      }}
                      className={`min-h-[44px] rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 p-1.5 transition-all touch-manipulation ${
                        !cardioType
                          ? 'border-primary-orange bg-primary-orange/10 text-primary-orange'
                          : 'border-black/10 bg-surface-0/60 text-text-muted hover:border-primary-orange/30'
                      }`}
                    >
                      <span className="text-[10px] font-medium">None</span>
                    </button>
                    {CARDIO_OPTIONS.map(({ id, label, icon: Icon }) => {
                      const isSel = cardioType === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCardioType(isSel ? '' : id);
                          }}
                          className={`min-h-[44px] rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 p-1.5 transition-all touch-manipulation ${
                            isSel
                              ? 'border-primary-orange bg-primary-orange/10 text-primary-orange'
                              : 'border-black/10 bg-surface-0/60 text-text-muted hover:border-primary-orange/30'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
                          <span className="text-[10px] font-medium leading-tight text-center">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <SliderField
                  label="Cardio duration"
                  value={cardioDuration}
                  min={0}
                  max={120}
                  step={5}
                  onChange={onCardioDuration}
                  unit=" min"
                />
              </div>
            )}
          </div>
        ))}

      {vis.showSteps &&
        renderTopSection('steps', '👟', 'Steps', hasSteps, (
          <StepsStepper value={steps} onChange={onSteps} />
        ))}
    </div>
  );
}
