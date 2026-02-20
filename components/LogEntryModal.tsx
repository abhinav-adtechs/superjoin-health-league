'use client';

import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import type { WorkoutOption, CardioType, Alcohol } from '@/lib/types';

const WORKOUT_BODY_PARTS: WorkoutOption[] = ['bicep', 'tricep', 'shoulder', 'chest', 'back', 'core', 'quad', 'hamstring', 'glute', 'calf', 'forearm'];
const WORKOUT_CLUSTERS: WorkoutOption[] = ['push', 'pull', 'legs', 'full_body', 'bodyweight', 'other'];
const CARDIO_OPTIONS: CardioType[] = [
  'running', 'cycling', 'swimming', 'walking', 'hiking', 'rowing', 'dance',
  'football', 'cricket', 'basketball', 'badminton', 'tennis', 'squash', 'volleyball', 'hockey',
  'martial_arts', 'sports', 'other',
];

function label(s: string): string {
  return s.replace(/_/g, ' ');
}

export type EntryType = 'full' | 'movement' | 'meal_recovery' | 'sleep';

const ENTRY_TITLES: Record<EntryType, string> = {
  full: 'Log full day',
  movement: 'Workout',
  meal_recovery: 'Food',
  sleep: 'Sleep',
};

interface LogEntryModalProps {
  entryType: EntryType;
  onClose: () => void;
  onSuccess: () => void;
}

