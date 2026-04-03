'use client';

import { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import type { LeaderboardRanking, LeaderboardView, FitnessGoal } from '@/lib/types';
import { resolveAvatarUrl } from '@/lib/avatar-url';
import {
  FITNESS_GOAL_BADGES,
  LeaderboardRowStats,
  RankBadge,
  RankChange,
} from '@/components/LeaderboardRowStats';

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-pink-500',
];

function LadderAvatar({
  userId,
  name,
  url,
  sizeClass,
}: {
  userId: string;
  name: string;
  url: string | null;
  sizeClass: string;
}) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const src = resolveAvatarUrl({ userId, displayName: name, avatarUrl: url });

  if (broken) {
    return (
      <div
        className={`${sizeClass} rounded-full flex-shrink-0 flex items-center justify-center font-semibold text-white ${color}`}
      >
        <span className="text-[10px] sm:text-xs">{initials || '?'}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={`${sizeClass} rounded-full object-cover flex-shrink-0 bg-surface-2`}
      onError={() => setBroken(true)}
    />
  );
}

function scoreValue(r: LeaderboardRanking, view: LeaderboardView): number {
  return view === 'alltime' ? r.score.normalized_score : r.score.total_points;
}

function formatScore(n: number, view: LeaderboardView): string {
  return view === 'alltime' ? n.toFixed(1) : String(Math.round(n));
}

const PODIUM_TIER = {
  1: {
    ring: 'ring-2 ring-yellow-400/70 shadow-[0_0_24px_-4px_rgba(250,204,21,0.45)]',
    bar: 'from-amber-400 via-yellow-400 to-amber-500',
    label: 'text-yellow-400',
    h: 'min-h-[168px] sm:min-h-[188px]',
    trophy: 'text-yellow-400',
  },
  2: {
    ring: 'ring-2 ring-slate-300/60 shadow-[0_0_20px_-4px_rgba(148,163,184,0.35)]',
    bar: 'from-slate-300 via-slate-200 to-slate-400',
    label: 'text-slate-300',
    h: 'min-h-[132px] sm:min-h-[148px]',
    trophy: 'text-slate-300',
  },
  3: {
    ring: 'ring-2 ring-amber-700/60 shadow-[0_0_18px_-4px_rgba(180,83,9,0.35)]',
    bar: 'from-amber-700 via-amber-600 to-amber-800',
    label: 'text-amber-600',
    h: 'min-h-[112px] sm:min-h-[124px]',
    trophy: 'text-amber-600',
  },
} as const;

type PodiumSlot = {
  rank: 1 | 2 | 3;
  r: LeaderboardRanking;
};

function buildPodiumSlots(top3: LeaderboardRanking[]): PodiumSlot[] {
  if (top3.length === 0) return [];
  if (top3.length === 1) return [{ rank: 1, r: top3[0] }];
  if (top3.length === 2)
    return [
      { rank: 2, r: top3[1] },
      { rank: 1, r: top3[0] },
    ];
  return [
    { rank: 2, r: top3[1] },
    { rank: 1, r: top3[0] },
    { rank: 3, r: top3[2] },
  ];
}

/**
 * Podium + top-10 chasing rows with full stats. Intended to sit inside a single parent `glass-card`.
 */
