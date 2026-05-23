'use client';

import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/** Minutes from 6:00 PM on the sleep timeline (0 = 6 PM, 1080 = 12 PM next day). */
const TIMELINE_MIN = 0;
const TIMELINE_MAX = 18 * 60;
const STEP = 15;
const MIN_SLEEP = 4 * 60;
const MAX_SLEEP = 12 * 60;

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

interface SleepTimeSliderProps {
  onChange: (sleepHours: number) => void;
  className?: string;
}

export function SleepTimeSlider({ onChange, className = '' }: SleepTimeSliderProps) {
  const [bed, setBed] = useState(DEFAULT_BED);
  const [wake, setWake] = useState(DEFAULT_WAKE);
  const [activeThumb, setActiveThumb] = useState<'bed' | 'wake'>('bed');

  const durationMin = wake - bed;

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
      <div className="rounded-2xl bg-indigo-50/80 border border-indigo-100 px-4 py-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700/80 mb-0.5">
          Total sleep
        </p>
        <p className="text-2xl font-bold tabular-nums text-text-primary">{formatDuration(durationMin)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-black/8 bg-surface-0 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-text-muted mb-1">
            <Moon className="w-3.5 h-3.5" strokeWidth={2.25} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">Bedtime</span>
          </div>
          <p className="text-base font-bold tabular-nums text-text-primary">{formatClockTime(bed)}</p>
        </div>
        <div className="rounded-xl border border-black/8 bg-surface-0 px-3 py-2.5 text-right">
          <div className="flex items-center justify-end gap-1.5 text-text-muted mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide">Wake up</span>
            <Sun className="w-3.5 h-3.5" strokeWidth={2.25} />
          </div>
          <p className="text-base font-bold tabular-nums text-text-primary">{formatClockTime(wake)}</p>
        </div>
      </div>

      <div className="sleep-dual-range px-1">
        <div className="sleep-dual-range__track" aria-hidden>
          <div
            className="sleep-dual-range__fill"
            style={{ left: `${bedPct}%`, width: `${wakePct - bedPct}%` }}
          />
        </div>
        <input
          type="range"
          min={TIMELINE_MIN}
          max={TIMELINE_MAX}
          step={STEP}
          value={bed}
          onChange={(e) => handleBedChange(Number(e.target.value))}
          onPointerDown={() => setActiveThumb('bed')}
          className={`sleep-dual-range__input ${activeThumb === 'bed' ? 'sleep-dual-range__input--top' : ''}`}
          aria-label="Bedtime"
          aria-valuetext={formatClockTime(bed)}
        />
        <input
          type="range"
          min={TIMELINE_MIN}
          max={TIMELINE_MAX}
          step={STEP}
          value={wake}
          onChange={(e) => handleWakeChange(Number(e.target.value))}
          onPointerDown={() => setActiveThumb('wake')}
          className={`sleep-dual-range__input ${activeThumb === 'wake' ? 'sleep-dual-range__input--top' : ''}`}
          aria-label="Wake up time"
          aria-valuetext={formatClockTime(wake)}
        />
        <div className="flex justify-between text-[10px] text-text-muted mt-1 px-0.5 tabular-nums">
          <span>6 PM</span>
          <span>12 PM</span>
        </div>
      </div>

      <p className="text-[11px] text-text-muted text-center leading-relaxed">
        Drag the pins to set when you went to bed and when you woke up.
      </p>
    </div>
  );
}
