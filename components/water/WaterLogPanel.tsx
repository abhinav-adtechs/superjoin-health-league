'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiUrl, getApiFetchOptions, getAuthHeaders } from '@/lib/api';
import type { Profile } from '@/lib/types';
import type { WaterLogRow } from '@/lib/food/types';

const QUICK_ADD = [
  { source: 'quick_glass' as const, amount: 0.25, label: 'Glass', sub: '+250ml' },
  { source: 'quick_bottle' as const, amount: 0.5, label: 'Bottle', sub: '+500ml' },
  { source: 'quick_liter' as const, amount: 1, label: '1 L', sub: '+1 L' },
];

interface WaterLogPanelProps {
  profile: Profile;
  date: string;
  onDone: (result?: { points_delta?: number; daily_points?: number }) => void;
  compact?: boolean;
}

export function WaterLogPanel({ profile, date, onDone, compact }: WaterLogPanelProps) {
  const [items, setItems] = useState<WaterLogRow[]>([]);
  const [totalLiters, setTotalLiters] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState(0.5);

  const goal = profile.goal_water_liters ?? 0;
  const pct = goal > 0 ? Math.min(100, Math.round((totalLiters / goal) * 100)) : 0;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(apiUrl(`/api/water/logs?date=${encodeURIComponent(date)}`), {
        ...getApiFetchOptions(),
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setItems(data.items ?? []);
      setTotalLiters(data.total_liters ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!error?.trim()) return;
    const t = setTimeout(() => setError(null), 10_000);
    return () => clearTimeout(t);
  }, [error]);

  const addWater = async (amount: number, source: string, label: string) => {
    setSaving(true);
    setError(null);
    try {
      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' };
      const res = await fetch(apiUrl('/api/water/logs'), {
        method: 'POST',
        ...getApiFetchOptions(),
        headers,
        body: JSON.stringify({ date, amount_liters: amount, source, label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setTotalLiters(data.total_liters ?? totalLiters + amount);
      await load();
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(apiUrl(`/api/water/logs/${id}`), {
        method: 'DELETE',
        ...getApiFetchOptions(),
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`flex flex-col flex-1 min-h-0 ${compact ? 'gap-4' : 'gap-4 sm:gap-5'} py-2 ${compact ? '' : 'overflow-y-auto overscroll-contain'}`}
    >
      <div className="text-center">
        <div className="inline-flex flex-col items-center gap-1">
          <div
            className="relative w-20 h-20 rounded-full border-4 border-sky-200 flex items-center justify-center"
            style={{
              background: `conic-gradient(#0ea5e9 ${pct}%, #e0f2fe ${pct}% 100%)`,
            }}
          >
            <span className="relative z-10 text-sm font-bold text-sky-900 bg-white/90 rounded-full px-2 py-0.5">
              {goal > 0 ? `${pct}%` : '—'}
            </span>
          </div>
          <p className="text-sm font-semibold text-text-primary">
            {totalLiters.toFixed(1)} L{goal > 0 ? ` of ${goal} L` : ''} today
          </p>
          {goal > 0 && totalLiters < goal && (
            <p className="text-xs text-text-muted">{(goal - totalLiters).toFixed(1)} L to goal</p>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-text-secondary mb-2">Quick add</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {QUICK_ADD.map((q) => (
            <button
              key={q.source}
              type="button"
              disabled={saving}
              onClick={() => addWater(q.amount, q.source, q.label)}
              className="min-h-[56px] rounded-xl border-2 border-sky-200 bg-sky-50/80 text-sky-900 font-semibold text-sm touch-manipulation active:scale-[0.98] disabled:opacity-50"
            >
              <span className="block">{q.sub}</span>
              <span className="block text-[10px] font-normal text-sky-700">{q.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 text-sm text-primary-orange font-medium underline"
          onClick={() => setCustomOpen((o) => !o)}
        >
          Custom amount
        </button>
        {customOpen && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={0.1}
              max={2}
              step={0.1}
              value={customAmount}
              onChange={(e) => setCustomAmount(Number(e.target.value))}
              className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-sm text-text-muted">L</span>
            <button
              type="button"
              disabled={saving}
              onClick={() => addWater(customAmount, 'manual', 'Custom')}
              className="btn-primary px-4 py-2 text-sm min-h-[44px]"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {!compact && (
        <div className="flex-1 min-h-0">
          <p className="text-sm font-medium text-text-secondary mb-2">Today</p>
          {loading ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">Tap +250ml when you drink</p>
          ) : (
            <ul className="space-y-2 max-h-[200px] overflow-y-auto">
              {items.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-black/5 px-3 py-2 text-sm"
                >
                  <span className="text-text-muted text-xs">
                    {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="flex-1 font-medium">
                    {row.label || 'Water'} +{Number(row.amount_liters).toFixed(2)} L
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(row.id)}
                    disabled={saving}
                    className="text-text-muted hover:text-red-600 p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Remove"
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!compact && (
        <button type="button" onClick={() => onDone()} className="btn-primary w-full min-h-[52px] font-bold">
          Done
        </button>
      )}
    </div>
  );
}
