'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import type { Profile } from '@/lib/types';

export function MyStatsTab({ profile }: { profile: Profile }) {
  const [weightHistory, setWeightHistory] = useState<{ week_start: string; weight_kg: number }[]>([]);
  const [entryHistory, setEntryHistory] = useState<{ date: string; daily_points: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [weightInput, setWeightInput] = useState('');
  const [weightSaving, setWeightSaving] = useState(false);

  const loadData = () => {
    const from = new Date();
    from.setDate(from.getDate() - 90);
    const to = new Date().toISOString().slice(0, 10);
    const fromStr = from.toISOString().slice(0, 10);
    Promise.all([
      fetch(apiUrl('/api/weight/history'), getApiFetchOptions()).then((r) => r.json()),
      fetch(apiUrl(`/api/entries/history?from=${fromStr}&to=${to}`), getApiFetchOptions()).then((r) => r.json()),
    ]).then(([wh, eh]) => {
      setWeightHistory(wh ?? []);
      setEntryHistory((eh ?? []).map((e: { date: string; daily_points: number }) => ({ date: e.date, daily_points: e.daily_points ?? 0 })));
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = Number(weightInput);
    if (!Number.isFinite(w) || w <= 0) return;
    setWeightSaving(true);
    const res = await fetch(apiUrl('/api/weight'), getApiFetchOptions({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weight_kg: w }) }));
    setWeightSaving(false);
    if (res.ok) {
      setWeightInput('');
      loadData();
    }
  };

  if (loading) return <div className="animate-pulse text-text-muted">Loading your stats…</div>;

  const bmi = profile.current_weight && profile.height_cm
    ? (profile.current_weight / Math.pow(profile.height_cm / 100, 2)).toFixed(1)
    : null;

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">My Stats</h2>
        <p className="text-sm text-text-secondary">Private — weight and BMI are never shown on the leaderboard.</p>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-medium text-text-primary mb-3">Profile</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-text-muted">Display name</dt>
          <dd className="font-medium">{profile.display_name}</dd>
          <dt className="text-text-muted">Age bracket</dt>
          <dd className="font-medium">{profile.age_bracket.replace('_', ' ')}</dd>
          <dt className="text-text-muted">Height</dt>
          <dd className="font-medium">{profile.height_cm} cm</dd>
          <dt className="text-text-muted">Starting weight</dt>
          <dd className="font-medium">{profile.starting_weight} kg</dd>
          {profile.current_weight != null && (
            <>
              <dt className="text-text-muted">Current weight</dt>
              <dd className="font-medium">{profile.current_weight} kg</dd>
            </>
          )}
          {bmi != null && (
            <>
              <dt className="text-text-muted">BMI</dt>
              <dd className="font-medium">{bmi}</dd>
            </>
          )}
          <dt className="text-text-muted">Fitness goal</dt>
          <dd className="font-medium">{profile.fitness_goal.replace('_', ' ')}</dd>
        </dl>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-medium text-text-primary mb-3">Weekly weigh-in</h3>
        <p className="text-xs text-text-muted mb-3">Log once per week for +10 points. Kept private.</p>
        <form onSubmit={handleLogWeight} className="flex gap-2 flex-wrap">
          <input
            type="number"
            min={1}
            max={500}
            step={0.1}
            placeholder="Weight (kg)"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className="input-field max-w-[120px]"
          />
          <button type="submit" disabled={weightSaving} className="btn-primary">Log weight</button>
        </form>
      </div>

      {weightHistory.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-medium text-text-primary mb-3">Weight (weekly)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...weightHistory].reverse().map((w) => ({ ...w, name: w.week_start }))}>
                <XAxis dataKey="week_start" tick={{ fontSize: 10 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="weight_kg" stroke="var(--accent-green)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {entryHistory.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-medium text-text-primary mb-3">Daily points (last 90 days)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={entryHistory.slice(0, 90).reverse()}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="daily_points" stroke="var(--accent-gold)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
