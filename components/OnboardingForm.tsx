'use client';

import { useState } from 'react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';

export function OnboardingForm({ onSuccess }: { onSuccess: () => void }) {
  const [display_name, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [height_cm, setHeightCm] = useState('');
  const [current_weight, setCurrentWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const weight = Number(current_weight);
    const res = await fetch(apiUrl('/api/users/setup'), getApiFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: display_name.trim(),
        age: Number(age),
        gender,
        height_cm: Number(height_cm),
        current_weight: weight,
      }),
    }));
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Setup failed');
      return;
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">Display name</label>
        <input
          type="text"
          value={display_name}
          onChange={(e) => setDisplayName(e.target.value)}
          className="input-field"
          placeholder="How you appear on leaderboard"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Age</label>
          <input
            type="number"
            min={10}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="input-field"
            placeholder="e.g. 28"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Gender</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')}
            className="input-field"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Height (cm)</label>
          <input
            type="number"
            min={1}
            max={300}
            step={0.1}
            value={height_cm}
            onChange={(e) => setHeightCm(e.target.value)}
            className="input-field"
            placeholder="e.g. 170"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Current weight (kg)</label>
          <input
            type="number"
            min={1}
            max={500}
            step={0.1}
            value={current_weight}
            onChange={(e) => setCurrentWeight(e.target.value)}
            className="input-field"
            placeholder="e.g. 70"
            required
          />
        </div>
      </div>
      {error && <p className="text-sm text-accent-red">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Creating…' : 'Create profile'}
      </button>
    </form>
  );
}
