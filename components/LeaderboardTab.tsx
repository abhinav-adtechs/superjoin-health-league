'use client';

import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import type { LeaderboardView, LeaderboardResponse } from '@/lib/types';

export function LeaderboardTab() {
  const [view, setView] = useState<LeaderboardView>('weekly');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch(apiUrl(`/api/leaderboard?view=${view}`), getApiFetchOptions())
      .then((res) => {
        if (!res.ok && res.status === 503) return res.json().then((d) => { throw new Error(d.error || 'Service unavailable'); });
        return res.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load'); setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [view]);

  if (loading) return <div className="animate-pulse text-text-muted">Loading leaderboard…</div>;
  if (error) {
    return (
      <div className="space-y-4 animate-fade-up">
        <h2 className="text-lg font-semibold text-text-primary">Leaderboard</h2>
        <div className="glass-card p-6 text-center">
          <p className="text-accent-red font-medium">Could not load leaderboard</p>
          <p className="text-sm text-text-muted mt-1">{error}</p>
          <p className="text-xs text-text-secondary mt-3">
            Check that Supabase is configured in <code className="bg-black/5 px-1 rounded">.env.local</code> and the DB is reachable. Open <a href="/api/health" target="_blank" rel="noopener noreferrer" className="text-primary-orange underline">/api/health</a> to verify connection.
          </p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="text-text-muted">Could not load leaderboard.</div>;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Leaderboard</h2>
          <p className="text-sm text-text-secondary">{data.period}</p>
        </div>
        <div className="flex gap-2">
          {(['weekly', 'monthly', 'alltime'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`tab-item relative ${view === v ? 'active' : ''}`}
            >
              {v === 'weekly' ? 'This week' : v === 'monthly' ? 'This month' : 'All time'}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <ul className="divide-y divide-white/10">
          {data.rankings?.length === 0 ? (
            <li className="p-6 text-center">
              <p className="text-text-muted">No users on the leaderboard yet.</p>
              <p className="text-xs text-text-secondary mt-2">If you expected to see people here, check that the database has profiles with <code className="bg-black/5 px-1 rounded">is_active = true</code>. You can verify the connection at <a href="/api/health" target="_blank" rel="noopener noreferrer" className="text-primary-orange underline">/api/health</a>.</p>
            </li>
          ) : (
            data.rankings?.map((r, i) => (
              <li key={r.rank} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors">
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${i < 3 ? `rank-${r.rank}` : 'bg-surface-2 text-text-muted'}`}>
                  {r.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary truncate">{r.user.display_name}</p>
                  <p className="text-xs text-text-muted">
                    {r.user.days_active} days active
                    {r.user.streak_days > 0 && ` · ${r.user.streak_days} day streak`}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="font-bold text-text-primary">
                    {view === 'alltime' ? r.score.normalized_score.toFixed(1) : r.score.total_points}
                  </p>
                  <p className="text-[10px] text-text-muted uppercase">
                    {view === 'alltime' ? 'pts/day' : 'pts'}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <p className="text-xs text-text-muted">
        All-time ranking uses <strong>normalized score</strong> (total points ÷ days since joining) so newcomers can compete fairly.
      </p>
    </div>
  );
}
