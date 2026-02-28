'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Target, Activity, Utensils, Moon, Pencil, Check, X, RefreshCw } from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import type { Profile } from '@/lib/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function cmToFeetInch(cm: number) {
  const totalIn = cm / 2.54;
  return { feet: Math.floor(totalIn / 12), inches: Math.round(totalIn % 12) };
}

function minsToHoursDisplay(mins: number): string {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/** "2025-01-24" → "24 Jan '25" */
function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDate();
  const mon = d.toLocaleString('en', { month: 'short' });
  const yr = String(d.getFullYear()).slice(2);
  return `${day} ${mon} '${yr}`;
}

// DiceBear avataaars — caricature-style cartoon avatars
function avatarUrl(seed: string) {
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

// Generate N avatar seed options for a given name
function avatarSeeds(name: string): string[] {
  const base = name.replace(/\s+/g, '');
  return [base, `${base}2`, `${base}3`, `${base}x`, `${base}pro`, `${base}7`];
}

// ─── component ──────────────────────────────────────────────────────────────

export function MyStatsTab({ profile, onSuccess }: { profile: Profile; onSuccess?: () => void }) {
  const [weightHistory, setWeightHistory] = useState<{ week_start: string; weight_kg: number }[]>([]);
  const [entryHistory, setEntryHistory] = useState<{ date: string; daily_points: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // profile edit
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(profile.avatar_url ?? '');
  const [profileFields, setProfileFields] = useState({
    display_name: profile.display_name,
    age: String(profile.age),
    height_cm: String(profile.height_cm),
    current_weight: String(profile.current_weight ?? ''),
    gender: profile.gender,
  });

  // goals
  const [goalsSaving, setGoalsSaving] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);
  const workoutMinsStored = profile.goal_workout_mins_week ?? null;
  const [goalWorkoutHours, setGoalWorkoutHours] = useState(
    workoutMinsStored != null ? String(Math.floor(workoutMinsStored / 60)) : ''
  );
  const [goalWorkoutMins, setGoalWorkoutMins] = useState(
    workoutMinsStored != null ? String(workoutMinsStored % 60) : ''
  );
  const [goals, setGoals] = useState({
    goal_workout_days_week: profile.goal_workout_days_week ?? '',
    goal_steps_day: profile.goal_steps_day ?? '',
    goal_sleep_hours: profile.goal_sleep_hours ?? profile.goal_sleep_hours_min ?? '',
    goal_water_liters: profile.goal_water_liters ?? '',
    goal_home_cooked_per_week: profile.goal_home_cooked_per_week ?? '',
  });

  const hasAnyGoals = [
    profile.goal_workout_mins_week,
    profile.goal_workout_days_week,
    profile.goal_steps_day,
    profile.goal_sleep_hours ?? profile.goal_sleep_hours_min,
    profile.goal_water_liters,
    profile.goal_home_cooked_per_week,
  ].some((v) => v != null && String(v) !== '');

  useEffect(() => {
    const m = profile.goal_workout_mins_week ?? null;
    setGoalWorkoutHours(m != null ? String(Math.floor(m / 60)) : '');
    setGoalWorkoutMins(m != null ? String(m % 60) : '');
    setGoals({
      goal_workout_days_week: profile.goal_workout_days_week ?? '',
      goal_steps_day: profile.goal_steps_day ?? '',
      goal_sleep_hours: profile.goal_sleep_hours ?? profile.goal_sleep_hours_min ?? '',
      goal_water_liters: profile.goal_water_liters ?? '',
      goal_home_cooked_per_week: profile.goal_home_cooked_per_week ?? '',
    });
    setProfileFields({
      display_name: profile.display_name,
      age: String(profile.age),
      height_cm: String(profile.height_cm),
      current_weight: String(profile.current_weight ?? ''),
      gender: profile.gender,
    });
    setSelectedAvatar(profile.avatar_url ?? '');
  }, [profile]);

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - 90);
    const to = new Date().toISOString().slice(0, 10);
    const fromStr = from.toISOString().slice(0, 10);
    Promise.all([
      fetch(apiUrl('/api/weight/history'), getApiFetchOptions()).then((r) => r.json()),
      fetch(apiUrl(`/api/entries/history?from=${fromStr}&to=${to}`), getApiFetchOptions()).then((r) => r.json()),
    ]).then(([wh, eh]) => {
      setWeightHistory(wh ?? []);
      setEntryHistory((eh ?? []).map((e: { date: string; daily_points: number }) => ({
        date: e.date,
        label: fmtDate(e.date),
        daily_points: e.daily_points ?? 0,
      })));
      setLoading(false);
    });
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    const payload: Record<string, unknown> = {
      display_name: profileFields.display_name.trim(),
      age: Number(profileFields.age),
      height_cm: Number(profileFields.height_cm),
      gender: profileFields.gender,
      avatar_url: selectedAvatar || null,
    };
    if (profileFields.current_weight !== '') payload.current_weight = Number(profileFields.current_weight);
    const res = await fetch(apiUrl('/api/users/me'), getApiFetchOptions({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    setProfileSaving(false);
    if (res.ok) { setEditingProfile(false); onSuccess?.(); }
  };

  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoalsSaving(true);
    const num = (v: string | number) => (v === '' || v == null ? null : Number(v));
    const totalWorkoutMins = (goalWorkoutHours !== '' || goalWorkoutMins !== '')
      ? (Number(goalWorkoutHours || 0) * 60 + Number(goalWorkoutMins || 0)) : null;
    const payload: Record<string, number | null> = {
      goal_workout_mins_week: totalWorkoutMins,
      goal_workout_days_week: num(goals.goal_workout_days_week),
      goal_steps_day: num(goals.goal_steps_day),
      goal_sleep_hours: num(goals.goal_sleep_hours),
      goal_water_liters: num(goals.goal_water_liters),
      goal_home_cooked_per_week: num(goals.goal_home_cooked_per_week),
    };
    const res = await fetch(apiUrl('/api/users/me'), getApiFetchOptions({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    setGoalsSaving(false);
    if (res.ok) { setEditingGoals(false); onSuccess?.(); }
  };

  if (loading) return <div className="animate-pulse text-text-muted py-10">Loading your stats…</div>;

  const bmi = profile.current_weight && profile.height_cm
    ? (profile.current_weight / Math.pow(profile.height_cm / 100, 2)).toFixed(1) : null;

  const { feet, inches } = cmToFeetInch(profile.height_cm);
  const seeds = avatarSeeds(profile.display_name);
  const currentAvatarSrc = profile.avatar_url || avatarUrl(profile.display_name);

  const weightChartData = [...weightHistory].reverse().map((w) => ({
    ...w,
    label: fmtDate(w.week_start),
  }));

  const editBtnCls = 'flex items-center gap-1.5 text-xs font-medium transition-colors px-3 py-1.5 rounded-lg border';

  const foodGoalList = [
    { key: 'goal_water_liters', label: 'Water (L/day)', value: goals.goal_water_liters, set: (v: string) => setGoals((g) => ({ ...g, goal_water_liters: v })), placeholder: '2.5', min: 0, max: 10, step: 0.5 },
    { key: 'goal_home_cooked_per_week', label: 'Home-cooked/week', value: goals.goal_home_cooked_per_week, set: (v: string) => setGoals((g) => ({ ...g, goal_home_cooked_per_week: v })), placeholder: '10', min: 0, max: 21 },
  ];

  return (
    <div className="space-y-8 animate-fade-up">

      {/* ══════════════════════════════════════
          PROFILE CARD
      ══════════════════════════════════════ */}
      <div className="glass-card overflow-hidden">
        {/* Banner with edit button */}
        <div className="h-20 bg-gradient-to-r from-primary-orange/25 via-primary-orange/10 to-indigo-100/30 relative">
          {!editingProfile && (
            <button
              type="button"
              onClick={() => setEditingProfile(true)}
              className={`${editBtnCls} absolute top-3 right-3 text-primary-orange border-primary-orange/30 bg-white/70 hover:bg-white hover:border-primary-orange/50 backdrop-blur-sm`}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit profile
            </button>
          )}
        </div>

        <div className="px-4 sm:px-6 pb-5">
          {/* Avatar row */}
          <div className="flex items-end -mt-9 mb-4">
            <div className="w-16 h-16 rounded-2xl ring-4 ring-white shadow-md overflow-hidden bg-gradient-to-br from-primary-orange to-primary-orange-dark flex items-center justify-center text-white text-xl font-bold shrink-0">
              {currentAvatarSrc.startsWith('http')
                ? <img src={currentAvatarSrc} alt={profile.display_name} className="w-full h-full object-cover" />
                : <span>{getInitials(profile.display_name)}</span>
              }
            </div>
          </div>

          {editingProfile ? (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Avatar picker */}
              <div>
                <p className="text-xs font-medium text-text-muted mb-2">Choose your avatar</p>
                <div className="flex gap-2 flex-wrap">
                  {seeds.map((seed) => {
                    const url = avatarUrl(seed);
                    const active = selectedAvatar === url;
                    return (
                      <button
                        key={seed}
                        type="button"
                        onClick={() => setSelectedAvatar(url)}
                        className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                          active ? 'border-primary-orange shadow-md scale-105' : 'border-transparent hover:border-primary-orange/30'
                        }`}
                      >
                        <img src={url} alt={seed} className="w-full h-full object-cover bg-slate-100" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-text-muted mb-1">Display name</label>
                  <input type="text" value={profileFields.display_name}
                    onChange={(e) => setProfileFields((p) => ({ ...p, display_name: e.target.value }))}
                    className="input-field" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Age</label>
                  <input type="number" min={10} max={120} value={profileFields.age}
                    onChange={(e) => setProfileFields((p) => ({ ...p, age: e.target.value }))}
                    className="input-field" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Gender</label>
                  <select value={profileFields.gender}
                    onChange={(e) => setProfileFields((p) => ({ ...p, gender: e.target.value as Profile['gender'] }))}
                    className="input-field">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Height (cm)</label>
                  <input type="number" min={1} max={300} step={0.1} value={profileFields.height_cm}
                    onChange={(e) => setProfileFields((p) => ({ ...p, height_cm: e.target.value }))}
                    className="input-field" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Current weight (kg)</label>
                  <input type="number" min={1} max={500} step={0.1} value={profileFields.current_weight}
                    onChange={(e) => setProfileFields((p) => ({ ...p, current_weight: e.target.value }))}
                    className="input-field" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={profileSaving} className="btn-primary flex items-center gap-2 text-sm">
                  <Check className="w-3.5 h-3.5" />
                  {profileSaving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setEditingProfile(false)} className="btn-ghost text-sm flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h3 className="text-xl font-bold text-text-primary leading-tight">{profile.display_name}</h3>
              <p className="text-sm text-text-muted capitalize mb-4">{profile.gender}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {[
                  { label: 'Age', value: `${profile.age}` },
                  { label: 'Height', value: `${profile.height_cm} cm`, sub: `${feet}'${inches}"` },
                  { label: 'Weight', value: profile.current_weight != null ? `${profile.current_weight} kg` : '—' },
                  { label: 'BMI', value: bmi ?? '—' },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="bg-surface-1 rounded-xl px-3 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">{label}</p>
                    <p className="text-base font-bold text-text-primary mt-0.5 leading-tight">{value}</p>
                    {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          GOALS CARD
      ══════════════════════════════════════ */}
      <div className="rounded-2xl border-2 border-accent-green/25 bg-gradient-to-br from-accent-green/5 via-white to-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-accent-green/10 bg-accent-green/5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-green/15 flex items-center justify-center">
              <Target className="w-4 h-4 text-accent-green" />
            </div>
            <span className="font-semibold text-text-primary">My Goals</span>
          </div>
          {hasAnyGoals && !editingGoals && (
            <button
              type="button"
              onClick={() => setEditingGoals(true)}
              className={`${editBtnCls} text-accent-green border-accent-green/20 hover:bg-accent-green/5 hover:border-accent-green/30`}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>

        <div className="p-4 sm:p-6">
          {(editingGoals || !hasAnyGoals) ? (
            <form onSubmit={handleSaveGoals} className="space-y-6">
              {/* Workout */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-[#FF6B35]" />
                  <span className="text-sm font-semibold text-text-primary">Workout</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Duration per week</label>
                    <div className="flex gap-1.5">
                      <div className="relative flex-1 min-w-0">
                        <input type="number" min={0} max={20} placeholder="4" value={goalWorkoutHours}
                          onChange={(e) => setGoalWorkoutHours(e.target.value)}
                          className="input-field pr-7" />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none">h</span>
                      </div>
                      <div className="relative flex-1 min-w-0">
                        <input type="number" min={0} max={59} placeholder="30" value={goalWorkoutMins}
                          onChange={(e) => setGoalWorkoutMins(e.target.value)}
                          className="input-field pr-9" />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none">min</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Days/week</label>
                    <input type="number" min={0} max={7} placeholder="4" value={goals.goal_workout_days_week}
                      onChange={(e) => setGoals((g) => ({ ...g, goal_workout_days_week: e.target.value }))}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Steps/day</label>
                    <input type="number" min={0} max={100000} placeholder="10000" value={goals.goal_steps_day}
                      onChange={(e) => setGoals((g) => ({ ...g, goal_steps_day: e.target.value }))}
                      className="input-field" />
                  </div>
                </div>
              </div>

              {/* Food */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Utensils className="w-4 h-4 text-accent-gold" />
                  <span className="text-sm font-semibold text-text-primary">Food</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {foodGoalList.map((g) => (
                    <div key={g.key}>
                      <label className="block text-xs font-medium text-text-muted mb-1">{g.label}</label>
                      <input type="number" min={g.min} max={g.max} step={g.step ?? 1}
                        placeholder={g.placeholder} value={g.value}
                        onChange={(e) => g.set(e.target.value)} className="input-field" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Sleep */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Moon className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-text-primary">Sleep</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Hours/night</label>
                    <input type="number" min={4} max={12} step={0.5} placeholder="7.5"
                      value={goals.goal_sleep_hours}
                      onChange={(e) => setGoals((g) => ({ ...g, goal_sleep_hours: e.target.value }))}
                      className="input-field" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={goalsSaving} className="btn-primary flex items-center gap-2 text-sm">
                  <Check className="w-3.5 h-3.5" />
                  {goalsSaving ? 'Saving…' : 'Save goals'}
                </button>
                {hasAnyGoals && (
                  <button type="button" onClick={() => setEditingGoals(false)} className="btn-ghost text-sm">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Workout */}
              <div className="rounded-xl border border-[#FF6B35]/20 bg-[#FF6B35]/5 p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#FF6B35]/15 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-[#FF6B35]" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B35]">Workout</span>
                </div>
                <ul className="space-y-1.5">
                  {profile.goal_workout_mins_week != null && (
                    <li className="text-sm font-semibold text-text-primary">
                      {minsToHoursDisplay(profile.goal_workout_mins_week)}
                      <span className="text-xs font-normal text-text-muted"> / week</span>
                    </li>
                  )}
                  {profile.goal_workout_days_week != null && (
                    <li className="text-sm text-text-secondary">{profile.goal_workout_days_week} days/week</li>
                  )}
                  {profile.goal_steps_day != null && (
                    <li className="text-sm text-text-secondary">{profile.goal_steps_day.toLocaleString()} steps/day</li>
                  )}
                  {!profile.goal_workout_mins_week && !profile.goal_workout_days_week && !profile.goal_steps_day && (
                    <li className="text-sm text-text-muted">Not set</li>
                  )}
                </ul>
              </div>

              {/* Food */}
              <div className="rounded-xl border border-amber-300/30 bg-amber-50/60 p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <Utensils className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Food</span>
                </div>
                <ul className="space-y-1.5">
                  {profile.goal_water_liters != null && (
                    <li className="text-sm font-semibold text-text-primary">
                      {profile.goal_water_liters} L
                      <span className="text-xs font-normal text-text-muted"> water/day</span>
                    </li>
                  )}
                  {profile.goal_home_cooked_per_week != null && (
                    <li className="text-sm text-text-secondary">{profile.goal_home_cooked_per_week} home-cooked/week</li>
                  )}
                  {!profile.goal_water_liters && !profile.goal_home_cooked_per_week && (
                    <li className="text-sm text-text-muted">Not set</li>
                  )}
                </ul>
              </div>

              {/* Sleep */}
              <div className="rounded-xl border border-indigo-300/30 bg-indigo-50/60 p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                    <Moon className="w-4 h-4 text-indigo-500" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">Sleep</span>
                </div>
                <p className="text-sm font-semibold text-text-primary">
                  {(profile.goal_sleep_hours ?? profile.goal_sleep_hours_min) != null
                    ? <>{profile.goal_sleep_hours ?? profile.goal_sleep_hours_min} h <span className="text-xs font-normal text-text-muted">/ night</span></>
                    : <span className="font-normal text-text-muted">Not set</span>
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          WEIGHT & POINTS HISTORY
      ══════════════════════════════════════ */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-muted mb-2">
          <Target className="w-4 h-4 text-accent-gold" />
          Weight & Points History
        </h3>
        <p className="text-xs text-text-muted mb-5">
          Log weight via <strong>New Entry</strong> — updates your weekly weigh-in and current weight above.
        </p>

        {weightHistory.length > 0 && (
          <div className="glass-card p-5 mb-6">
            <h4 className="font-medium text-text-primary mb-3">Weight (weekly)</h4>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weightChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={38} />
                  <Tooltip formatter={(v) => [`${v} kg`, 'Weight']} labelFormatter={(l) => l} />
                  <Line type="monotone" dataKey="weight_kg" stroke="var(--accent-green)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {entryHistory.length > 0 && (
          <div className="glass-card p-5">
            <h4 className="font-medium text-text-primary mb-3">Daily points (last 90 days)</h4>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={entryHistory.slice(0, 90).reverse()} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} width={38} />
                  <Tooltip formatter={(v) => [`${v} pts`, 'Points']} labelFormatter={(l) => l} />
                  <Line type="monotone" dataKey="daily_points" stroke="var(--accent-gold)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {weightHistory.length === 0 && entryHistory.length === 0 && (
          <div className="glass-card p-8 text-center">
            <p className="text-sm text-text-muted">No history yet. Start logging from <strong>New Entry</strong>.</p>
          </div>
        )}
      </div>
    </div>
  );
}
