'use client';

import { useMemo } from 'react';
import { MAX_DAYS_BACK } from '@/lib/entryDateWindow';

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateStrings(): { date: string; label: string; sublabel: string }[] {
  const today = new Date();
  const out: { date: string; label: string; sublabel: string }[] = [];
  for (let i = 0; i <= MAX_DAYS_BACK; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = localDateStr(d);
    const label =
      i === 0 ? 'Today' : i === 1 ? 'Yesterday' : `${i} days ago`;
    const sublabel = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    out.push({ date: dateStr, label, sublabel });
  }
  return out;
}

interface DateCarouselProps {
  value: string;
  onChange: (date: string) => void;
  className?: string;
}

export function DateCarousel({ value, onChange, className = '' }: DateCarouselProps) {
  const DATE_OPTIONS = useMemo(() => getDateStrings(), []);
  
  const normalizedValue = value.slice(0, 10);
  const index = DATE_OPTIONS.findIndex((o) => o.date === normalizedValue);
  const currentIndex = index >= 0 ? index : 0;
  const selected = DATE_OPTIONS[currentIndex];

  const go = (delta: number) => {
    const next = Math.max(0, Math.min(DATE_OPTIONS.length - 1, currentIndex + delta));
    onChange(DATE_OPTIONS[next].date);
  };

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => go(1)}
        disabled={currentIndex >= DATE_OPTIONS.length - 1}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-white/10 bg-surface-0/50 md:bg-surface-0 text-text-muted hover:bg-black/5 hover:text-text-primary disabled:opacity-40 disabled:pointer-events-none touch-manipulation"
        aria-label="Older date"
      >
        <span className="text-lg font-medium">←</span>
      </button>
      <div className="flex-1 text-center min-w-0">
        <p className="font-semibold text-text-primary truncate">{selected.label}</p>
        <p className="text-sm text-text-muted truncate">{selected.sublabel}</p>
      </div>
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={currentIndex <= 0}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-white/10 bg-surface-0/50 md:bg-surface-0 text-text-muted hover:bg-black/5 hover:text-text-primary disabled:opacity-40 disabled:pointer-events-none touch-manipulation"
        aria-label="More recent date"
      >
        <span className="text-lg font-medium">→</span>
      </button>
    </div>
  );
}

export { MAX_DAYS_BACK };
