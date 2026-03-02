'use client';

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  unit?: string;
  suffix?: string;
  className?: string;
  error?: boolean;
  errorKey?: number;
  errorMessage?: string;
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = '',
  suffix = '',
  className = '',
  error = false,
  errorKey = 0,
  errorMessage,
}: SliderFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className={`text-sm font-medium transition-colors ${error ? 'text-red-500' : 'text-text-secondary'}`}>
          {label}
          {error && <span className="ml-1 text-[11px] font-semibold">← required</span>}
        </label>
        <span className={`text-sm font-semibold tabular-nums transition-colors ${error ? 'text-red-500' : 'text-text-primary'}`}>
          {value}{unit}{suffix}
        </span>
      </div>
      {/* key forces remount so the animation replays on each error trigger */}
      <div
        key={errorKey}
        className={`rounded-lg px-2 py-1 transition-colors ${error ? 'bg-red-50 border border-red-200 animate-shake' : ''}`}
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full h-8 touch-manipulation transition-all ${error ? 'accent-red-500' : 'accent-[#FF6B35]'}`}
          style={{ minHeight: 32 }}
        />
      </div>
      {error && errorMessage && (
        <p className="text-xs text-red-500 font-medium">{errorMessage}</p>
      )}
    </div>
  );
}
