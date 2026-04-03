'use client';

import {
  Trophy,
  Dumbbell,
  Utensils,
  Moon,
  Activity,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
} from 'lucide-react';
import type { LeaderboardRanking, FitnessGoal } from '@/lib/types';
import { FITNESS_GOAL_THEMES } from '@/lib/fitness-goal-theme';

export const FITNESS_GOAL_BADGES: Record<FitnessGoal, { label: string; color: string }> = Object.fromEntries(
  (Object.entries(FITNESS_GOAL_THEMES) as [FitnessGoal, { label: string; badgeDimClass: string }][]).map(
    ([k, v]) => [k, { label: v.label, color: v.badgeDimClass }],
  ),
) as Record<FitnessGoal, { label: string; color: string }>;

function goalColor(pct: number): string {
  if (pct >= 100) return '#a855f7';
  if (pct >= 85) return '#10b981';
  if (pct >= 65) return '#22d3ee';
  if (pct >= 45) return '#f59e0b';
  if (pct >= 20) return '#f97316';
  return '#f43f5e';
}

export function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="w-8 h-8 flex-shrink-0 flex flex-col items-center justify-center gap-0.5">
        <Trophy className="w-3.5 h-3.5 text-yellow-400" />
        <span className="text-[8px] font-bold text-yellow-400 leading-none">#1</span>
      </div>
    );
  if (rank === 2)
    return (
      <div className="w-8 h-8 flex-shrink-0 flex flex-col items-center justify-center gap-0.5">
        <Trophy className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[8px] font-bold text-slate-400 leading-none">#2</span>
      </div>
    );
  if (rank === 3)
    return (
      <div className="w-8 h-8 flex-shrink-0 flex flex-col items-center justify-center gap-0.5">
        <Trophy className="w-3.5 h-3.5 text-amber-600" />
        <span className="text-[8px] font-bold text-amber-600 leading-none">#3</span>
      </div>
    );
  return (
    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
      <span className="text-xs font-bold text-text-muted">#{rank}</span>
    </div>
  );
}

export function RankChange({ change }: { change: number | null | undefined }) {
  if (change == null) return null;
  if (change > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-400 text-[10px] font-semibold">
        <TrendingUp className="w-2.5 h-2.5" />
        {change}
      </span>
    );
  if (change < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-rose-400 text-[10px] font-semibold">
        <TrendingDown className="w-2.5 h-2.5" />
        {Math.abs(change)}
      </span>
    );
  return (
    <span className="inline-flex items-center text-text-muted text-[10px]">
      <Minus className="w-2.5 h-2.5" />
    </span>
  );
}

export function LeaderboardRowStats({
  r,
  isMe,
  className,
  compactOnMobile = false,
}: {
  r: LeaderboardRanking;
  isMe: boolean;
  className?: string;
  compactOnMobile?: boolean;
}) {
  const bd = r.score.breakdown;
  const mobileOptionalClass = compactOnMobile ? 'hidden sm:inline-flex' : 'inline-flex';
  const mobileOptionalTextClass = compactOnMobile ? 'hidden sm:inline' : 'inline';

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className ?? ''}`}>
      {bd && (
        <>
          <span className={`${mobileOptionalClass} items-center gap-0.5 text-xs`}>
            <Dumbbell className="w-3 h-3 text-blue-400" />
            <span className="text-text-secondary">{bd.workout}</span>
          </span>
          <span className={`${mobileOptionalClass} items-center gap-0.5 text-xs`}>
            <Utensils className="w-3 h-3 text-emerald-400" />
            <span className="text-text-secondary">{bd.nutrition}</span>
          </span>
          <span className={`${mobileOptionalClass} items-center gap-0.5 text-xs`}>
            <Moon className="w-3 h-3 text-indigo-400" />
            <span className="text-text-secondary">{bd.sleep}</span>
          </span>
          <span className={`${mobileOptionalClass} items-center gap-0.5 text-xs`}>
            <Activity className="w-3 h-3 text-amber-400" />
            <span className="text-text-secondary">
              {(bd as Record<string, number>).movement ?? (bd as Record<string, number>).steps ?? 0}
            </span>
          </span>
          <span className={`${mobileOptionalTextClass} text-text-muted/40 text-xs`}>·</span>
        </>
      )}
      <span className="text-xs text-text-muted">{r.user.days_active}d active</span>
      {r.user.streak_days > 0 && (
        <span className="inline-flex items-center gap-0.5 text-orange-400 text-xs font-semibold">
          <Flame className="w-3 h-3" />
          {r.user.streak_days}d
        </span>
      )}
      {r.user.goal_crush_streak > 0 && (
        <span className="inline-flex items-center gap-0.5 text-amber-400 text-xs font-semibold">
          <Zap className="w-3 h-3" />
          {r.user.goal_crush_streak}d
        </span>
      )}
      {r.score.goal_adherence_pct != null && (
        <span
          className="text-xs font-semibold"
          title="Goal adherence %"
          style={{ color: goalColor(r.score.goal_adherence_pct) }}
        >
          {r.score.goal_adherence_pct}% goals
        </span>
      )}
      {isMe && r.insights?.pts_to_next_rank != null && r.insights.pts_to_next_rank > 0 && (
        <span
          className={`${compactOnMobile ? 'hidden sm:inline-flex' : 'inline-flex'} text-[10px] text-accent-superjoin-orange font-medium bg-accent-superjoin-orange/10 px-1.5 py-0.5 rounded-full`}
        >
          {r.insights.pts_to_next_rank} pts to rank up
        </span>
      )}
      {isMe && r.insights?.pts_to_next_rank === null && (
        <span
          className={`${compactOnMobile ? 'hidden sm:inline-flex' : 'inline-flex'} text-[10px] text-accent-gold font-medium bg-accent-gold/10 px-1.5 py-0.5 rounded-full`}
        >
          👑 Top rank
        </span>
      )}
    </div>
  );
}
