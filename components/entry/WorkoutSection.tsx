'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, ArrowRight, Footprints, Bike, Waves, Mountain, Circle, Activity, MoreHorizontal } from 'lucide-react';
import type { WorkoutOption, CardioType } from '@/lib/types';
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

type MuscleGroupDef = {
  id: string;
  cluster: WorkoutOption;
  label: string;
  emoji: string;
  muscles: { opt: WorkoutOption; emoji: string; label: string }[];
};

const MUSCLE_GROUPS: MuscleGroupDef[] = [
  {
    id: 'push',
    cluster: 'push',
    label: 'Push',
    emoji: '🏋️',
    muscles: [
      { opt: 'chest', emoji: '💪', label: 'Chest' },
      { opt: 'shoulder', emoji: '🤸', label: 'Shoulder' },
      { opt: 'tricep', emoji: '💪', label: 'Tricep' },
    ],
  },
  {
    id: 'pull',
    cluster: 'pull',
    label: 'Pull',
    emoji: '🔄',
    muscles: [
      { opt: 'back', emoji: '🦾', label: 'Back' },
      { opt: 'bicep', emoji: '💪', label: 'Bicep' },
      { opt: 'forearm', emoji: '✊', label: 'Forearm' },
    ],
  },
  {
    id: 'legs',
    cluster: 'legs',
    label: 'Legs',
    emoji: '🦵',
    muscles: [
      { opt: 'quad', emoji: '🦵', label: 'Quads' },
      { opt: 'hamstring', emoji: '🦵', label: 'Hamstring' },
      { opt: 'glute', emoji: '🍑', label: 'Glutes' },
      { opt: 'calf', emoji: '🦵', label: 'Calves' },
    ],
  },
  {
    id: 'core',
    cluster: 'core',
    label: 'Core',
    emoji: '⭕',
    muscles: [
      { opt: 'core', emoji: '⭕', label: 'Core / Abs' },
    ],
  },
  {
    id: 'other',
    cluster: 'full_body',
    label: 'Other',
    emoji: '🤸',
    muscles: [
      { opt: 'full_body', emoji: '🤸', label: 'Full body' },
      { opt: 'bodyweight', emoji: '🏃', label: 'Bodyweight' },
      { opt: 'other', emoji: '🎯', label: 'Other' },
    ],
  },
];

const MUSCLE_GROUP_IDS = MUSCLE_GROUPS.map((g) => g.id);

type TopSection = 'strength' | 'cardio' | 'steps';

interface WorkoutSectionProps {
  selected: WorkoutOption[];
  onChangeSelected: (v: WorkoutOption[]) => void;
  workoutDuration: number;
  onWorkoutDuration: (v: number) => void;
  cardioType: CardioType | '';
  onCardioType: (v: CardioType | '') => void;
  cardioDuration: number;
  onCardioDuration: (v: number) => void;
  steps: number | null;
  onSteps: (v: number | null) => void;
  className?: string;
  durationError?: boolean;
  durationErrorKey?: number;
}

