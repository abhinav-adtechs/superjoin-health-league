'use client';

import { useState, useRef, useEffect } from 'react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';

const PIN_LEN = 6;

export function SetPinForm({ onSuccess, pinExpired = false }: { onSuccess: () => void; pinExpired?: boolean }) {
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleNewPinChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, PIN_LEN);
    setNewPin(digits);
    setError('');
  };

  const handleConfirmChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, PIN_LEN);
    setConfirmPin(digits);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== PIN_LEN) {
      setError('Enter a 6-digit PIN');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    setLoading(true);
    setError('');
    const res = await fetch(apiUrl('/api/auth/set-pin'), getApiFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPin }),
    }));
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Failed to set PIN');
      return;
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-text-secondary">
        {pinExpired
          ? 'Your PIN has expired (60 days). Set a new 6-digit PIN.'
          : 'Set a new 6-digit PIN. It cannot be the same as your last PIN.'}
      </p>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">New PIN</label>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={PIN_LEN}
          value={newPin}
          onChange={(e) => handleNewPinChange(e.target.value)}
          className="input-field font-mono text-lg tracking-widest"
          placeholder="000000"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">Confirm PIN</label>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={PIN_LEN}
          value={confirmPin}
          onChange={(e) => handleConfirmChange(e.target.value)}
          className="input-field font-mono text-lg tracking-widest"
          placeholder="000000"
          required
        />
      </div>
      {error && <p className="text-sm text-accent-red">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? '…' : 'Set new PIN'}
      </button>
    </form>
  );
}
