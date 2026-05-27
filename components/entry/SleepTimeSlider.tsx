'use client';

import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/** Minutes from 6:00 PM on the sleep timeline (0 = 6 PM, 1080 = 12 PM next day). */
const TIMELINE_MIN = 0;
const TIMELINE_MAX = 18 * 60;
const STEP = 15;
const MIN_SLEEP = 4 * 60;
const MAX_SLEEP = 12 * 60;
const MIDNIGHT_ON_TIMELINE = 6 * 60;

const DEFAULT_SLEEP_MIN = 7 * 60;
const DEFAULT_BED = 6 * 60; // midnight
const DEFAULT_WAKE = DEFAULT_BED + DEFAULT_SLEEP_MIN; // 7:00 AM

function formatClockTime(extendedMinutes: number): string {
  const totalFromMidnight = 18 * 60 + extendedMinutes;
  const minutesInDay = totalFromMidnight % (24 * 60);
  const h = Math.floor(minutesInDay / 60);
  const m = minutesInDay % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function sleepHoursFromRange(bed: number, wake: number): number {
  return Math.round(((wake - bed) / 60) * 4) / 4;
}

type SleepQuality = 'poor' | 'fair' | 'good';

/** Matches scoring bands: green ≥7h, yellow 5–7h, red <5h. */
function sleepQuality(hours: number): SleepQuality {
  if (hours >= 7) return 'good';
  if (hours >= 5) return 'fair';
  return 'poor';
}

const SLEEP_QUALITY = {
  good: {
    fill: 'linear-gradient(90deg, #34d399, #059669)',
    summary: 'bg-emerald-50/90 border-emerald-200 text-emerald-900',
    summaryLabel: 'text-emerald-700/80',
    badge: 'bg-emerald-100 text-emerald-800',
    label: 'Good rest',
  },
  fair: {
    fill: 'linear-gradient(90deg, #fcd34d, #f59e0b)',
    summary: 'bg-amber-50/90 border-amber-200 text-amber-950',
    summaryLabel: 'text-amber-700/80',
    badge: 'bg-amber-100 text-amber-900',
    label: 'Fair rest',
  },
  poor: {
    fill: 'linear-gradient(90deg, #fca5a5, #ef4444)',
    summary: 'bg-red-50/90 border-red-200 text-red-950',
    summaryLabel: 'text-red-700/80',
    badge: 'bg-red-100 text-red-800',
    label: 'Short rest',
  },
} as const;

/** Log date is the morning you woke up; evening hours belong to the previous calendar day. */
function dayOffsetForTime(extendedMinutes: number, role: 'bed' | 'wake'): number {
  if (role === 'wake') return 0;
  return extendedMinutes < MIDNIGHT_ON_TIMELINE ? -1 : 0;
}

function formatDayLabel(logDate: string, dayOffset: number): string {
  const [y, m, d] = logDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d + dayOffset);
  return dt.toLocaleDateString('en-US', { weekday: 'short' });
}

interface SleepTimeSliderProps {
  logDate: string;
  onChange: (sleepHours: number) => void;
  className?: string;
}