export function WorkoutSection({
  selected,
  onChangeSelected,
  workoutDuration,
  onWorkoutDuration,
  cardioType,
  onCardioType,
  cardioDuration,
  onCardioDuration,
  steps,
  onSteps,
  className = '',
  durationError = false,
  durationErrorKey = 0,
}: WorkoutSectionProps) {
  const [openTop, setOpenTop] = useState<TopSection | null>('strength');
  const [openMuscleGroup, setOpenMuscleGroup] = useState<string>('push');

  // Auto-open Strength section when a duration error is triggered so the user can see it
  useEffect(() => {
    if (durationError) setOpenTop('strength');
  }, [durationErrorKey, durationError]);

  const toggleTop = (section: TopSection) => {
    setOpenTop((prev) => (prev === section ? null : section));
  };

  const openNextMuscleGroup = (currentId: string) => {
    const idx = MUSCLE_GROUP_IDS.indexOf(currentId);
    const nextId = MUSCLE_GROUP_IDS[idx + 1];
    if (nextId) setOpenMuscleGroup(nextId);
  };

  const toggleMuscle = (opt: WorkoutOption) => {
    onChangeSelected(
      selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]
    );
  };

  const toggleCluster = (cluster: WorkoutOption) => {
    onChangeSelected(
      selected.includes(cluster) ? selected.filter((o) => o !== cluster) : [...selected, cluster]
    );
  };

  // Derived state
  const hasStrength = selected.length > 0 || workoutDuration > 0;
  const hasCardio = cardioDuration > 0 || !!cardioType;
  const hasSteps = steps != null && steps > 0;

  const renderMuscleGroup = (group: MuscleGroupDef) => {
    const isOpen = openMuscleGroup === group.id;
    const clusterSelected = selected.includes(group.cluster);
    const musclesSelected = group.muscles.filter((m) => selected.includes(m.opt));
    const hasSelection = clusterSelected || musclesSelected.length > 0;
    const isLast = MUSCLE_GROUP_IDS.indexOf(group.id) === MUSCLE_GROUP_IDS.length - 1;

    return (
      <div
        key={group.id}
        className={`rounded-xl border-2 overflow-hidden transition-all ${
          isOpen
            ? 'border-primary-orange/40 bg-white shadow-sm'
            : hasSelection
              ? 'border-accent-green/40 bg-white'
              : 'border-black/8 bg-surface-0/40'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpenMuscleGroup(group.id)}
          className="w-full flex items-center justify-between px-3 py-2 touch-manipulation"
        >
          <span className="flex items-center gap-2 font-semibold text-sm text-text-primary">
            <span className="text-xl leading-none">{group.emoji}</span>
            {group.label}
            {hasSelection && !isOpen && (
              <span className="text-[10px] font-bold text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded-full">
                {clusterSelected ? `All ${group.label}` : `${musclesSelected.length} selected`}
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCluster(group.cluster);
              }}
              className={`w-full text-xs font-semibold py-1.5 px-3 rounded-lg border-2 transition-all touch-manipulation ${
                clusterSelected
                  ? 'border-primary-orange bg-primary-orange text-white'
                  : 'border-black/10 text-text-muted hover:border-primary-orange/30 hover:text-text-primary'
              }`}
            >
              {clusterSelected ? `✓ All ${group.label} selected` : `Select all ${group.label}`}
            </button>

            <div className="grid grid-cols-3 gap-1.5">
              {group.muscles.map(({ opt, emoji, label: musLabel }) => {
                const isSel = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMuscle(opt);
                    }}
                    className={`min-h-[48px] rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 p-1.5 transition-all touch-manipulation ${
                      isSel
                        ? 'border-primary-orange bg-primary-orange/10 text-primary-orange'
                        : 'border-black/10 bg-surface-0/60 text-text-muted hover:border-primary-orange/30'
                    }`}
                  >
                    <span className="text-lg leading-none">{emoji}</span>
                    <span className="text-[10px] font-medium leading-tight text-center">{musLabel}</span>
                  </button>
                );
              })}
            </div>

            {!isLast && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const toRemove = [group.cluster, ...group.muscles.map((m) => m.opt)];
                    onChangeSelected(selected.filter((o) => !toRemove.includes(o)));
                    openNextMuscleGroup(group.id);
                  }}
                  className="flex-1 py-1.5 rounded-lg border border-black/10 text-xs text-text-muted hover:bg-black/5 touch-manipulation"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openNextMuscleGroup(group.id);
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-primary-orange text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#E55A2B] touch-manipulation"
                >
                  Next <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTopSection = (
    id: TopSection,
    emoji: string,
    label: string,
    hasData: boolean,
    children: React.ReactNode,
  ) => {
    const isOpen = openTop === id;
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

  const hasAnyData = hasStrength || hasCardio || hasSteps;

  const clearAll = () => {
    onChangeSelected([]);
    onWorkoutDuration(0);
    onCardioType('');
    onCardioDuration(0);
    onSteps(null);
    setOpenTop('strength');
    setOpenMuscleGroup('push');
  };

  return (
    <div className={`space-y-2 ${className}`}>
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
      {/* ── Strength ── */}
      {renderTopSection('strength', '🏋️', 'Strength', hasStrength, (
        <>
          <SliderField
            label="Strength duration"
            value={workoutDuration}
            min={0}
            max={120}
            step={5}
            onChange={onWorkoutDuration}
            unit=" min"
            error={durationError}
            errorKey={durationErrorKey}
            errorMessage="Set how long your session was to log this entry."
          />
          <div className="space-y-1.5 pt-1">
            {MUSCLE_GROUPS.map(renderMuscleGroup)}
          </div>
        </>
      ))}

      {/* ── Cardio ── */}
      {renderTopSection('cardio', '🏃', 'Cardio', hasCardio, (
        <>
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
        </>
      ))}

      {/* ── Steps ── */}
      {renderTopSection('steps', '👟', 'Steps', hasSteps, (
        <StepsStepper value={steps} onChange={onSteps} />
      ))}
    </div>
  );
}
