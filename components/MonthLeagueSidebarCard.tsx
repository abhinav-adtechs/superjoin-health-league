'use client';

import { useEffect, useState } from 'react';
import { Trophy, ArrowRight } from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';

function daysInMonthFor(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

interface LeaderboardEntry {
  rank: number;
  user?: { display_name?: string | null };
  display_name?: string | null;
}

interface LeaderboardResponse {
  rankings?: LeaderboardEntry[];
}

export function MonthLeagueSidebarCard({
  displayName,
  sidebarPinned,
  refreshTrigger = 0,
  onOpenLeaderboard,
  rank,
  deferLoad = false,
}: {
  displayName: string;
  sidebarPinned: boolean;
  refreshTrigger?: number;
  onOpenLeaderboard?: () => void;
  rank?: number | null;
  deferLoad?: boolean;
}) {
  const [monthRank, setMonthRank] = useState<number | null>(rank ?? null);

  useEffect(() => {
    if (rank !== undefined) setMonthRank(rank);
  }, [rank]);

  useEffect(() => {
    if (rank !== undefined) return;
    let cancelled = false;
    async function load() {
      try {
        const d = new Date();
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const res = await fetch(
          apiUrl(`/api/leaderboard?view=monthly&month=${monthStr}`),
          getApiFetchOptions(),
        );
        const data: LeaderboardResponse = await res.json().catch(() => ({}));
        if (cancelled) return;
        const myEntry = data.rankings?.find(
          (r) => (r.user?.display_name ?? r.display_name) === displayName,
        );
        setMonthRank(myEntry?.rank ?? null);
      } catch {
        if (!cancelled) setMonthRank(null);
      }
    }
    const timer = deferLoad ? window.setTimeout(load, 1200) : null;
    if (!deferLoad) load();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [deferLoad, displayName, rank, refreshTrigger]);

  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = daysInMonthFor(now);
  const monthNameShort = now.toLocaleDateString('en-US', { month: 'short' });
  const daysLeft = daysInMonth - dayOfMonth + 1;

  return (
    <div className="shrink-0 border-b border-slate-200/80 bg-surface-1">
      <button
        type="button"
        onClick={onOpenLeaderboard}
        aria-label={`${monthNameShort} league, rank ${monthRank ?? 'unranked'}`}
        className={`group/league w-full text-left transition-colors hover:bg-slate-200/60 active:scale-[0.99] ${
          sidebarPinned ? 'px-2.5 py-2.5' : 'flex justify-center px-1.5 py-2 group-hover:justify-start group-hover:px-2.5'
        }`}
      >
        <div
          className={`relative overflow-hidden rounded-xl border border-accent-superjoin-orange/30 bg-surface-0 shadow-sm shadow-accent-superjoin-orange/10 ${
            sidebarPinned ? 'w-full px-3 py-2.5' : 'w-10 h-10 group-hover:w-full group-hover:h-auto group-hover:px-3 group-hover:py-2.5'
          }`}
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_100%_-20%,rgba(249,115,22,0.18),transparent_55%)]"
            aria-hidden
          />
          <div
            className={`relative flex items-center gap-2 min-w-0 ${
              sidebarPinned ? '' : 'h-full justify-center group-hover:justify-start group-hover:h-auto'
            }`}
          >
            <div
              className={`flex shrink-0 items-center justify-center rounded-lg border border-accent-superjoin-orange/35 bg-accent-superjoin-orange/15 ${
                sidebarPinned ? 'h-7 w-7' : 'h-6 w-6 group-hover:h-7 group-hover:w-7'
              }`}
            >
              <Trophy className="h-3.5 w-3.5 text-accent-superjoin-orange" aria-hidden />
            </div>
            <div
              className={`min-w-0 flex-1 transition-all duration-200 ${
                sidebarPinned
                  ? 'opacity-100'
                  : 'max-w-0 overflow-hidden opacity-0 group-hover:max-w-[12rem] group-hover:opacity-100'
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent-superjoin-orange/90 leading-tight">
                {monthNameShort} league
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5 leading-none">
                {monthRank != null ? (
                  <span className="text-base font-black tabular-nums text-accent-superjoin-orange">
                    #{monthRank}
                  </span>
                ) : (
                  <span className="text-sm font-bold text-text-muted">—</span>
                )}
                <span className="text-[10px] text-text-muted tabular-nums">
                  Day {dayOfMonth}/{daysInMonth}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-text-muted leading-tight truncate">
                {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
              </p>
            </div>
            <ArrowRight
              className={`h-3.5 w-3.5 shrink-0 text-accent-superjoin-orange/60 transition-opacity duration-200 ${
                sidebarPinned
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100'
              }`}
              aria-hidden
            />
          </div>
        </div>
      </button>
    </div>
  );
}
