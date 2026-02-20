'use client';

import {
  Dumbbell,
  Activity,
  Footprints,
  CircleDot,
  Layers,
  User,
  HelpCircle,
} from 'lucide-react';
import type { WorkoutOption } from '@/lib/types';

const BODY_PARTS: WorkoutOption[] = [
  'bicep', 'tricep', 'shoulder', 'chest', 'back', 'core',
  'quad', 'hamstring', 'glute', 'calf', 'forearm',
];
const CLUSTERS: WorkoutOption[] = ['push', 'pull', 'legs', 'full_body', 'bodyweight', 'other'];

function label(s: string): string {
  return s.replace(/_/g, ' ');
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  bicep: Dumbbell,
  tricep: Dumbbell,
  forearm: Dumbbell,
  shoulder: Dumbbell,
  chest: Dumbbell,
  back: Dumbbell,
  core: CircleDot,
  quad: Footprints,
  hamstring: Footprints,
  glute: Footprints,
  calf: Footprints,
  push: Layers,
  pull: Layers,
  legs: Footprints,
  full_body: User,
  bodyweight: User,
  other: HelpCircle,
};

function IconForOption(opt: WorkoutOption) {
  const C = ICON_MAP[opt] ?? Activity;
  return <C className="w-5 h-5" />;
}

interface WorkoutBodyGridProps {
  selected: WorkoutOption[];
  onToggle: (opt: WorkoutOption) => void;
  className?: string;
}

export function WorkoutBodyGrid({ selected, onToggle, className = '' }: WorkoutBodyGridProps) {
  return (
    <div className={className}>
      <p className="text-sm font-medium text-text-secondary mb-3">Body parts & clusters (tap to select)</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {BODY_PARTS.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`min-h-[52px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 p-2 transition-all touch-manipulation ${
                isSelected
                  ? 'border-primary-orange bg-primary-orange/10 text-primary-orange'
                  : 'border-white/20 bg-surface-0/50 text-text-muted hover:border-white/30'
              }`}
            >
              {IconForOption(opt)}
              <span className="text-[11px] font-medium leading-tight">{label(opt)}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
        {CLUSTERS.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`min-h-[52px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 p-2 transition-all touch-manipulation ${
                isSelected
                  ? 'border-primary-orange bg-primary-orange/10 text-primary-orange'
                  : 'border-white/20 bg-surface-0/50 text-text-muted hover:border-white/30'
              }`}
            >
              {IconForOption(opt)}
              <span className="text-[11px] font-medium leading-tight">{label(opt)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
