'use client';

const PRESETS = [0, 2000, 5000, 7500, 10000, 15000];

interface StepsStepperProps {
  value: number | null;
  onChange: (value: number | null) => void;
  className?: string;
}

export function StepsStepper({ value, onChange, className = '' }: StepsStepperProps) {
  const displayValue = value ?? 0;

  return (
    <div className={className}>
      <p className="text-sm font-medium text-text-secondary mb-2">Steps</p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n === 0 ? null : n)}
            className={`min-h-[44px] px-4 rounded-xl border-2 font-medium transition-all touch-manipulation ${
              (value === n) || (n === 0 && value === null)
                ? 'border-primary-orange bg-primary-orange/10 text-primary-orange'
                : 'border-white/20 bg-surface-0/50 text-text-secondary hover:border-white/30'
            }`}
          >
            {n === 0 ? 'None' : n >= 1000 ? `${n / 1000}k` : n}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <label className="text-xs font-medium text-text-secondary shrink-0">Custom:</label>
        <input
          type="number"
          min={0}
          max={100000}
          step={500}
          value={displayValue === 0 && value !== 0 ? '' : displayValue}
          onChange={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value);
            onChange(v != null && !Number.isNaN(v) ? v : null);
          }}
          placeholder="e.g. 8500"
          className="flex-1 min-w-0 max-w-[140px] min-h-[44px] py-2.5 px-4 rounded-xl border-2 border-black/10 bg-white text-text-primary text-sm font-medium transition-all focus:border-primary-orange/50 focus:outline-none focus:ring-2 focus:ring-primary-orange/10"
        />
      </div>
    </div>
  );
}