export function SleepTimeSlider({ logDate, onChange, className = '' }: SleepTimeSliderProps) {
  const [bed, setBed] = useState(DEFAULT_BED);
  const [wake, setWake] = useState(DEFAULT_WAKE);
  const [activeThumb, setActiveThumb] = useState<'bed' | 'wake'>('wake');

  const durationMin = wake - bed;
  const sleepHours = sleepHoursFromRange(bed, wake);
  const quality = sleepQuality(sleepHours);
  const qualityStyle = SLEEP_QUALITY[quality];
  const bedDay = formatDayLabel(logDate, dayOffsetForTime(bed, 'bed'));
  const wakeDay = formatDayLabel(logDate, dayOffsetForTime(wake, 'wake'));

  const emitChange = useCallback(
    (nextBed: number, nextWake: number) => {
      onChange(sleepHoursFromRange(nextBed, nextWake));
    },
    [onChange],
  );

  useEffect(() => {
    emitChange(bed, wake);
  }, [bed, wake, emitChange]);

  const handleBedChange = (raw: number) => {
    const snapped = Math.round(raw / STEP) * STEP;
    const nextBed = Math.max(TIMELINE_MIN, wake - MAX_SLEEP, Math.min(snapped, wake - MIN_SLEEP));
    setBed(nextBed);
  };

  const handleWakeChange = (raw: number) => {
    const snapped = Math.round(raw / STEP) * STEP;
    const nextWake = Math.min(TIMELINE_MAX, bed + MAX_SLEEP, Math.max(snapped, bed + MIN_SLEEP));
    setWake(nextWake);
  };

  const bedPct = (bed / TIMELINE_MAX) * 100;
  const wakePct = (wake / TIMELINE_MAX) * 100;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className={`rounded-2xl border px-4 py-3 text-center ${qualityStyle.summary}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-wide mb-0.5 ${qualityStyle.summaryLabel}`}>
          Total sleep
        </p>
        <p className="text-2xl font-bold tabular-nums">{formatDuration(durationMin)}</p>
        <span className={`inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${qualityStyle.badge}`}>
          {qualityStyle.label}
        </span>
      </div>

      <p className="text-[11px] text-text-muted text-center leading-relaxed rounded-xl border border-black/6 bg-surface-0/80 px-3 py-2.5">
        Only uninterrupted night sleep counts — naps and daytime rest are not included.
      </p>

      <div className="sleep-dual-range px-1">
        <div className="sleep-dual-range__controls">
          <div className="sleep-dual-range__track" aria-hidden>
            <div
              className="sleep-dual-range__fill"
              style={{
                left: `${bedPct}%`,
                width: `${wakePct - bedPct}%`,
                background: qualityStyle.fill,
              }}
            />
          </div>
          <div className="sleep-dual-range__inputs">
            <input
              type="range"
              min={TIMELINE_MIN}
              max={TIMELINE_MAX}
              step={STEP}
              value={bed}
              onChange={(e) => handleBedChange(Number(e.target.value))}
              onPointerDown={() => setActiveThumb('bed')}
              className={`sleep-dual-range__input sleep-dual-range__input--bed ${
                activeThumb === 'bed' ? 'sleep-dual-range__input--top' : ''
              }`}
              aria-label="Bedtime"
              aria-valuetext={`${bedDay} ${formatClockTime(bed)}`}
            />
            <input
              type="range"
              min={TIMELINE_MIN}
              max={TIMELINE_MAX}
              step={STEP}
              value={wake}
              onChange={(e) => handleWakeChange(Number(e.target.value))}
              onPointerDown={() => setActiveThumb('wake')}
              className={`sleep-dual-range__input sleep-dual-range__input--wake ${
                activeThumb === 'wake' ? 'sleep-dual-range__input--top' : ''
              }`}
              aria-label="Wake up time"
              aria-valuetext={`${wakeDay} ${formatClockTime(wake)}`}
            />
          </div>
        </div>

        <div className="flex justify-between text-[10px] text-text-muted mt-1 px-0.5 tabular-nums">
          <span>6 PM</span>
          <span>12 PM</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-indigo-700/80 mb-1">
              <Moon className="w-3.5 h-3.5" strokeWidth={2.25} />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Bedtime</span>
            </div>
            <p className="text-xs font-semibold text-text-muted tabular-nums">{bedDay}</p>
            <p className="text-base font-bold tabular-nums text-text-primary">{formatClockTime(bed)}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5 text-right">
            <div className="flex items-center justify-end gap-1.5 text-amber-700/80 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide">Wake up</span>
              <Sun className="w-3.5 h-3.5" strokeWidth={2.25} />
            </div>
            <p className="text-xs font-semibold text-text-muted tabular-nums">{wakeDay}</p>
            <p className="text-base font-bold tabular-nums text-text-primary">{formatClockTime(wake)}</p>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-text-muted text-center leading-relaxed">
        Drag the pins below the bar to set bedtime and wake-up.
      </p>
    </div>
  );
}
