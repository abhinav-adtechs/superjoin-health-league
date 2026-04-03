'use client';

import { Heart, Loader2 } from 'lucide-react';

type AppLoadingScreenProps = {
  /** Shown under the app name (e.g. “Preparing your workspace…”). */
  message?: string;
};

/**
 * Full-viewport branded loader for initial auth / profile fetch.
 * Layout already provides mesh-bg + noise; this sits as a glass card on top.
 */
export function AppLoadingScreen({ message = 'Preparing your workspace…' }: AppLoadingScreenProps) {
  return (
    <div
      className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 safe-area-top safe-area-bottom"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/20 bg-surface-0/85 px-8 py-10 text-center shadow-xl shadow-black/[0.06] backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_50%_-20%,rgba(249,115,22,0.12),transparent_55%)]"
          aria-hidden
        />
        <div className="relative">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-superjoin-orange/30 bg-accent-superjoin-orange/15 shadow-inner">
            <Heart className="h-7 w-7 text-accent-superjoin-orange" aria-hidden />
          </div>
          <Loader2
            className="mx-auto h-9 w-9 animate-spin text-accent-superjoin-orange"
            strokeWidth={2.25}
            aria-hidden
          />
          <p className="mt-5 text-base font-bold tracking-tight text-text-primary">Superjoin Health OS</p>
          <p className="mt-1.5 text-sm text-text-muted">{message}</p>
        </div>
      </div>
    </div>
  );
}

type TabContentLoaderProps = {
  /** Short line shown under the spinner (e.g. “Loading leaderboard…”). */
  message: string;
  /** Tighter vertical padding for nested sections. */
  density?: 'comfortable' | 'compact';
};

/**
 * Centered loader for tab / screen content (not full app shell).
 */
export function TabContentLoader({ message, density = 'comfortable' }: TabContentLoaderProps) {
  const py = density === 'compact' ? 'py-10' : 'py-14 sm:py-20';
  const minH = density === 'compact' ? 'min-h-[28vh]' : 'min-h-[42vh] sm:min-h-[min(380px,52vh)]';

  return (
    <div
      className={`flex flex-col items-center justify-center px-4 ${py} ${minH}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-surface-0/75 px-6 py-8 text-center shadow-lg shadow-black/[0.04] backdrop-blur-md">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_0%,rgba(249,115,22,0.08),transparent_50%)]"
          aria-hidden
        />
        <div className="relative flex flex-col items-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-accent-superjoin-orange/25 bg-accent-superjoin-orange/12">
            <Heart className="h-5 w-5 text-accent-superjoin-orange" aria-hidden />
          </div>
          <Loader2 className="h-8 w-8 animate-spin text-accent-superjoin-orange" strokeWidth={2.25} aria-hidden />
          <p className="mt-4 text-sm font-semibold text-text-primary">{message}</p>
        </div>
      </div>
    </div>
  );
}

/** Leaderboard layout skeleton (header + hero strip + rows). */
export function LeaderboardSkeleton() {
  return (
    <div className="space-y-5 animate-fade-up" role="status" aria-busy="true" aria-label="Loading leaderboard">
      <div className="space-y-3">
        <div className="skeleton-shimmer h-7 w-40 rounded-lg" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer h-9 w-20 rounded-full" />
          ))}
        </div>
        <div className="skeleton-shimmer h-28 w-full rounded-2xl sm:h-32" />
      </div>
      <div className="glass-card overflow-hidden">
        <div className="divide-y divide-white/10">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <div className="skeleton-shimmer h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton-shimmer h-4 w-full max-w-[180px] rounded-md" />
                <div className="skeleton-shimmer h-3 w-24 rounded-md" />
              </div>
              <div className="skeleton-shimmer h-6 w-14 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Log history list skeleton (week blocks + rows). */
export function LogHistorySkeleton() {
  return (
    <div className="space-y-8" role="status" aria-busy="true" aria-label="Loading log history">
      {[1, 2].map((block) => (
        <div key={block} className="space-y-3">
          <div className="skeleton-shimmer h-4 w-48 rounded-md" />
          <div className="space-y-2 rounded-xl border border-white/10 bg-surface-0/50 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton-shimmer h-9 w-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="skeleton-shimmer h-3.5 w-full max-w-[220px] rounded-md" />
                  <div className="skeleton-shimmer h-3 w-32 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Settings / integrations style card skeletons. */
export function IntegrationCardsSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" role="status" aria-busy="true" aria-label="Loading connections">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-surface-0/60 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="skeleton-shimmer h-12 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
              <div className="skeleton-shimmer h-4 w-36 rounded-md" />
              <div className="skeleton-shimmer h-3 w-full max-w-md rounded-md" />
              <div className="skeleton-shimmer h-3 w-4/5 max-w-sm rounded-md" />
            </div>
          </div>
          <div className="skeleton-shimmer h-10 w-full shrink-0 rounded-xl sm:w-28" />
        </div>
      ))}
    </div>
  );
}

/** Point system / scoring rules list skeleton. */
export function RulesListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading rules">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-shimmer h-10 rounded-xl" />
      ))}
    </div>
  );
}

/** Calendar / histogram block (toolbar + chart area). */
export function CalendarHistogramSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading chart">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-0 overflow-hidden rounded-lg border border-white/10">
          <div className="skeleton-shimmer h-9 w-14" />
          <div className="skeleton-shimmer h-9 w-14 border-l border-white/10" />
          <div className="skeleton-shimmer h-9 w-14 border-l border-white/10" />
        </div>
        <div className="skeleton-shimmer h-9 w-28 rounded-lg" />
      </div>
      <div className="skeleton-shimmer h-56 w-full rounded-xl sm:h-64" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
