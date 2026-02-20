'use client';

import { useState, useEffect } from 'react';
import { Flame, Target, TrendingUp, Bell, BookOpen } from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import type { Profile } from '@/lib/types';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function DashboardTab({ profile, onRefresh }: { profile: Profile; onRefresh: () => void }) {
  const [todayEntry, setTodayEntry] = useState<{ daily_points: number } | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [weeklyPoints, setWeeklyPoints] = useState<number>(0);
  const [rank, setRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLoggedAt, setLastLoggedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const from = twoDaysAgo.toISOString().slice(0, 10);
      const [entryRes, historyRes, streakRes, lbRes] = await Promise.all([
        fetch(apiUrl(`/api/entries?date=${today}`), getApiFetchOptions()),
        fetch(apiUrl(`/api/entries/history?from=${from}&to=${today}`), getApiFetchOptions()),
        fetch(apiUrl('/api/streaks/me'), getApiFetchOptions()),
        fetch(apiUrl('/api/leaderboard?view=weekly'), getApiFetchOptions()),
      ]);
      if (cancelled) return;
      const entryData = await entryRes.json();
      const historyData = await historyRes.json().catch(() => []);
      const streakData = await streakRes.json();
      const lbData = await lbRes.json();
      setTodayEntry(entryData?.id ? entryData : null);
      setStreak(streakData.current_streak_days ?? 0);
      const myRank = lbData.rankings?.findIndex((r: { user: { display_name: string } }) => r.user.display_name === profile.display_name);
      setRank(myRank >= 0 ? myRank + 1 : null);
      const myTotal = lbData.rankings?.find((r: { user: { display_name: string } }) => r.user.display_name === profile.display_name)?.score?.total_points ?? 0;
      setWeeklyPoints(myTotal);
      const entries = Array.isArray(historyData) ? historyData : [];
      const latest = entries.reduce((acc: string | null, e: { updated_at?: string }) => {
        if (!e?.updated_at) return acc;
        return !acc || e.updated_at > acc ? e.updated_at : acc;
      }, null as string | null);
      setLastLoggedAt(latest ? new Date(latest).getTime() : null);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [profile.display_name]);

  if (loading) {
    return <div className="animate-pulse text-text-muted">Loading dashboard…</div>;
  }

  const pointsToday = todayEntry?.daily_points ?? 0;
  const now = Date.now();
  const showReminder = lastLoggedAt == null || now - lastLoggedAt > TWENTY_FOUR_HOURS_MS;

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Today</h2>
        <p className="text-sm text-text-secondary">Your score and streak at a glance.</p>
      </div>

      {showReminder && (
        <div className="glass-card p-4 flex items-center gap-3 border-l-4 border-accent-superjoin-orange bg-accent-superjoin-orange/5">
          <Bell className="w-5 h-5 text-accent-superjoin-orange shrink-0" />
          <div>
            <p className="font-medium text-text-primary">Time to log</p>
            <p className="text-sm text-text-secondary">You haven&apos;t logged in the last 24 hours. Add Workout, Food, or Sleep to keep your streak.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Today&apos;s points</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{pointsToday}</p>
          <p className="text-xs text-text-muted mt-1">Max ~98 per day</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <Flame className="w-4 h-4 text-accent-orange" />
            <span className="text-xs font-medium uppercase tracking-wider">Streak</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{streak} days</p>
          <p className="text-xs text-text-muted mt-1">Log at least one field daily</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <TrendingUp className="w-4 h-4 text-accent-green" />
            <span className="text-xs font-medium uppercase tracking-wider">This week</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{weeklyPoints} pts</p>
          {rank != null && <p className="text-xs text-text-muted mt-1">Rank #{rank} this week</p>}
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-medium text-text-primary flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-text-muted" />
          Weekly principles
        </h3>
        <ul className="text-sm text-text-secondary space-y-2">
          <li><strong>Sleep:</strong> Aim for 8 hours of sleep daily.</li>
          <li><strong>Workout:</strong> 3 strength sessions and 3 cardio sessions per week.</li>
          <li><strong>Food:</strong> Finish your last meal at least 3 hours before bedtime.</li>
          <li><strong>Consistency:</strong> Small daily logs beat occasional big entries.</li>
        </ul>
      </div>

      <div className="glass-card p-5">
        <p className="text-sm text-text-secondary">
          Every field is optional. You get points only for healthy actions — no penalty for skipping. Use <strong>New Entry</strong> in the header to log Workout, Food, or Sleep anytime.
        </p>
      </div>
    </div>
  );
}
