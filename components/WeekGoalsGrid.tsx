'use client';

import type { ComponentType } from 'react';
import {
  Dumbbell,
  Droplets,
  Moon,
  Activity,
  Utensils,
  Footprints,
  Target,
} from 'lucide-react';
import {
  buildWeekViewColumns,
  weekColumnStatus,
  weekColumnLabel,
  type EntryRow,
  type ProfileGoals,
  type WeekViewColumn,
} from '@/lib/health-log-week-view';

function getLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekColumnIcon(col: WeekViewColumn): ComponentType<{ className?: string }> {
  switch (col.kind) {
    case 'workout_agg':
      return Dumbbell;
    case 'steps':
      return Footprints;
    case 'sleep':
      return Moon;
    case 'water':
      return Droplets;
    case 'protein':
      return Utensils;
    case 'calories':
      return Activity;
    default:
      return Target;
  }
}

function GoalDot({
  Icon,
  met,
  isFuture,
  isToday,
  ariaLabel,
}: {
  Icon: ComponentType<{ className?: string }>;
  met: boolean | null;
  isFuture: boolean;
  isToday: boolean;
  ariaLabel?: string;
}) {
  let bgClass = 'bg-surface-3';
  let iconClass = 'text-text-muted/25';
  let borderClass = '';

  if (isFuture) {
    bgClass = 'bg-surface-3';
    iconClass = 'text-text-muted/25';
  } else if (isToday && met === null) {
    bgClass = 'bg-transparent';
    borderClass = 'border-2 border-dashed border-text-muted/40';
    iconClass = 'text-text-muted/50';
  } else if (met === true) {
    bgClass = 'bg-emerald-500/20';
    iconClass = 'text-emerald-500';
  } else if (met === false) {
    bgClass = 'bg-rose-500/20';
    iconClass = 'text-rose-500';
  }

  return (
    <div
      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${bgClass} ${borderClass}`}
      role="img"
      aria-label={ariaLabel}
    >
      <Icon className={`h-3 w-3 ${iconClass}`} aria-hidden />
    </div>
  );
}

function isTodayInWeek(days: string[], todayStr: string): boolean {
  return days.includes(todayStr);
}

/** Same week grid as the dashboard “This week” card. */
export function WeekGoalsGrid({
  entries,
  goals,
  from,
  to,
}: {
  entries: EntryRow[];
  goals: ProfileGoals | null;
  from: string;
  to: string;
}) {
  const columns = buildWeekViewColumns(goals);
  const todayStr = getLocalDateStr(new Date());

  if (columns.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Set your goals in{' '}
        <span className="font-medium text-text-secondary">Profile &amp; Goals</span> to see how each day lines up
        with your targets.
      </p>
    );
  }

  const entriesByDate = new Map(entries.map((e) => [e.date, e]));
  const days: string[] = [];
  const d = new Date(from + 'T12:00:00');
  const end = new Date(to + 'T12:00:00');
  while (d <= end) {
    days.push(getLocalDateStr(d));
    d.setDate(d.getDate() + 1);
  }

  const todayStatusByCol = new Map<string, boolean | null>();
  let todayHasAnyLogged = false;

  const dayChips = days.map((date) => {
    const e = entriesByDate.get(date);
    const isToday = date === todayStr;
    const isPast = date < todayStr;
    const isFuture = date > todayStr;
    const isPastNoEntry = !e && isPast;
    const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
      weekday: 'short',
    });
    const dayNum = new Date(date + 'T12:00:00').getDate();

    const cells = columns.map((col) => {
      const { met, value } = weekColumnStatus(e, col, goals, isPastNoEntry, isPast);
      const Icon = weekColumnIcon(col);
      const colMet = isFuture ? null : met;
      if (isToday) {
        if (e) todayHasAnyLogged = true;
        todayStatusByCol.set(col.kind, colMet);
      }
      const showValue = !isFuture && value && value !== '—';
      return (
        <div key={col.kind} className="flex flex-col items-center gap-0.5 min-w-0">
          <GoalDot
            Icon={Icon}
            met={colMet}
            isFuture={isFuture}
            isToday={isToday}
            ariaLabel={`${weekColumnLabel(col)}: ${
              colMet === true ? 'goal met' : colMet === false ? 'missed' : 'not logged'
            }${showValue ? ` (${value})` : ''}`}
          />
          {showValue ? (
            <span
              className={`text-[8px] leading-none tabular-nums truncate max-w-full ${
                colMet === true
                  ? 'text-emerald-600/80'
                  : colMet === false
                  ? 'text-rose-500/70'
                  : 'text-text-muted'
              }`}
            >
              {value}
            </span>
          ) : null}
        </div>
      );
    });

    return (
      <div
        key={date}
        className={`flex flex-1 min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1 py-2 ${
          isToday
            ? 'border-accent-superjoin-orange/60 bg-accent-superjoin-orange/[0.06]'
            : 'border-white/10 bg-surface-2/40'
        }`}
      >
        <span
          className={`text-[9px] font-medium leading-none ${
            isToday ? 'text-accent-superjoin-orange' : 'text-text-muted'
          }`}
        >
          {dayLabel}
        </span>
        <span
          className={`text-sm font-bold leading-none ${
            isToday ? 'text-accent-superjoin-orange' : 'text-text-primary'
          }`}
        >
          {dayNum}
        </span>
        <div className="flex flex-col items-center gap-1 w-full">{cells}</div>
      </div>
    );
  });

  const hasToday = isTodayInWeek(days, todayStr);
  const leftTodayCount = hasToday
    ? columns.filter((c) => todayStatusByCol.get(c.kind) !== true).length
    : 0;
  const allDoneToday = hasToday && leftTodayCount === 0 && columns.length > 0;

  return (
    <div className="space-y-0">
      <div className="flex gap-1.5">{dayChips}</div>

      <div className="mt-3 border-t border-white/10 pt-3">
        {hasToday && (
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Today</p>
            {allDoneToday ? (
              <span className="text-[10px] font-semibold text-emerald-500">All done ✓</span>
            ) : !todayHasAnyLogged ? (
              <span className="text-[10px] text-text-muted">Not logged yet</span>
            ) : (
              <span className="text-[10px] text-text-muted">{leftTodayCount} left</span>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {columns.map((col) => {
            const Icon = weekColumnIcon(col);
            const status = hasToday ? todayStatusByCol.get(col.kind) : undefined;
            const iconColor =
              status === true
                ? 'text-emerald-500'
                : status === false
                ? 'text-rose-500'
                : 'text-text-muted/60';
            const labelColor =
              status === true
                ? 'text-text-primary'
                : status === false
                ? 'text-text-secondary'
                : 'text-text-muted';
            return (
              <span key={col.kind} className={`inline-flex items-center gap-1 text-[11px] ${labelColor}`}>
                <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} aria-hidden />
                {weekColumnLabel(col)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
