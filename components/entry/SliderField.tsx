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
}: SliderFieldProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-secondary">{label}</label>
        <span className="text-sm font-semibold text-text-primary tabular-nums">
          {value}
          {unit}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-8 accent-[#FF6B35] touch-manipulation"
        style={{ minHeight: 32 }}
      />
    </div>
  );
}