export function LeaderboardTopLadder({
  view,
  rankings,
  currentUserId,
}: {
  view: LeaderboardView;
  rankings: LeaderboardRanking[];
  currentUserId?: string | null;
}) {
  const top10 = useMemo(() => rankings.slice(0, 10), [rankings]);
  const leader = top10[0];
  const leaderRaw = leader ? scoreValue(leader, view) : 0;
  const denom = Math.max(leaderRaw, 1e-9);

  const podiumSlots = useMemo(() => buildPodiumSlots(top10.slice(0, 3)), [top10]);
  const tail = top10.slice(3);

  if (top10.length === 0) return null;

  const ptsLabel = view === 'alltime' ? 'pts/d' : 'pts';

  return (
    <>
      {/* Podium: 2–1–3 when 3+ — horizontal scroll on very narrow viewports */}
      <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1 md:overflow-visible [scrollbar-width:thin]">
        <div
          className={`flex items-end justify-center gap-2 sm:gap-4 ${
            podiumSlots.length === 1
              ? 'max-w-xs mx-auto'
              : podiumSlots.length === 2
                ? 'max-w-md mx-auto'
                : 'min-w-[280px] sm:min-w-0'
          }`}
        >
        {podiumSlots.map((slot) => {
          const tier = PODIUM_TIER[slot.rank];
          const s = scoreValue(slot.r, view);
          const pct = Math.min(100, (s / denom) * 100);
          const isMe = currentUserId != null && slot.r.user.id === currentUserId;
          const avatarSize = slot.rank === 1 ? 'w-14 h-14 sm:w-16 sm:h-16' : 'w-11 h-11 sm:w-12 sm:h-12';

          return (
            <div
              key={slot.r.user.id}
              className={`flex flex-1 flex-col items-center justify-end rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent px-1.5 pt-4 pb-3 sm:px-3 ${tier.h} ${
                podiumSlots.length === 2 && slot.rank === 1 ? 'sm:flex-[1.15]' : ''
              }`}
            >
              <div className={`relative mb-2 rounded-full ${tier.ring} p-0.5`}>
                <LadderAvatar
                  userId={slot.r.user.id}
                  name={slot.r.user.display_name}
                  url={slot.r.user.avatar_url}
                  sizeClass={avatarSize}
                />
                <div
                  className={`absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full bg-surface-0 border border-white/15 px-1.5 py-0.5 ${tier.label}`}
                >
                  <Trophy className={`w-3 h-3 ${tier.trophy}`} aria-hidden />
                  <span className="text-[9px] font-black tabular-nums ml-0.5">#{slot.rank}</span>
                </div>
              </div>
              <div className="w-full min-w-0 flex flex-col items-center gap-0.5">
                <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:flex-wrap">
                  <p className="max-w-full text-center text-xs font-bold text-text-primary truncate sm:text-sm">
                    {slot.r.user.display_name}
                  </p>
                  {isMe && (
                    <span className="hidden sm:inline-flex text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary-orange text-white shrink-0">
                      YOU
                    </span>
                  )}
                  {slot.r.user.fitness_goal && (
                    <span
                      className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full leading-none shrink-0 ${
                        FITNESS_GOAL_BADGES[slot.r.user.fitness_goal as FitnessGoal]?.color ?? ''
                      }`}
                    >
                      {FITNESS_GOAL_BADGES[slot.r.user.fitness_goal as FitnessGoal]?.label ?? slot.r.user.fitness_goal}
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-mono font-bold tabular-nums text-text-secondary mt-1">
                  {formatScore(s, view)} <span className="text-text-muted font-sans font-medium">{ptsLabel}</span>
                </p>
                <div className="flex justify-center min-h-[14px]">
                  <RankChange change={slot.r.rank_change} />
                </div>
                <div className="w-full mt-1 text-[10px] sm:text-[11px] leading-tight">
                  <LeaderboardRowStats r={slot.r} isMe={isMe} compactOnMobile className="justify-center mt-0" />
                </div>
                <div className="w-full mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${tier.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {slot.rank > 1 && (
                  <p className="mt-1 hidden text-[10px] text-center tabular-nums text-text-muted sm:block">
                    {formatScore(leaderRaw - s, view)} behind #1
                  </p>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Ranks 4–10 */}
      {tail.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-0.5">Chasing pack</p>
          <ul className="space-y-3">
            {tail.map((r) => {
              const s = scoreValue(r, view);
              const pct = Math.min(100, (s / denom) * 100);
              const isMe = currentUserId != null && r.user.id === currentUserId;
              const behind = leaderRaw - s;

              return (
                <li key={r.user.id} className="rounded-xl border border-white/8 bg-white/[0.02] md:bg-surface-1 px-2 py-2.5 sm:px-3">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <RankBadge rank={r.rank} />
                    <LadderAvatar userId={r.user.id} name={r.user.display_name} url={r.user.avatar_url} sizeClass="w-8 h-8" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-[15px] text-text-primary leading-tight truncate">
                              {r.user.display_name}
                            </span>
                            {isMe && (
                              <span className="hidden sm:inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary-orange text-white leading-none shrink-0">
                                YOU
                              </span>
                            )}
                            {r.user.fitness_goal && (
                              <span
                                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none shrink-0 ${
                                  FITNESS_GOAL_BADGES[r.user.fitness_goal as FitnessGoal]?.color ?? ''
                                }`}
                              >
                                {FITNESS_GOAL_BADGES[r.user.fitness_goal as FitnessGoal]?.label ?? r.user.fitness_goal}
                              </span>
                            )}
                          </div>
                          <LeaderboardRowStats r={r} isMe={isMe} className="mt-1" />
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="font-bold text-[15px] text-text-primary leading-tight tabular-nums">
                            {view === 'alltime' ? r.score.normalized_score.toFixed(1) : r.score.total_points}
                            <span className="text-xs font-normal text-text-muted ml-0.5">{ptsLabel}</span>
                          </p>
                          <div className="flex justify-end mt-0.5">
                            <RankChange change={r.rank_change} />
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent-superjoin-orange/90 to-amber-500/80"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 hidden text-[10px] tabular-nums text-text-muted sm:block">{formatScore(behind, view)} behind #1</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