export function LogEntryModal({ entryType, onClose, onSuccess }: LogEntryModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [workout_done, setWorkoutDone] = useState<boolean | null>(null);
  const [workout_duration, setWorkoutDuration] = useState('');
  const [workout_types, setWorkoutTypes] = useState<WorkoutOption[]>([]);
  const [workoutSearch, setWorkoutSearch] = useState('');
  const [cardio_done, setCardioDone] = useState<boolean | null>(null);
  const [cardio_duration, setCardioDuration] = useState('');
  const [cardio_type, setCardioType] = useState<CardioType | ''>('');
  const [cardioSearch, setCardioSearch] = useState('');
  const [steps, setSteps] = useState('');
  const [water_liters, setWaterLiters] = useState('');
  const [home_cooked_meals, setHomeCookedMeals] = useState<number | ''>('');
  const [protein_meal, setProteinMeal] = useState<boolean | null>(null);
  const [protein_qty, setProteinQty] = useState('');
  const [junk_food, setJunkFood] = useState<boolean | null>(null);
  const [alcohol, setAlcohol] = useState<Alcohol | ''>('');
  const [sleep_hours, setSleepHours] = useState('');
  const [sleep_quality, setSleepQuality] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const isTodayOrYesterday = (d: string) => {
    const dt = new Date(d);
    const todayDate = new Date();
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);
    return dt.toDateString() === todayDate.toDateString() || dt.toDateString() === yesterday.toDateString();
  };

  const loadExisting = async () => {
    const res = await fetch(apiUrl(`/api/entries?date=${date}`), getApiFetchOptions());
    const data = await res.json();
    if (data?.id) {
      setWorkoutDone(data.workout_done ?? null);
      setWorkoutDuration(data.workout_duration ?? '');
      setWorkoutTypes(Array.isArray(data.workout_types) ? data.workout_types : []);
      setCardioDone(data.cardio_done ?? null);
      setCardioDuration(data.cardio_duration ?? '');
      setCardioType(data.cardio_type ?? '');
      setSteps(data.steps ?? '');
      setWaterLiters(data.water_liters ?? '');
      setHomeCookedMeals(data.home_cooked_meals ?? '');
      setProteinMeal(data.protein_meal ?? null);
      setProteinQty(data.protein_qty ?? '');
      setJunkFood(data.junk_food ?? null);
      setAlcohol(data.alcohol ?? '');
      setSleepHours(data.sleep_hours ?? '');
      setSleepQuality(data.sleep_quality ?? '');
    }
  };

  useEffect(() => {
    loadExisting();
  }, [date]);

  const toggleWorkoutOption = (opt: WorkoutOption) => {
    setWorkoutTypes((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  const workoutFilter = useMemo(() => {
    const q = workoutSearch.trim().toLowerCase();
    if (!q) return { body: WORKOUT_BODY_PARTS, clusters: WORKOUT_CLUSTERS };
    const match = (s: string) => label(s).toLowerCase().includes(q);
    return {
      body: WORKOUT_BODY_PARTS.filter((o) => match(o)),
      clusters: WORKOUT_CLUSTERS.filter((o) => match(o)),
    };
  }, [workoutSearch]);

  const cardioFiltered = useMemo(() => {
    const q = cardioSearch.trim().toLowerCase();
    if (!q) return CARDIO_OPTIONS;
    return CARDIO_OPTIONS.filter((c) => label(c).toLowerCase().includes(q));
  }, [cardioSearch]);

  const buildPayload = (): Record<string, unknown> => {
    const base: Record<string, unknown> = { date };
    if (entryType === 'full' || entryType === 'movement') {
      base.workout_done = workout_done ?? undefined;
      base.workout_duration = workout_duration ? Number(workout_duration) : undefined;
      base.workout_types = workout_types.length ? workout_types : undefined;
      base.cardio_done = cardio_done ?? undefined;
      base.cardio_duration = cardio_duration ? Number(cardio_duration) : undefined;
      base.cardio_type = cardio_type || undefined;
      base.steps = steps ? Number(steps) : undefined;
    }
    if (entryType === 'full' || entryType === 'meal_recovery') {
      base.water_liters = water_liters ? Number(water_liters) : undefined;
      base.home_cooked_meals = home_cooked_meals !== '' ? Number(home_cooked_meals) : undefined;
      base.protein_meal = protein_meal ?? undefined;
      base.protein_qty = protein_qty ? Number(protein_qty) : undefined;
      base.junk_food = junk_food ?? undefined;
      base.alcohol = alcohol || undefined;
    }
    if (entryType === 'full' || entryType === 'sleep') {
      base.sleep_hours = sleep_hours ? Number(sleep_hours) : undefined;
      base.sleep_quality = sleep_quality !== '' ? Number(sleep_quality) : undefined;
    }
    return base;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTodayOrYesterday(date)) {
      setMessage({ type: 'error', text: 'You can only log for today or yesterday.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await fetch(apiUrl('/api/entries'), getApiFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    }));
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage({ type: 'error', text: data.error || 'Failed to save' });
      return;
    }
    setMessage({ type: 'ok', text: `Saved! Today's points: ${data.daily_points ?? 0}` });
    onSuccess();
    setTimeout(onClose, 800);
  };

  const showMovement = entryType === 'full' || entryType === 'movement';
  const showMealRecovery = entryType === 'full' || entryType === 'meal_recovery';
  const showSleep = entryType === 'full' || entryType === 'sleep';

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-white/10 rounded-t-2xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">{ENTRY_TITLES[entryType]}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-black/5 text-text-muted" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 sm:px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              className="input-field max-w-[180px]"
            />
            {!isTodayOrYesterday(date) && (
              <p className="text-xs text-accent-red mt-1">Only today or yesterday allowed.</p>
            )}
          </div>

          {showMovement && (
            <div className="glass-card p-4 space-y-4">
              <h3 className="font-medium text-text-primary">Workout</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm text-text-secondary mb-2">Workout?</label>
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" onClick={() => setWorkoutDone(true)} className={workout_done === true ? 'btn-primary' : 'btn-ghost'}>Yes</button>
                    <button type="button" onClick={() => { setWorkoutDone(false); setWorkoutDuration(''); setWorkoutTypes([]); }} className={workout_done === false ? 'btn-primary' : 'btn-ghost'}>No</button>
                    <button type="button" onClick={() => setWorkoutDone(null)} className={workout_done === null ? 'btn-primary' : 'btn-ghost'}>Skip</button>
                  </div>
                  {workout_done === true && (
                    <div className="mt-3 space-y-2">
                      <input type="text" placeholder="Search…" value={workoutSearch} onChange={(e) => setWorkoutSearch(e.target.value)} className="input-field max-w-full" />
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-surface-0/50 p-2 space-y-2">
                        <p className="text-[10px] font-semibold text-text-muted uppercase">Body</p>
                        <div className="flex flex-wrap gap-2">
                          {workoutFilter.body.map((t) => (
                            <label key={t} className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={workout_types.includes(t)} onChange={() => toggleWorkoutOption(t)} className="rounded border-text-muted" />
                              <span className="text-sm">{label(t)}</span>
                            </label>
                          ))}
                        </div>
                        <p className="text-[10px] font-semibold text-text-muted uppercase pt-1">Clusters</p>
                        <div className="flex flex-wrap gap-2">
                          {workoutFilter.clusters.map((t) => (
                            <label key={t} className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={workout_types.includes(t)} onChange={() => toggleWorkoutOption(t)} className="rounded border-text-muted" />
                              <span className="text-sm">{label(t)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <input type="number" min={1} placeholder="Duration (min)" value={workout_duration} onChange={(e) => setWorkoutDuration(e.target.value)} className="input-field w-28" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-2">Cardio?</label>
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" onClick={() => setCardioDone(true)} className={cardio_done === true ? 'btn-primary' : 'btn-ghost'}>Yes</button>
                    <button type="button" onClick={() => { setCardioDone(false); setCardioDuration(''); setCardioType(''); }} className={cardio_done === false ? 'btn-primary' : 'btn-ghost'}>No</button>
                    <button type="button" onClick={() => setCardioDone(null)} className={cardio_done === null ? 'btn-primary' : 'btn-ghost'}>Skip</button>
                  </div>
                  {cardio_done === true && (
                    <div className="mt-3 space-y-2">
                      <input type="text" placeholder="Search…" value={cardioSearch} onChange={(e) => setCardioSearch(e.target.value)} className="input-field max-w-full" />
                      <select value={cardio_type} onChange={(e) => setCardioType(e.target.value as CardioType)} className="input-field max-w-full">
                        <option value="">Select type</option>
                        {cardioFiltered.map((t) => <option key={t} value={t}>{label(t)}</option>)}
                      </select>
                      <input type="number" min={1} placeholder="Min" value={cardio_duration} onChange={(e) => setCardioDuration(e.target.value)} className="input-field w-20" />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Steps</label>
                <input type="number" min={0} placeholder="Optional" value={steps} onChange={(e) => setSteps(e.target.value)} className="input-field max-w-[140px]" />
              </div>
            </div>
          )}

          {showMealRecovery && (
            <div className="glass-card p-4 space-y-4">
              <h3 className="font-medium text-text-primary">Food</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Water (L)</label>
                  <input type="number" min={0} max={10} step={0.1} placeholder="e.g. 2.5" value={water_liters} onChange={(e) => setWaterLiters(e.target.value)} className="input-field max-w-[100px]" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Home-cooked meals (0–3)</label>
                  <select value={home_cooked_meals} onChange={(e) => setHomeCookedMeals(e.target.value === '' ? '' : Number(e.target.value))} className="input-field max-w-[100px]">
                    <option value="">Skip</option>
                    {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">Protein meal?</label>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={() => setProteinMeal(true)} className={protein_meal === true ? 'btn-primary' : 'btn-ghost'}>Yes</button>
                  <button type="button" onClick={() => { setProteinMeal(false); setProteinQty(''); }} className={protein_meal === false ? 'btn-primary' : 'btn-ghost'}>No</button>
                  <button type="button" onClick={() => setProteinMeal(null)} className={protein_meal === null ? 'btn-primary' : 'btn-ghost'}>Skip</button>
                </div>
                {protein_meal === true && (
                  <input type="number" min={0} max={500} placeholder="Approx grams (optional)" value={protein_qty} onChange={(e) => setProteinQty(e.target.value)} className="input-field max-w-[180px] mt-2" />
                )}
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">Junk food today?</label>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={() => setJunkFood(true)} className={junk_food === true ? 'btn-primary' : 'btn-ghost'}>Yes</button>
                  <button type="button" onClick={() => setJunkFood(false)} className={junk_food === false ? 'btn-primary' : 'btn-ghost'}>No</button>
                  <button type="button" onClick={() => setJunkFood(null)} className={junk_food === null ? 'btn-primary' : 'btn-ghost'}>Skip</button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Alcohol</label>
                <select value={alcohol} onChange={(e) => setAlcohol(e.target.value as Alcohol | '')} className="input-field max-w-[180px]">
                  <option value="">Skip</option>
                  <option value="zero">Zero</option>
                  <option value="one_to_two">1–2</option>
                  <option value="three_plus">3+</option>
                </select>
              </div>
            </div>
          )}

          {showSleep && (
            <div className="glass-card p-4 space-y-4">
              <h3 className="font-medium text-text-primary">Sleep</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Hours</label>
                  <input type="number" min={0} max={24} step={0.5} placeholder="e.g. 7.5" value={sleep_hours} onChange={(e) => setSleepHours(e.target.value)} className="input-field max-w-[100px]" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Quality (1–5)</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setSleepQuality(n)} className={`w-9 h-9 rounded-lg text-sm font-medium ${sleep_quality === n ? 'btn-primary' : 'btn-ghost'}`}>{n}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {message && (
            <p className={`text-sm ${message.type === 'error' ? 'text-accent-red' : 'text-accent-green'}`}>{message.text}</p>
          )}
          <button type="submit" disabled={saving || !isTodayOrYesterday(date)} className="btn-primary w-full">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
