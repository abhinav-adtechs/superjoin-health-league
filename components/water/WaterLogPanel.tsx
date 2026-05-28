'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiUrl, getApiFetchOptions, getAuthHeaders, readApiJson } from '@/lib/api';
import type { Profile } from '@/lib/types';
import type { WaterLogRow } from '@/lib/food/types';

const QUICK_ADD = [
  { source: 'quick_glass' as const, amount: 0.25, label: 'Glass', sub: '+250ml' },
  { source: 'quick_bottle' as const, amount: 0.5, label: 'Bottle', sub: '+500ml' },
  { source: 'quick_liter' as const, amount: 1, label: '1 L', sub: '+1 L' },
];

function isWaterApiUnavailable(res: Response): boolean {
  return res.status === 404;
}

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
  /** Older deploys lack /api/water/logs — fall back to additive daily_entries.water_liters */
  const [legacyMode, setLegacyMode] = useState(false);

  const goal = profile.goal_water_liters ?? 0;
  const pct = goal > 0 ? Math.min(100, Math.round((totalLiters / goal) * 100)) : 0;

  const loadLegacy = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/entries?date=${encodeURIComponent(date)}`), {
      ...getApiFetchOptions(),
      headers,
    });
    const data = await readApiJson<{ water_liters?: number | null; error?: string }>(res);
    if (!res.ok) throw new Error(data.error || 'Failed to load');
    setItems([]);
    setTotalLiters(Number(data?.water_liters ?? 0));
  }, [date]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(apiUrl(`/api/water/logs?date=${encodeURIComponent(date)}`), {
        ...getApiFetchOptions(),
        headers,
      });

      if (isWaterApiUnavailable(res)) {
        setLegacyMode(true);
        await loadLegacy();
        return;
      }

      const data = await readApiJson<{
        error?: string;
        items?: WaterLogRow[];
        total_liters?: number;
      }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setLegacyMode(false);
      setItems(data.items ?? []);
      setTotalLiters(data.total_liters ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [date, loadLegacy]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!error?.trim()) return;
    const t = setTimeout(() => setError(null), 10_000);
    return () => clearTimeout(t);
  }, [error]);

  const addWaterLegacy = async (amount: number) => {
    const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' };
    const res = await fetch(apiUrl('/api/entries'), {
      method: 'POST',
      ...getApiFetchOptions(),
      headers,
      body: JSON.stringify({ date, water_liters: amount }),
    });
    const data = await readApiJson<{
      error?: string;
      water_liters?: number;
      points_delta?: number;
      daily_points?: number;
    }>(res);
    if (!res.ok) throw new Error(data.error || 'Failed to save');
    setTotalLiters(Number(data.water_liters ?? totalLiters + amount));
    setItems([]);
    return data;
  };

  const addWater = async (amount: number, source: string, label: string) => {
    setSaving(true);
    setError(null);
    try {
      if (legacyMode) {
        const data = await addWaterLegacy(amount);
        return data;
      }

      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' };
      const res = await fetch(apiUrl('/api/water/logs'), {
        method: 'POST',
        ...getApiFetchOptions(),
        headers,
        body: JSON.stringify({ date, amount_liters: amount, source, label }),
      });

      if (isWaterApiUnavailable(res)) {
        setLegacyMode(true);
        const data = await addWaterLegacy(amount);
        return data;
      }

      const data = await readApiJson<{
        error?: string;
        total_liters?: number;
        points_delta?: number;
        daily_points?: number;
      }>(res);
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
    if (legacyMode) return;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(apiUrl(`/api/water/logs/${id}`), {
        method: 'DELETE',
        ...getApiFetchOptions(),
        headers,
      });
      const data = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`log-entry-form flex flex-col flex-1 min-h-0 ${compact ? 'gap-3' : ''}`}>
      <div
        className={`log-entry-scroll log-entry-scroll--compact flex-1 min-h-0 py-2 ${
          compact ? 'space-y-3' : 'space-y-4 sm:space-y-5'
        }`}
      >
        <div className="text-center">
          <div className="inline-flex flex-col items-center gap-1">
            <div
              className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-sky-200 flex items-center justify-center"
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
                onClick={() => void addWater(q.amount, q.source, q.label)}
                className="min-h-[48px] sm:min-h-[56px] rounded-xl border-2 border-sky-200 bg-sky-50/80 text-sky-900 font-semibold text-sm touch-manipulation active:scale-[0.98] disabled:opacity-50"
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
                onClick={() => void addWater(customAmount, 'manual', 'Custom')}
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
            ) : legacyMode ? (
              <p className="text-sm text-text-muted py-4 text-center">
                {totalLiters > 0
                  ? `${totalLiters.toFixed(1)} L logged today (daily total)`
                  : 'Tap +250ml when you drink'}
              </p>
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
                      {new Date(row.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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
      </div>

      {!compact && (
        <div className="log-entry-sticky-cta shrink-0 px-0 pt-2 pb-1">
          <button
            type="button"
            onClick={() => onDone()}
            className="btn-primary w-full min-h-[48px] sm:min-h-[52px] font-bold"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
